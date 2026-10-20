import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "./store/useStore";

const shade = (window as any).shade;

export default function App() {
  const s = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const runCaptureRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [peek, setPeek] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => { shade.getSetting("geminiKey").then((v: string) => { if (v) setApiKey(v); }); }, []);
  // wire IPC events
  useEffect(() => {
    shade.onDelta((t: string) => s.appendAssistant(t));
    shade.onDone(() => s.finalizeAssistant());
    shade.onError((e: string) => { s.appendAssistant(`\n\n⚠️ ${e}`); s.finalizeAssistant(); });
    shade.onOpenInput(() => s.setInputOpen(true));
    shade.onCapture(() => { runCaptureRef.current(); });
    shade.onNewChat(() => s.newChat());
    shade.onPanic(() => { s.clearHistory(); s.setInputOpen(false); });
    shade.onSetMode((m: string) => s.setMode(m as any));
    shade.onClickThrough((v: boolean) => s.setClickThrough(v));
    shade.onGhost((v: boolean) => s.setGhost(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (s.inputOpen) {
      shade.setClickThrough(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      shade.setClickThrough(true);
    }
  }, [s.inputOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [s.messages, s.currentAnswer]);

  // peek: hold Alt+Shift to raise opacity temporarily
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey) setPeek(true);
    };
    const up = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey) setPeek(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const runCapture = async () => {
    s.resetAnswer();
    s.setStreaming(true);
    const img = await shade.captureScreenshot();
    const userMsg = { role: "user" as const, content: img ? "[screen captured]" : "[no screen]", ts: Date.now() };
    s.addMessage(userMsg);
    const msgs: any[] = [];
    if (img) msgs.push({ role: "user", content: [{ type: "image_url", image_url: { url: img } }, { type: "text", text: "Answer the question shown on screen." }] });
    else msgs.push({ role: "user", content: "No screen captured. Ask me anything." });
    // include history (prior text turns) — simplified: last 6 text messages
    shade.chat({ messages: msgs, mode: s.mode, webSearch: false });
  };

  runCaptureRef.current = runCapture;
  const submitInput = async () => {
    const text = s.inputText.trim();
    if (!text) { s.setInputOpen(false); return; }
    const prior = s.messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    s.setInputText("");
    s.setInputOpen(false);
    s.resetAnswer();
    s.setStreaming(true);
    s.addMessage({ role: "user", content: text, ts: Date.now() });
    const msgs = [...prior, { role: "user", content: text }];
    shade.chat({ messages: msgs, mode: s.mode, webSearch: false });
  };

  const opacity = peek ? Math.max(s.opacity, 0.55) : s.opacity;
  const ghost = s.ghost;

  return (
    <div className="root" style={{ opacity }}>
      <div className={`panel ${ghost ? "ghost" : ""}`}>
        <header className="hdr">
          <span className="title">Shade AI</span>
          <span className="mode">{s.mode}</span>
          <div className="hdr-actions">
            <button onClick={() => s.newChat()} title="New chat (Alt+Shift+N)">New</button>
            <button onClick={() => { s.clearHistory(); }} title="Clear (Alt+Shift+X)">Clear</button>
          </div>
        </header>

        <div className="chat" ref={scrollRef}>
          {s.messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="role">{m.role === "user" ? "You" : "AI"}</div>
              <div className="body">
                {m.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : <pre>{m.content}</pre>}
              </div>
            </div>
          ))}
          {s.currentAnswer && (
            <div className="msg assistant">
              <div className="role">AI</div>
              <div className="body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{s.currentAnswer}</ReactMarkdown></div>
            </div>
          )}
          {s.streaming && !s.currentAnswer && <div className="thinking">thinking…</div>}
        </div>

        {s.inputOpen && (
          <div className="inputbox">
            <textarea
              ref={inputRef}
              value={s.inputText}
              onChange={(e) => s.setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInput(); }
                if (e.key === "Escape") s.setInputOpen(false);
              }}
              placeholder="Ask anything… (Enter to send, Shift+Enter newline)"
              rows={4}
            />
            <div className="input-actions">
              <button onClick={() => s.setInputOpen(false)}>Cancel</button>
              <button onClick={submitInput} className="primary">Send</button>
            </div>
          </div>
        )}


        {settingsOpen && (
          <div className="modal">
            <div className="modal-card">
              <h3>Settings</h3>
              <label>Gemini API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza... or AQ...." />
              <button onClick={async () => { await shade.setSetting("geminiKey", apiKey); setSettingsOpen(false); }}>Save</button>
              <h4>Hotkeys (no Ctrl)</h4>
              <ul className="hotkeys">
                <li>Alt+Shift+S — Capture screen & solve</li>
                <li>Alt+Shift+Q — Open ask box (multiline)</li>
                <li>Alt+Shift+H — Hide/show overlay</li>
                <li>Alt+Shift+C — Toggle click-through</li>
                <li>Alt+Shift+G — Ghost mode</li>
                <li>Alt+Shift+↑/↓ — Opacity up/down</li>
                <li>Alt+Shift+N — New chat</li>
                <li>Alt+Shift+X — Clear / panic</li>
                <li>F12 — Panic hide</li>
                <li>Alt+Shift+1..4/0 — Mode (code/explain/system/behavioral/auto)</li>
                <li>Hold Alt+Shift — Peek (raise opacity)</li>
                <li>Enter send, Shift+Enter newline, Esc close</li>
              </ul>
              <button onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
          </div>
        )}
        <footer className="ftr">
          <button onClick={runCapture} title="Capture & solve (Alt+Shift+S)">📸 Capture</button>
          <button onClick={() => s.setInputOpen(true)} title="Ask (Alt+Shift+Q)">💬 Ask</button>
          <span className="hint">Alt+Shift+H hide · F12 panic</span>
        </footer>
      </div>
    </div>
  );
}
