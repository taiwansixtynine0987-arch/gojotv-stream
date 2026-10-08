import type { AnivexaWatchResponse, AnivexaStream } from "../types/anivexa";

interface FetchAnivexaArgs {
  baseUrl: string;
  provider: string; // "anikoto" | "animegg"
  anilistId: number;
  audio: "sub" | "dub";
  episode: number;
  timeoutMs: number;
}

export async function fetchAnivexaStream(
  args: FetchAnivexaArgs
): Promise<AnivexaStream | null> {
  const { baseUrl, provider, anilistId, audio, episode, timeoutMs } = args;

  const url = `${baseUrl}/watch/${provider}/${anilistId}/${audio}/${provider}-${episode}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as AnivexaWatchResponse;

    if (data.error || !data.streams || data.streams.length === 0) {
      return null;
    }

    // Prefer an "embed" type stream (with embedUrl field)
    const embedStream = data.streams.find(
      (s) => s.embedUrl && s.isActive !== false
    );
    if (embedStream && embedStream.embedUrl) {
      return {
        url: embedStream.embedUrl,
        type: "embed",
        server: embedStream.server,
        referer: embedStream.referer,
        priority: embedStream.priority,
        isActive: true,
        subtitles: embedStream.subtitles,
      };
    }

    // Fallback: first active stream
    const activeStream = data.streams.find((s) => s.isActive !== false);
    return activeStream ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
