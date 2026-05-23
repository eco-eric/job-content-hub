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

  const companyQ = useQuery({
    enabled: !!user,
    queryKey: ["company", user?.id],
    queryFn: async () => (await supabase.from("companies").select("*").eq("owner_user_id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (!user || companyQ.isLoading) return;
    const c = companyQ.data;
    const examples = Array.isArray(c?.voice_examples) ? c!.voice_examples : [];
    const onboarded = c && c.name && examples.length > 0;
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (!onboarded && path !== "/onboarding" && path !== "/settings") {
      nav({ to: "/onboarding" });
    }
  }, [user, companyQ.isLoading, companyQ.data, nav]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
