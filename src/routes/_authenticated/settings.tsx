import { createFileRoute, Link } from "@tanstack/react-router";
import { OnboardingForm } from "@/components/OnboardingForm";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  component: Settings,
});

function Settings() {
  return (
    <div>
      <PageHeader title="Company profile" subtitle="Your trade context, service lines, differentiators, voice." />
      <OnboardingForm onSaved={() => {}} ctaLabel="Save changes"
        secondary={<Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Back to projects</Link>} />
    </div>
  );
}