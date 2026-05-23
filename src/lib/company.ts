import { supabase } from "@/integrations/supabase/client";

export async function ensureCompany(userId: string) {
  const { data: existing } = await supabase
    .from("companies")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("companies")
    .insert({ owner_user_id: userId, name: "", trade: "HVAC" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
