import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Intent = Database["public"]["Enums"]["content_intent"];
type Channel = Database["public"]["Enums"]["content_channel"];

export type UnresolvedConfirm = { key: string; prompt: string };

export type GenerateResult = {
  title: string;
  body_md: string;
  unresolved_confirms: UnresolvedConfirm[];
};

/**
 * Generation seam.
 *
 * CRITICAL CONTRACT: This function (and the Edge Function it calls) MUST NOT
 * invent facts. Brands, model numbers, prices, warranty terms, timelines —
 * if not captured in answers/profile, the output MUST surface
 * `[confirm: …]` tokens AND list them in `unresolved_confirms`.
 *
 * The Edge Function `generate-content` is the seam where an LLM can later be
 * plugged in. Today it returns a deterministic mock that still respects
 * the no-invented-facts rule.
 */
export async function generateContent(args: {
  projectId: string;
  intent: Intent;
  channel: Channel;
}): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("generate-content", {
    body: args,
  });
  if (error) throw error;
  return data as GenerateResult;
}