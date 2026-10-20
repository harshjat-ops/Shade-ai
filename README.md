# Shade AI

A transparent, stealthy, general-purpose AI assistant overlay (Electron).

## Features
- Transparent, always-on-top, click-through overlay (default opacity ~0.15)
- Invisible to screen capture/sharing (content protection in production)
- Global hotkeys — no Ctrl/Cmd to avoid browser conflicts
- Multimodal: screenshot + audio + typed questions (multiline, ~10 lines)
- Multi-turn conversation history
- General-purpose answers (code, system design, behavioral, math, anything)
- Ghost mode, peek-on-hold, panic hotkey, clear history

## Hotkeys
| Key | Action |
|---|---|
| Alt+Shift+S | Capture screen & solve |
| Alt+Shift+Q | Open ask box (multiline) |
| Alt+Shift+H | Hide/show |
| Alt+Shift+C | Toggle click-through |
| Alt+Shift+G | Ghost mode |
| Alt+Shift+Up/Down | Opacity |
| Alt+Shift+N | New chat |
| Alt+Shift+X | Clear / panic |
| F12 | Panic hide |
| Alt+Shift+1..4,0 | Mode (code/explain/system/behavioral/auto) |
| Hold Alt+Shift | Peek (raise opacity) |

In the ask box: Enter sends, Shift+Enter newline, Esc closes.

## Setup
```bash
npm install
cp .env.example .env   # add OPENAI_API_KEY
npm run dev
```
Or set the key in-app via ⚙ Settings.

## Build
```bash
npm run build
```
