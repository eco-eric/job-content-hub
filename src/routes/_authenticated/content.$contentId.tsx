import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/AppShell";
import { INTENTS, CHANNELS } from "@/lib/constants";
import { Copy, Download, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/content/$contentId")({
  component: ContentEditor,
});

function ContentEditor() {
  const { contentId } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["content-item", contentId],
    queryFn: async () => (await supabase.from("content_items").select("*").eq("id", contentId).single()).data,
  });
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (!q.data) return;
    setBody(q.data.body_md ?? "");
    setTitle(q.data.title ?? "");
  }, [q.data]);

  if (q.isLoading || !q.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const c = q.data;
  const intent = INTENTS.find(i => i.id === c.intent)?.label ?? c.intent;
  const channel = CHANNELS.find(ch => ch.id === c.channel)?.label ?? c.channel;
  const confirms = ((c.unresolved_confirms as unknown) as Array<{ key: string; prompt: string }>) ?? [];
  const remainingConfirms = confirms.filter(cf => body.includes(`[confirm: ${cf.key}]`) || body.includes(`[confirm:${cf.key}]`));

  const saveDraft = async () => {
    await supabase.from("content_items").update({ body_md: body, title }).eq("id", contentId);
    qc.invalidateQueries({ queryKey: ["content-item", contentId] });
  };
  const approve = async () => {
    await supabase.from("content_items").update({ body_md: body, title, status: "approved", approved_at: new Date().toISOString() }).eq("id", contentId);
    qc.invalidateQueries({ queryKey: ["content-item", contentId] });
  };
  const copyText = async () => {
    await navigator.clipboard.writeText(`${title}\n\n${body}`);
  };
  const download = async () => {
    await supabase.from("content_items").update({ status: "exported", exported_at: new Date().toISOString() }).eq("id", contentId);
    const blob = new Blob([`# ${title}\n\n${body}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(title || "content").replace(/\W+/g, "-").toLowerCase()}.md`;
    a.click(); URL.revokeObjectURL(url);
    qc.invalidateQueries({ queryKey: ["content-item", contentId] });
  };

  return (
    <div>
      <PageHeader title={intent + " · " + channel}
        subtitle="Edit freely. Resolve any [confirm: …] markers before exporting."
        right={<div className="flex items-center gap-2"><StatusBadge status={c.status} />
          <Link to="/projects/$projectId" params={{ projectId: c.project_id }}><SecondaryButton>Project</SecondaryButton></Link></div>} />

      {remainingConfirms.length > 0 && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <div className="font-medium">Unresolved facts ({remainingConfirms.length})</div>
              <p className="text-sm text-muted-foreground mt-1">The generator didn't have these — fill them in (or remove the placeholder) before approving.</p>
              <ul className="mt-2 text-sm list-disc pl-5">
                {remainingConfirms.map(cf => <li key={cf.key}><code className="text-foreground">[confirm: {cf.key}]</code> — {cf.prompt}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full text-lg font-medium rounded-md border border-input bg-card px-3 py-3 mb-3" placeholder="Title" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18}
          className="w-full rounded-md border border-input bg-card px-3 py-3 text-base font-mono leading-relaxed" />
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <PrimaryButton onClick={saveDraft}>Save draft</PrimaryButton>
        <SecondaryButton onClick={approve} disabled={remainingConfirms.length > 0}>Approve</SecondaryButton>
        <SecondaryButton onClick={copyText}><Copy className="h-4 w-4" /> Copy</SecondaryButton>
        <SecondaryButton onClick={download}><Download className="h-4 w-4" /> Download .md</SecondaryButton>
      </div>
    </div>
  );
}