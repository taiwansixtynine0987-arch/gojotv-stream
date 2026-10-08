import type { StreamInsert } from "../types/database";

// Parse episode number from server name strings
// Examples: "Episode 1" → 1, "01" → 1, "Ep 5" → 5
export function parseEpisodeNumber(name: string): number | null {
  const m = name.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Build a StreamInsert row
export function buildStreamInsert(params: {
  episodeId: string;
  provider: "anivexa" | "tatakai" | "external";
  url: string;
  language: "sub" | "dub" | "hindi" | "tamil" | "telugu" | "bengali" | "raw";
  serverName: string;
  sourceSlug: string | null;
}): StreamInsert {
  return {
    episode_id: params.episodeId,
    provider: params.provider,
    url: params.url,
    language: params.language,
    quality: "auto",
    format: "embed",
    status: "active",
    health_score: 100,
    fail_count: 0,
    is_primary: false,
    server_name: params.serverName,
    source_slug: params.sourceSlug,
    link_expires_at: null,
  };
}

// Build idempotency key
export function makeKey(
  episodeId: string,
  provider: string,
  serverName: string,
  language: string
): string {
  return `${episodeId}|${provider}|${serverName}|${language}`;
}

// Run tasks in batches with concurrency limit
export async function batch<T>(
  tasks: (() => Promise<T>)[],
  size: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const chunk = tasks.slice(i, i + size);
    const chunkResults = await Promise.all(chunk.map((t) => t()));
    results.push(...chunkResults);
  }
  return results;
}
