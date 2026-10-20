import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen } from "electron";
import path from "path";
import Store from "electron-store";

const store: any = new Store({ name: "shade-ai-settings" });

let win: BrowserWindow | null = null;
let opacity = 0.3;
let clickThrough = true;
let ghostMode = false;


function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: 460,
    height: 640,
    x: width - 480,
    y: height - 660,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) win.setContentProtection(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(clickThrough, { forward: true });

  if (process.platform === "darwin" && app.dock) app.dock.hide();

  if (!app.isPackaged) { win.loadURL("http://localhost:5173"); }
  else win.loadFile(path.join(__dirname, "../dist/index.html"));

  win.on("closed", () => { win = null; });
}

function setOpacity(v: number) {
  opacity = Math.min(0.8, Math.max(0.05, v));
  if (win) win.setOpacity(opacity);
  store.set("opacity", opacity);
}

function toggleClickThrough() {
  clickThrough = !clickThrough;
  if (win) win.setIgnoreMouseEvents(clickThrough, { forward: true });
  win?.webContents.send("state:clickThrough", clickThrough);
}

function toggleGhost() {
  ghostMode = !ghostMode;
  win?.webContents.send("state:ghost", ghostMode);
}

function panic() {
  if (!win) return;
  win.hide();
  win.webContents.send("action:panic");
}

function showWin() {
  if (!win) return;
  win.show();
  win.focus();
}

if (!app.isPackaged) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('no-zygote');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

app.whenReady().then(() => {
  opacity = (store.get("opacity") as number) ?? 0.3;
  createWindow();
  if (win) win.setOpacity(opacity);

  const reg = (accel: string, fn: () => void) => globalShortcut.register(accel, fn);
  reg("Alt+Shift+S", () => { showWin(); win?.webContents.send("action:capture"); });
  reg("Alt+Shift+H", () => { if (win?.isVisible()) win.hide(); else showWin(); });
  reg("Alt+Shift+C", toggleClickThrough);
  reg("Alt+Shift+G", toggleGhost);
  reg("Alt+Shift+Up", () => setOpacity(opacity + 0.05));
  reg("Alt+Shift+Down", () => setOpacity(opacity - 0.05));
  reg("Alt+Shift+Q", () => { showWin(); win?.webContents.send("action:openInput"); });
  reg("Alt+Shift+N", () => win?.webContents.send("action:newChat"));
  reg("Alt+Shift+X", () => { win?.webContents.send("action:panic"); });
  reg("F12", panic);
  reg("Alt+Shift+1", () => win?.webContents.send("action:setMode", "code"));
  reg("Alt+Shift+2", () => win?.webContents.send("action:setMode", "explain"));
  reg("Alt+Shift+3", () => win?.webContents.send("action:setMode", "system"));
  reg("Alt+Shift+4", () => win?.webContents.send("action:setMode", "behavioral"));
  reg("Alt+Shift+0", () => win?.webContents.send("action:setMode", "auto"));
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

ipcMain.handle("capture:screenshot", async () => {
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1920, height: 1080 } });
  if (!sources.length) return null;
  const src = sources[0];
  return src.thumbnail.toDataURL();
});

ipcMain.handle("llm:chat", async (event, payload: { messages: any[]; mode: string; webSearch: boolean }) => {
  const apiKey = (store.get("geminiKey") as string) || process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    event.sender.send("llm:error", "No Gemini API key. Open Settings (gear icon) and paste your key, or set GEMINI_API_KEY env var. Get a key: https://aistudio.google.com/apikey");
    return;
  }
  const modeHint: Record<string, string> = {
    code: "Focus on producing correct, runnable code with brief explanation.",
    explain: "Explain clearly and concisely.",
    system: "Focus on system design: components, trade-offs, scalability.",
    behavioral: "Help craft a strong behavioral interview answer (STAR format).",
    auto: "",
  };
  const systemText = `You are a concise, accurate AI assistant. Answer anything asked. ${modeHint[payload.mode] || ""} Never mention being an AI or tool name. Use markdown.`;

  // Convert messages to Gemini contents format
  const contents: any[] = [];
  for (const m of payload.messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      contents.push({ role, parts: [{ text: m.content }] });
    } else if (Array.isArray(m.content)) {
      const parts: any[] = [];
      for (const c of m.content) {
        if (c.type === "text") parts.push({ text: c.text });
        else if (c.type === "image_url") {
          const url = c.image_url?.url || "";
          const b64 = url.includes(",") ? url.split(",")[1] : url;
          parts.push({ inline_data: { mime_type: "image/png", data: b64 } });
        }
      }
      contents.push({ role, parts });
    }
  }

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const modelsToTry = ["gemini-3-flash-preview", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.6-flash"];
  let lastErr = "";
  let succeeded = false;
  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        lastErr = `Gemini error ${res.status} (${model}): ${txt.slice(0, 200)}`;
        console.error("LLM ERROR:", lastErr);
        // try next model on 404/429/503
        if (res.status === 404 || res.status === 429 || res.status === 503) continue;
        event.sender.send("llm:error", lastErr);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const obj = JSON.parse(jsonStr);
            const parts = obj?.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const p of parts) {
                if (p.text) event.sender.send("llm:delta", p.text);
              }
            }
          } catch {}
        }
      }
      succeeded = true;
      break;
    } catch (e: any) {
      lastErr = e?.message || String(e);
      console.error("LLM EXCEPTION:", lastErr);
      continue;
    }
  }
  if (!succeeded) {
    console.error("LLM FAILED:", lastErr);
    event.sender.send("llm:error", lastErr || "All models failed.");
    return;
  }
  event.sender.send("llm:done");
  return;
});

ipcMain.handle("win:setClickThrough", (_e, v: boolean) => { clickThrough = !!v; if (win) win.setIgnoreMouseEvents(clickThrough, { forward: true }); win?.webContents.send("state:clickThrough", clickThrough); return clickThrough; });
ipcMain.handle("settings:get", (_e, key: string) => store.get(key));
ipcMain.handle("settings:set", (_e, key: string, val: any) => { store.set(key, val); return true; });
