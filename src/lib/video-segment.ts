// Browser-only: cut a long walkthrough recording into short, low-bitrate segments
// that fit inside a single AI request. The original file is never modified.

export const SEGMENT_SECONDS = 90;
export const MAX_SOURCE_SECONDS = 10 * 60 + 30;
export const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
export const MAX_SEGMENT_BYTES = 18 * 1024 * 1024;

export type Segment = { index: number; start_seconds: number; duration_seconds: number; blob: Blob };

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function canSegment(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.createElement("video") as HTMLVideoElement & { captureStream?: () => MediaStream };
  return typeof el.captureStream === "function" && !!pickMime();
}

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve) => el.addEventListener(event, () => resolve(), { once: true }));
}

/**
 * Re-encodes the clip in real time through a downscaled canvas, restarting the
 * recorder every SEGMENT_SECONDS. Runs entirely in the browser tab.
 */
export async function segmentVideo(
  file: File,
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<Segment[]> {
  const mime = pickMime();
  if (!mime) throw new Error("This browser can't prepare long clips. Record a shorter one (under 2 minutes).");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as HTMLVideoElement & { captureStream: () => MediaStream };
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await Promise.race([
      once(video, "loadedmetadata"),
      once(video, "error").then(() => { throw new Error("That video couldn't be read in this browser."); }),
    ]);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error("That video's length couldn't be read.");

    const total = Math.max(1, Math.ceil(duration / SEGMENT_SECONDS));

    // Downscale to at most 720p on the long edge to keep each segment small.
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth || 1280, video.videoHeight || 720));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round((video.videoWidth || 1280) * scale));
    canvas.height = Math.max(2, Math.round((video.videoHeight || 720) * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't prepare long clips.");

    const sourceStream = video.captureStream();
    const stream = canvas.captureStream(15);
    for (const track of sourceStream.getAudioTracks()) stream.addTrack(track);

    let drawing = true;
    const draw = () => {
      if (!drawing) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

    const segments: Segment[] = [];

    for (let index = 0; index < total; index++) {
      if (opts.signal?.aborted) throw new Error("Preparation cancelled.");
      const start = index * SEGMENT_SECONDS;
      const end = Math.min(duration, start + SEGMENT_SECONDS);

      if (Math.abs(video.currentTime - start) > 0.25) {
        video.currentTime = start;
        await once(video, "seeked");
      }

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 800_000,
        audioBitsPerSecond: 64_000,
      });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
      recorder.start(1000);
      await video.play();

      await new Promise<void>((resolve) => {
        const check = () => {
          if (opts.signal?.aborted || video.ended || video.currentTime >= end - 0.05) { resolve(); return; }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });

      video.pause();
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (blob.size > MAX_SEGMENT_BYTES) {
        throw new Error("A prepared segment came out too large. Try recording at a lower resolution.");
      }
      segments.push({ index, start_seconds: Math.round(start), duration_seconds: Math.round(end - start), blob });
      opts.onProgress?.(index + 1, total);
    }

    drawing = false;
    for (const track of stream.getTracks()) track.stop();
    return segments;
  } finally {
    video.pause();
    video.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}
