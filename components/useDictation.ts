"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/rules/types";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const TAG: Record<Lang, string> = { es: "es-MX", zh: "zh-CN", en: "en-US" };

/** Browser dictation. The mic is offered only where the browser supports it; typing is always the path. */
export function useDictation(lang: Lang, onText: (s: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = TAG[lang];
    r.continuous = false;
    r.interimResults = true;
    const field = document.querySelector<HTMLTextAreaElement>("#opener");
    base.current = field?.value ? `${field.value.trim()} ` : "";
    r.onresult = (e) => onText(base.current + Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      setSupported(false);
    };
    rec.current = r;
    setListening(true);
    r.start();
  }, [lang, listening, onText]);

  return { supported, listening, toggle };
}
