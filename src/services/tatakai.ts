import type {
  HindiDubbedSearchResponse,
  HindiDubbedAnimeResponse,
  HindiDubbedServer,
  DesiDubSearchResponse,
  DesiDubWatchResponse,
  DesiDubSource,
} from "../types/tatakai";

// ============================================================
// HELPER: fetch with timeout
// ============================================================
async function fetchJson<T>(
  url: string,
  timeoutMs: number
): Promise<T | null> {
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
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// HINDI DUBBED (animehindidubbed)
// ============================================================

export async function searchHindiDubbed(
  baseUrl: string,
  title: string,
  timeoutMs: number
): Promise<{ slug: string; title: string } | null> {
  const url = `${baseUrl}/api/v1/hindidubbed/search?title=${encodeURIComponent(title)}`;
  const data = await fetchJson<HindiDubbedSearchResponse>(url, timeoutMs);

  if (!data || !data.data || !data.data.animeList?.length) return null;

  // Best match: exact title (case-insensitive) or first result
  const normalized = title.trim().toLowerCase();
  const exact = data.data.animeList.find(
    (a) => a.title.trim().toLowerCase() === normalized
  );
  const pick = exact ?? data.data.animeList[0];

  return { slug: pick.slug, title: pick.title };
}

export async function fetchHindiDubbedServers(
  baseUrl: string,
  slug: string,
  timeoutMs: number
): Promise<{
  filemoon: HindiDubbedServer[];
  servabyss: HindiDubbedServer[];
}> {
  const url = `${baseUrl}/api/v1/hindidubbed/anime/${slug}`;
  const data = await fetchJson<HindiDubbedAnimeResponse>(url, timeoutMs);

  if (!data || !data.data || !data.data.servers) {
    return { filemoon: [], servabyss: [] };
  }

  return {
    filemoon: data.data.servers.filemoon ?? [],
    servabyss: data.data.servers.servabyss ?? [],
  };
}

// ============================================================
// DESI DUB (desidubanime)
// ============================================================

export async function searchDesiDub(
  baseUrl: string,
  title: string,
  timeoutMs: number
): Promise<{ id: string; title: string; type: string } | null> {
  const url = `${baseUrl}/api/v1/desidubanime/search/${encodeURIComponent(title)}`;
  const data = await fetchJson<DesiDubSearchResponse>(url, timeoutMs);

  if (!data || !data.data || !data.data.results?.length) return null;

  const normalized = title.trim().toLowerCase();
  const exact = data.data.results.find(
    (r) => r.title.trim().toLowerCase() === normalized
  );
  const pick = exact ?? data.data.results[0];

  return { id: pick.id, title: pick.title, type: pick.type };
}

export async function fetchDesiDubSources(
  baseUrl: string,
  watchSlug: string,
  timeoutMs: number
): Promise<DesiDubSource[]> {
  const url = `${baseUrl}/api/v1/desidubanime/watch/${watchSlug}`;
  const data = await fetchJson<DesiDubWatchResponse>(url, timeoutMs);

  if (!data || !data.data || !data.data.sources) return [];
  return data.data.sources;
}
