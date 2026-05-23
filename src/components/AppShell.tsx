import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { LogOut } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-semibold tracking-tight">
            <span className="text-primary">●</span> Content Studio
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/dashboard"
              className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground"
              activeProps={{ className: "px-3 py-2 rounded-md text-foreground font-medium" }}
            >
              Projects
            </Link>
            <Link
              to="/library"
              className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground"
              activeProps={{ className: "px-3 py-2 rounded-md text-foreground font-medium" }}
            >
              Library
            </Link>
            <Link
              to="/settings"
              className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground"
              activeProps={{ className: "px-3 py-2 rounded-md text-foreground font-medium" }}
            >
              Settings
            </Link>
            {user && (
              <button
                onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                aria-label="Sign out"
                className="ml-2 inline-flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"rounded-lg border border-border bg-card p-5 " + className}>{children}</div>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={
        "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors " +
        className
      }
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={
        "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors " +
        className
      }
    />
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center rounded-full border px-4 py-2 text-sm transition-colors " +
        (active
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-card border-input text-foreground hover:border-foreground/40")
      }
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    approved: "bg-primary/10 text-primary",
    exported: "bg-foreground text-background",
    triaging: "bg-muted text-muted-foreground",
    interviewing: "bg-primary/10 text-primary",
    in_progress: "bg-primary/10 text-primary",
    ready: "bg-primary/10 text-primary",
    archived: "bg-muted text-muted-foreground line-through",
  };
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " + (tone[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}