# Long walkthroughs: auto-split into segments

Today a clip is rejected if it is over 2 minutes or 20 MB. For 2-5 minute walkthroughs that's the wrong
limit — the app should take the whole recording and handle the splitting for you.

## What changes for you

1. **Upload any walkthrough up to ~10 minutes.** The original file is stored intact, exactly as recorded.
2. **The app prepares analysis segments itself.** Right after upload it quietly cuts the recording into
   ~90-second pieces at a lower resolution (analysis-only — your original is untouched). You see a
   progress bar: "Preparing segment 2 of 4".
3. **One "Analyze walkthrough" button, one result.** Each segment is analyzed in turn, then merged into a
   single document with continuous timestamps ([04:12] means 4:12 into the full recording, not into
   segment 3), one combined set of suggested interview answers, and one de-duplicated "Needs confirming"
   list.
4. **Nothing is silently lost.** If one segment fails, the document still assembles from the rest and that
   gap is called out explicitly, with a "Retry segment" action.
5. **Costs stay visible.** Before analyzing, the screen says how many segments will be sent, so a 5-minute
   clip never surprises you.

## Trade-off you should know

Segmenting happens in your browser and runs roughly in real time — a 4-minute clip takes about 4 minutes
to prepare before analysis starts, and the tab has to stay open. This is the price of not shipping a
30 MB video toolkit into a phone browser. Analysis itself then runs server-side, a few seconds per segment.

## Technical notes

- **Storage**: original uploads to `project-videos` as today; the derived segments go to a
  `segments/<mediaId>/NN.webm` prefix under the same owner-scoped path so existing RLS policies cover them.
  Segments are deleted after a successful merge.
- **Segmenting**: a hidden `<video>` played through `captureStream()` into `MediaRecorder`
  (`video/webm;codecs=vp9,opus`, downscaled to 720p, capped bitrate), stopped and restarted every 90 s.
  Each segment lands well under the 20 MB inline limit. Feature-detect `captureStream`; on a browser that
  lacks it, fall back to today's behaviour (single clip, size-limited) with a clear message.
- **Schema**: add `media.segments jsonb` (array of `{index, path, start_seconds, duration_seconds, status}`)
  and `media.segment_count int`. No new tables.
- **Server function**: `analyzeWalkthrough` in `src/lib/video.functions.ts` gains a segment loop — for each
  segment it runs the existing `analyzeVideoDirect` (same prompt, same `[confirm: ...]` hard rule), passing
  the segment's start offset so the model's `[mm:ss]` markers are rebased on merge.
- **Merging** (new helper in `src/lib/video.server.ts`): concatenate transcripts and `## Walkthrough`
  bullets in order with rebased timestamps; for the scalar interview fields, take the first non-empty value
  per field and append later ones as additional sentences rather than overwriting; union `equipment_used`
  and `materials_used`; de-duplicate `open_questions` case-insensitively.
- **Timeouts**: segments are analyzed sequentially with per-segment status written back to
  `media.segments`, so a long run reports progress and a partial failure is recoverable without re-running
  the whole recording.
- **Limits**: 10 minutes / ~200 MB on the original; anything longer is still refused with a plain message.

## Not in this scope

- Manually choosing which parts of the clip to keep (that's the separate "clip builder" idea).
- Server-side transcoding — the Worker runtime cannot run ffmpeg.
- Extracting still frames from the video as project photos.
