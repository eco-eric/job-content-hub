import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const analyzeWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mediaId: string; onlySegments?: number[] }) => {
    if (!input?.mediaId || typeof input.mediaId !== "string") throw new Error("mediaId is required");
    const only = Array.isArray(input.onlySegments)
      ? input.onlySegments.filter((n) => typeof n === "number" && Number.isFinite(n))
      : undefined;
    return { mediaId: input.mediaId, onlySegments: only };
  })
  .handler(async ({ data, context }) => {
    const {
      analyzeVideoDirect,
      transcribeMedia,
      documentFromTranscript,
      parseAnalysis,
      mergeSegmentAnalyses,
      ANALYSIS_VERSION,
      MODELS,
    } = await import("@/lib/video.server");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const supabase = context.supabase;

    // RLS scopes this read to the caller's own projects.
    const { data: media } = await supabase
      .from("media")
      .select("id, project_id, url, type, segments, segment_count, analysis")
      .eq("id", data.mediaId)
      .maybeSingle();
    if (!media || media.type !== "video") throw new Error("Video not found.");

    await supabase.from("media").update({ analysis_status: "pending", analysis_error: null }).eq("id", media.id);

    try {
      type StoredSegment = { index: number; path: string; start_seconds: number; duration_seconds: number };
      const stored = (Array.isArray(media.segments) ? media.segments : []) as unknown as StoredSegment[];

      // ---- Multi-segment path: long recordings prepared in the browser ----
      if (stored.length > 0) {
        const previous = ((media.analysis ?? {}) as { segments?: Array<Record<string, unknown>> }).segments ?? [];
        const byIndex = new Map<number, Record<string, unknown>>(
          previous.map((p) => [Number(p["index"]), p]),
        );

        const results: Array<{ index: number; start_seconds: number; parsed?: ReturnType<typeof parseAnalysis>; error?: string }> = [];

        for (const seg of [...stored].sort((a, b) => a.index - b.index)) {
          const cached = byIndex.get(seg.index);
          const retryOnly = data.onlySegments && data.onlySegments.length > 0;
          const shouldRun = !retryOnly || data.onlySegments!.includes(seg.index);
          if (!shouldRun && cached?.["parsed"]) {
            results.push({ index: seg.index, start_seconds: seg.start_seconds, parsed: cached["parsed"] as ReturnType<typeof parseAnalysis> });
            continue;
          }
          try {
            const dl = await supabase.storage.from("project-videos").download(seg.path);
            if (dl.error || !dl.data) throw new Error("Could not read that part of the recording.");
            const bytes = new Uint8Array(await dl.data.arrayBuffer());
            const mime = dl.data.type || "video/webm";
            const raw = await analyzeVideoDirect(apiKey, bytes, mime, { index: seg.index, total: stored.length });
            results.push({ index: seg.index, start_seconds: seg.start_seconds, parsed: parseAnalysis(raw, "") });
          } catch (segErr) {
            const message = segErr instanceof Error ? segErr.message : String(segErr);
            console.error(`segment ${seg.index} failed:`, message);
            results.push({ index: seg.index, start_seconds: seg.start_seconds, error: message });
          }
        }

        if (!results.some((r) => r.parsed)) {
          throw new Error(results[0]?.error ?? "None of the parts could be analyzed.");
        }

        const merged = mergeSegmentAnalyses(results);
        const analysis = {
          ...merged,
          source: "video" as const,
          model: MODELS.video,
          version: ANALYSIS_VERSION,
          analyzed_at: new Date().toISOString(),
          segments: results.map((r) => ({
            index: r.index,
            start_seconds: r.start_seconds,
            status: r.parsed ? "ready" : "error",
            error: r.error ?? null,
            parsed: r.parsed ?? null,
          })),
        };

        await supabase
          .from("media")
          .update({
            analysis_status: "ready",
            analysis_error: null,
            transcript: merged.transcript,
            analysis,
            analyzed_at: new Date().toISOString(),
          })
          .eq("id", media.id);

        return analysis;
      }

      // ---- Single-clip path ----
      const dl = await supabase.storage.from("project-videos").download(media.url);
      if (dl.error || !dl.data) throw new Error("Could not read the uploaded video.");
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const mime = dl.data.type || "video/mp4";

      let raw: string;
      let transcript = "";
      let source: "video" | "audio-only" = "video";
      let model = MODELS.video;
      try {
        raw = await analyzeVideoDirect(apiKey, bytes, mime);
      } catch (videoErr) {
        // Some containers/models reject direct video: fall back to the audio track.
        console.error("video understanding failed, falling back to transcript:", videoErr instanceof Error ? videoErr.message : String(videoErr));
        transcript = await transcribeMedia(apiKey, bytes, mime);
        raw = await documentFromTranscript(apiKey, transcript);
        source = "audio-only";
        model = `${MODELS.transcribe} + ${MODELS.video}`;
      }

      const parsed = parseAnalysis(raw, transcript);
      const analysis = { ...parsed, source, model, version: ANALYSIS_VERSION, analyzed_at: new Date().toISOString() };

      await supabase
        .from("media")
        .update({
          analysis_status: "ready",
          analysis_error: null,
          transcript: parsed.transcript,
          analysis,
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", media.id);

      return analysis;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabase.from("media").update({ analysis_status: "error", analysis_error: message }).eq("id", media.id);
      throw new Error(message);
    }
  });
