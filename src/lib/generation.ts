import { supabase } from "@/integrations/supabase/client";

export type UnresolvedConfirm = { key: string; prompt: string };

export type GenerateResult = {
  headline: string;
  body: string;
  flagged_unknowns: UnresolvedConfirm[];
};

/**
 * Generation seam.
 *
 * CRITICAL CONTRACT: the edge function MUST NOT invent facts. For any empty
 * Layer-1 field on the project, the generated body contains `[confirm: key]`
 * tokens and `flagged_unknowns` lists each one. Swap the edge function body
 * for an LLM later — keep this contract intact.
 */
export async function generateContent(args: {
  projectId: string;
  intent: string;
  channel: string;
}): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke("generate-content", { body: args });
  if (error) throw error;
  return data as GenerateResult;
}
