import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Card, Chip, SecondaryButton } from "@/components/AppShell";
import { PHOTO_TAGS } from "@/lib/constants";
import { Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/photos")({
  component: Photos,
});

function Photos() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tag, setTag] = useState<(typeof PHOTO_TAGS)[number]>("before");
  const [busy, setBusy] = useState(false);

  const photosQ = useQuery({
    queryKey: ["media", projectId],
    queryFn: async () => (await supabase.from("media").select("*").eq("project_id", projectId).order("created_at")).data ?? [],
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photosQ.data ?? []) {
        const { data } = await supabase.storage.from("project-photos").createSignedUrl(p.url, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      setUrls(next);
    })();
  }, [photosQ.data]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setBusy(true);
    const path = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("project-photos").upload(path, file);
    if (!up.error) {
      await supabase.from("media").insert({ project_id: projectId, url: path, type: "image", tag });
      qc.invalidateQueries({ queryKey: ["media", projectId] });
    }
    setBusy(false);
    e.target.value = "";
  };

  const remove = async (id: string, path: string) => {
    await supabase.storage.from("project-photos").remove([path]);
    await supabase.from("media").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["media", projectId] });
  };

  return (
    <div>
      <PageHeader title="Photos" subtitle="Tag each photo so generated content can reference the right ones."
        right={<Link to="/projects/$projectId" params={{ projectId }}><SecondaryButton>Back</SecondaryButton></Link>} />
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          {PHOTO_TAGS.map(t => <Chip key={t} active={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-card px-4 py-3 hover:bg-accent text-sm font-medium">
          <Upload className="h-4 w-4" /> {busy ? "Uploading…" : `Upload ${tag} photo`}
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {(photosQ.data ?? []).map(p => (
          <div key={p.id} className="rounded-lg border border-border overflow-hidden bg-card">
            {urls[p.id] && <img src={urls[p.id]} alt={p.tag} className="w-full h-48 object-cover" />}
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{p.tag}</span>
              <button onClick={() => remove(p.id, p.url)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
