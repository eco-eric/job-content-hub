# Video Walkthrough Analysis

## Short answer first
Right now the app does **not** analyze video at all. The only AI in the project is the text
generator (Anthropic Claude) that writes content from your typed/spoken interview answers.
The `media` table can store a row tagged `video`, but nothing ever looks at the file.

To analyze video we would add Lovable AI's Gemini multimodal model, which can watch the
picture and listen to your narration in one pass — that is the right tool for
"me walking through a house, talking".

## What this adds

**1. Upload a walkthrough video to a project**
- New private storage bucket for videos, owner-scoped like the photo bucket.
- Upload control on the project screen: pick/record a clip, ≤2 minutes, ≤20 MB.
- The file is recorded in the existing `media` table with `type = 'video'`.

**2. Analyze it**
- One "Analyze walkthrough" action runs a server function that sends the clip to Gemini
  with a walkthrough-specific prompt: transcribe what you say, describe what is visibly
  shown, and keep them tied to timestamps.
- The same hard rule as the rest of the app applies: **no invented facts**. Brands, model
  numbers, sizes, dates — if it is not clearly said or clearly visible, the output writes
  `[confirm: ...]` instead of guessing.

**3. Two outputs (as you chose)**
- **Walkthrough document** — a timestamped Markdown doc (Overview, Walkthrough by timestamp,
  Equipment / conditions observed, Open questions) saved as a content asset so it shows up
  in your Library and opens in the existing editor, where `[confirm: ...]` items are
  resolved the same way as today.
- **Interview pre-fill** — the model also returns draft values for the project fields
  (before state, scope performed, outcome, equipment used, unusual details, lesson learned,
  customer quote). These land in the interview as **suggestions you approve or edit**, never
  silently written over anything you already typed.

**4. Status and cost control**
- The analysis result is stored on the media row, so re-opening a project does not re-run
  (and re-bill) the analysis. A "Re-analyze" button is available if you change the clip.
- Clear errors for over-length clips, out-of-credits, and rate limits — no silent failures.

## Technical notes
- Model: `google/gemini-3.6-flash` via the Lovable AI Gateway (accepts video + audio input);
  no extra API key needed. If a clip's audio matters more than the visuals, the same server
  function can fall back to the gateway transcription endpoint.
- Boundary: a new `createServerFn` in `src/lib/video.functions.ts` with
  `requireSupabaseAuth`; the existing `generate-content` edge function is untouched.
- Migration: new `media` columns for analysis status, transcript, structured findings, and
  analyzed-at, plus the new storage bucket and its owner-scoped policies.
- The structured return uses a small, unconstrained schema and is validated in code, so a
  malformed response degrades to "review manually" instead of crashing.
- Limits are enforced client-side (duration/size) before upload so you find out immediately.

## Not in this scope
- Videos longer than 2 minutes (would need chunking).
- Auto-extracting still frames from the video as project photos.
