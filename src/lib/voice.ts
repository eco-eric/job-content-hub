// Minimal SpeechRecognition wrapper. Returns null if browser unsupported.
export type VoiceRecognizer = {
  start: () => void;
  stop: () => void;
  supported: boolean;
};

type SRConstructor = new () => SpeechRecognition;

export function createRecognizer(onResult: (text: string) => void): VoiceRecognizer {
  if (typeof window === "undefined") return { start: () => {}, stop: () => {}, supported: false };
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return { start: () => {}, stop: () => {}, supported: false };
  const r = new SR();
  r.continuous = false;
  r.interimResults = false;
  r.lang = "en-US";
  r.onresult = (e: SpeechRecognitionEvent) => {
    const t = e.results[0]?.[0]?.transcript ?? "";
    if (t) onResult(t);
  };
  return {
    start: () => { try { r.start(); } catch { /* already started */ } },
    stop: () => { try { r.stop(); } catch { /* not started */ } },
    supported: true,
  };
}