import { supabase } from "@/integrations/supabase/client";
import type { ChannelId, IntentId, AudienceId } from "@/lib/constants";

export type UnresolvedConfirm = { key: string; prompt: string };

export type GenerateResult = {
  headline: string;
  body: string;
  hashtags?: string[];
  flagged_unknowns: UnresolvedConfirm[];
  generation_metadata?: { model: string; prompt_version: string; generated_at: string };
};

export type LengthVariant = "short" | "medium" | "long";
export type ToneOverride = "more_technical" | "more_homeowner";

/**
 * Generation seam — currently a deterministic stub.
 *
 * CONTRACT: any empty Layer-1 project field becomes a [confirm: <key>] token
 * in the body AND an entry in flagged_unknowns. The stub guarantees this; the
 * LLM swap (next prompt) must preserve it.
 */
export async function generateContent(args: {
  projectId: string;
  intent: IntentId;
  channel: ChannelId;
  audience: AudienceId;
  length?: LengthVariant;
  tone?: ToneOverride | null;
}): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("generate-content", { body: args });
  if (error) throw error;
  return data as GenerateResult;
}
