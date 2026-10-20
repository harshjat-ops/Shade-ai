import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("shade", {
  captureScreenshot: () => ipcRenderer.invoke("capture:screenshot"),
  chat: (payload: any) => ipcRenderer.invoke("llm:chat", payload),
  onDelta: (cb: (t: string) => void) => ipcRenderer.on("llm:delta", (_e, t) => cb(t)),
  onDone: (cb: () => void) => ipcRenderer.on("llm:done", () => cb()),
  onError: (cb: (e: string) => void) => ipcRenderer.on("llm:error", (_e, e) => cb(e)),
  onOpenInput: (cb: () => void) => ipcRenderer.on("action:openInput", () => cb()),
  onCapture: (cb: () => void) => ipcRenderer.on("action:capture", () => cb()),
  onNewChat: (cb: () => void) => ipcRenderer.on("action:newChat", () => cb()),
  onPanic: (cb: () => void) => ipcRenderer.on("action:panic", () => cb()),
  onSetMode: (cb: (m: string) => void) => ipcRenderer.on("action:setMode", (_e, m) => cb(m)),
  onClickThrough: (cb: (v: boolean) => void) => ipcRenderer.on("state:clickThrough", (_e, v) => cb(v)),
  onGhost: (cb: (v: boolean) => void) => ipcRenderer.on("state:ghost", (_e, v) => cb(v)),
  setClickThrough: (v: boolean) => ipcRenderer.invoke("win:setClickThrough", v),
  getSetting: (k: string) => ipcRenderer.invoke("settings:get", k),
  setSetting: (k: string, v: any) => ipcRenderer.invoke("settings:set", k, v),
});
