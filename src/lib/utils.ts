import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Readable message for anything thrown — Error, Supabase error object, string. */
export function errorMessage(e: unknown): string {
  if (!e) return "Something went wrong.";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (parts.length) return parts.join(" — ");
    try {
      return JSON.stringify(e);
    } catch {
      return "Something went wrong.";
    }
  }
  return String(e);
}
