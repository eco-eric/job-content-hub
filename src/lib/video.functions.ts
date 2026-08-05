import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const analyzeWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mediaId: string }) => {
    if (!input?.mediaId || typeof input.mediaId !== "string") throw new Error("mediaId is required");
    return { mediaId: input.mediaId };
  })
  .handler(async ({ data, context }) => {
    const {
      analyzeVideoDirect,
      transcribeMedia,
      documentFromTranscript,
      parseAnalysis,
      ANALYSIS_VERSION,
      MODELS,
    } = await import("@/lib/video.server");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const supabase = context.supabase;

    // RLS scopes this read to the caller's own projects.
    const { data: media } = await supabase
      .from("media")
      .select("id, project_id, url, type")
      .eq("id", data.mediaId)
      .maybeSingle();
    if (!media || media.type !== "video") throw new Error("Video not found.");

    await supabase.from("media").update({ analysis_status: "pending", analysis_error: null }).eq("id", media.id);

    try {
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
