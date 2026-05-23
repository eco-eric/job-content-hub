import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OnboardingForm } from "@/components/OnboardingForm";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const nav = useNavigate();
  return (
    <div>
      <PageHeader
        title="Set up your company"
        subtitle="One time only. We use this so generated content actually sounds like your company."
      />
      <OnboardingForm onSaved={() => nav({ to: "/dashboard" })} ctaLabel="Save and continue" />
    </div>
  );
}