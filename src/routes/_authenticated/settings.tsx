import { createFileRoute, Link } from "@tanstack/react-router";
import { OnboardingForm } from "@/components/OnboardingForm";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  return (
    <div>
      <PageHeader title="Company profile" subtitle="Edit anything from onboarding — including re-doing voice calibration." />
      <OnboardingForm
        mode="single"
        onSaved={() => {}}
        ctaLabel="Save changes"
        secondary={<Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Back to projects</Link>}
      />
    </div>
  );
}
