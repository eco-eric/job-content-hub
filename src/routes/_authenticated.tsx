import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  const profileQ = useQuery({
    enabled: !!user,
    queryKey: ["company_profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("company_profile").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!user || profileQ.isLoading) return;
    const onboarded = profileQ.data && profileQ.data.company_name && profileQ.data.voice_sample;
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (!onboarded && path !== "/onboarding" && path !== "/settings") {
      nav({ to: "/onboarding" });
    }
  }, [user, profileQ.isLoading, profileQ.data, nav]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}