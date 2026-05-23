import { useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { createRecognizer } from "@/lib/voice";
import { cn } from "@/lib/utils";

type Common = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  onBlur?: () => void;
};

export function VoiceField({
  multiline = false,
  rows = 4,
  className,
  ...p
}: Common & { multiline?: boolean; rows?: number; className?: string }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<ReturnType<typeof createRecognizer> | null>(null);

  const toggle = () => {
    if (!recRef.current) {
      recRef.current = createRecognizer((t) => {
        p.onChange(p.value ? p.value.trimEnd() + " " + t : t);
        setListening(false);
      });
    }
    if (!recRef.current.supported) return;
    if (listening) { recRef.current.stop(); setListening(false); }
    else { recRef.current.start(); setListening(true); }
  };

  const supported = createRecognizer(() => {}).supported;

  return (
    <div className={cn("space-y-2", className)}>
      {p.label && <label className="block text-sm font-medium text-foreground">{p.label}</label>}
      <div className="relative">
        {multiline ? (
          <textarea
            value={p.value}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onBlur}
            placeholder={p.placeholder}
            rows={rows}
            className="w-full rounded-md border border-input bg-card px-3 py-3 pr-14 text-base focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        ) : (
          <input
            value={p.value}
            onChange={(e) => p.onChange(e.target.value)}
            onBlur={p.onBlur}
            placeholder={p.placeholder}
            className="w-full rounded-md border border-input bg-card px-3 py-3 pr-14 text-base focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
        {supported && (
          <button
            type="button"
            onClick={toggle}
            aria-label={listening ? "Stop dictating" : "Dictate"}
            className={cn(
              "absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors",
              listening
                ? "bg-primary text-primary-foreground border-primary animate-pulse"
                : "bg-card text-muted-foreground border-input hover:text-foreground",
            )}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
      </div>
      {p.hint && <p className="text-xs text-muted-foreground">{p.hint}</p>}
    </div>
  );
}