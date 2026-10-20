import { create } from "zustand";

export type Mode = "auto" | "code" | "explain" | "system" | "behavioral";
export type Msg = { role: "user" | "assistant"; content: string; ts: number };

interface State {
  messages: Msg[];
  mode: Mode;
  inputOpen: boolean;
  inputText: string;
  streaming: boolean;
  currentAnswer: string;
  opacity: number;
  ghost: boolean;
  clickThrough: boolean;
  addMessage: (m: Msg) => void;
  appendAssistant: (t: string) => void;
  finalizeAssistant: () => void;
  clearHistory: () => void;
  newChat: () => void;
  setMode: (m: Mode) => void;
  setInputOpen: (v: boolean) => void;
  setInputText: (t: string) => void;
  setStreaming: (v: boolean) => void;
  resetAnswer: () => void;
  setOpacity: (v: number) => void;
  setGhost: (v: boolean) => void;
  setClickThrough: (v: boolean) => void;
}

export const useStore = create<State>((set) => ({
  messages: [],
  mode: "auto",
  inputOpen: false,
  inputText: "",
  streaming: false,
  currentAnswer: "",
  opacity: 0.3,
  ghost: false,
  clickThrough: true,
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  appendAssistant: (t) => set((s) => ({ currentAnswer: s.currentAnswer + t })),
  finalizeAssistant: () => set((s) => {
    const msgs = s.currentAnswer ? [...s.messages, { role: "assistant" as const, content: s.currentAnswer, ts: Date.now() }] : s.messages;
    return { messages: msgs, currentAnswer: "", streaming: false };
  }),
  clearHistory: () => set({ messages: [], currentAnswer: "" }),
  newChat: () => set({ messages: [], currentAnswer: "" }),
  setMode: (m) => set({ mode: m }),
  setInputOpen: (v) => set({ inputOpen: v }),
  setInputText: (t) => set({ inputText: t }),
  setStreaming: (v) => set({ streaming: v }),
  resetAnswer: () => set({ currentAnswer: "" }),
  setOpacity: (v) => set({ opacity: v }),
  setGhost: (v) => set({ ghost: v }),
  setClickThrough: (v) => set({ clickThrough: v }),
}));
