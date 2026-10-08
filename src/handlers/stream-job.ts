import type { SupabaseClient } from "@supabase/supabase-js";
import type { StreamJob, Env } from "../types/queue";
import type { StreamInsert } from "../types/database";
import {
  getEpisodesByAnime,
  getExistingStreamKeys,
  getAnimeById,
  insertStreams,
} from "../services/supabase";
import { fetchAnivexaStream } from "../services/anivexa";
import {
  searchHindiDubbed,
  fetchHindiDubbedServers,
  searchDesiDub,
  fetchDesiDubSources,
} from "../services/tatakai";
import {
  ANIVEXA_PROVIDERS,
  HINDI_DUBBED_PROVIDERS,
  DESI_DUB_PROVIDERS,
  BLACKLISTED_SERVERS,
  PROV,
  LANG,
} from "../config/constants";
import {
  parseEpisodeNumber,
  buildStreamInsert,
  makeKey,
  batch,
} from "../utils/transformer";

// Tuning — conservative for Cloudflare Worker 30s wall time
const MAX_EPISODES_PER_RUN = 3;
const CONCURRENCY = 10;
const API_TIMEOUT = 10000;

export interface ProcessResult {
  inserted: number;
  failed: number;
  remaining: number;
  skipped: number;
}

// ============================================================
// MAIN ENTRY
// ============================================================
export async function processStreamJob(
  job: StreamJob,
  supabase: SupabaseClient,
  env: Env
): Promise<ProcessResult> {
  if (!job?.anime_id) {
    return { inserted: 0, failed: 0, remaining: 0, skipped: 0 };
  }

  // 1. Episode map: number → episode_id
  const episodeMap = await getEpisodesByAnime(supabase, job.anime_id);
  if (episodeMap.size === 0) {
    return { inserted: 0, failed: 0, remaining: 0, skipped: 0 };
  }

  // 2. Intersect job.episodes with existing episodes
  const validEpisodes = (job.episodes || []).filter((n) => episodeMap.has(n));
  if (validEpisodes.length === 0) {
    return { inserted: 0, failed: 0, remaining: 0, skipped: 0 };
  }

  // 3. Limit per run + track remaining
  const episodesToProcess = validEpisodes.slice(0, MAX_EPISODES_PER_RUN);
  const remaining = validEpisodes.slice(MAX_EPISODES_PER_RUN);

  // 4. Existing streams (idempotency)
  const existingKeys = await getExistingStreamKeys(supabase, job.anime_id);

  // 5. Title fallback chain
  const anime = await getAnimeById(supabase, job.anime_id);
  const titles = [
    job.title,
    job.english_title,
    job.romaji_title,
    anime?.title,
    anime?.english_title,
    anime?.romaji_title,
  ].filter((t): t is string => typeof t === "string" && t.length > 0);

  // 6. Fetch all 3 sources in parallel
  const [anivexaStreams, hindiStreams, desiStreams] = await Promise.all([
    job.anilist_id
      ? fetchAllAnivexa(
          job.anilist_id,
          episodesToProcess,
          episodeMap,
          existingKeys,
          env
        )
      : Promise.resolve([] as StreamInsert[]),
    fetchAllHindi(titles, episodesToProcess, episodeMap, existingKeys, env),
    fetchAllDesi(titles, episodesToProcess, episodeMap, existingKeys, env),
  ]);

  const allStreams = [
    ...anivexaStreams,
    ...hindiStreams,
    ...desiStreams,
  ];

  // 7. Insert to DB
  const { inserted, failed } = await insertStreams(supabase, allStreams);

  // 8. Re-queue remaining episodes
  if (remaining.length > 0) {
    await env.STREAM_QUEUE.send({
      ...job,
      episodes: remaining,
      requested_at: new Date().toISOString(),
    });
  }

  return {
    inserted,
    failed,
    remaining: remaining.length,
    skipped: validEpisodes.length - episodesToProcess.length,
  };
}

// ============================================================
// ANIVEXA FETCHER (Eng Sub + Eng Dub)
// ============================================================
async function fetchAllAnivexa(
  anilistId: number,
  episodes: number[],
  episodeMap: Map<number, string>,
  existingKeys: Set<string>,
  env: Env
): Promise<StreamInsert[]> {
  const tasks: (() => Promise<StreamInsert | null>)[] = [];

  for (const epNum of episodes) {
    const episodeId = episodeMap.get(epNum);
    if (!episodeId) continue;

    for (const { provider, serverName } of ANIVEXA_PROVIDERS) {
      for (const audio of ["sub", "dub"] as const) {
        const lang = audio === "sub" ? LANG.SUB : LANG.DUB;
        const key = makeKey(episodeId, PROV.ANIVEXA, serverName, lang);
        if (existingKeys.has(key)) continue;

        tasks.push(async () => {
          const s = await fetchAnivexaStream({
            baseUrl: env.ANIVEXA_BASE,
            provider,
            anilistId,
            audio,
            episode: epNum,
            timeoutMs: API_TIMEOUT,
          });
          if (!s?.url) return null;
          return buildStreamInsert({
            episodeId,
            provider: PROV.ANIVEXA,
            url: s.url,
            language: lang,
            serverName,
            sourceSlug: `anilist:${anilistId}`,
          });
        });
      }
    }
  }

  const results = await batch(tasks, CONCURRENCY);
  return results.filter((s): s is StreamInsert => s !== null);
}

// ============================================================
// HINDI DUBBED FETCHER (Tatakai animehindidubbed)
// ============================================================
async function fetchAllHindi(
  titles: string[],
  episodes: number[],
  episodeMap: Map<number, string>,
  existingKeys: Set<string>,
  env: Env
): Promise<StreamInsert[]> {
  if (titles.length === 0) return [];

  // Search once — try titles in order
  let found: { slug: string; title: string } | null = null;
  for (const title of titles) {
    found = await searchHindiDubbed(env.TATAKAI_BASE, title, API_TIMEOUT);
    if (found) break;
  }
  if (!found) return [];

  // Fetch servers
  const servers = await fetchHindiDubbedServers(
    env.TATAKAI_BASE,
    found.slug,
    API_TIMEOUT
  );

  const streams: StreamInsert[] = [];

  for (const { key, serverName } of HINDI_DUBBED_PROVIDERS) {
    const list = (servers as Record<string, Array<{ name: string; url: string }>>)[
      key
    ];
    if (!Array.isArray(list)) continue;

    for (const item of list) {
      const n = parseEpisodeNumber(item.name);
      if (!n || !episodes.includes(n)) continue;

      const episodeId = episodeMap.get(n);
      if (!episodeId) continue;

      const k = makeKey(episodeId, PROV.TATAKAI, serverName, LANG.HINDI);
      if (existingKeys.has(k)) continue;

      streams.push(
        buildStreamInsert({
          episodeId,
          provider: PROV.TATAKAI,
          url: item.url,
          language: LANG.HINDI,
          serverName,
          sourceSlug: found.slug,
        })
      );
    }
  }

  return streams;
}

// ============================================================
// DESI DUB FETCHER (Tatakai desidubanime)
// ============================================================
async function fetchAllDesi(
  titles: string[],
  episodes: number[],
  episodeMap: Map<number, string>,
  existingKeys: Set<string>,
  env: Env
): Promise<StreamInsert[]> {
  if (titles.length === 0) return [];

  // Search
  let found: { id: string; title: string; type: string } | null = null;
  for (const title of titles) {
    found = await searchDesiDub(env.TATAKAI_BASE, title, API_TIMEOUT);
    if (found) break;
  }
  if (!found) return [];

  const animeSlug = found.id;

  // Fetch anime info to get accurate watch slugs (episode list)
  const watchSlugMap = await fetchDesiWatchSlugMap(
    env.TATAKAI_BASE,
    animeSlug,
    API_TIMEOUT
  );

  const tasks: (() => Promise<StreamInsert[]>)[] = [];

  for (const epNum of episodes) {
    const episodeId = episodeMap.get(epNum);
    if (!episodeId) continue;

    // Priority: exact watch slug from anime info; else construct
    const watchSlug =
      watchSlugMap.get(epNum) || `${animeSlug}-episode-${epNum}`;

    tasks.push(async () => {
      let sources = await fetchDesiDubSources(
        env.TATAKAI_BASE,
        watchSlug,
        API_TIMEOUT
      );

      // Movie fallback: use bare slug
      if (sources.length === 0) {
        sources = await fetchDesiDubSources(
          env.TATAKAI_BASE,
          animeSlug,
          API_TIMEOUT
        );
      }

      const out: StreamInsert[] = [];
      for (const src of sources) {
        const mapping = DESI_DUB_PROVIDERS.find((p) => p.key === src.server);
        if (!mapping) continue;
        if (BLACKLISTED_SERVERS.has(src.server)) continue;

        const k = makeKey(episodeId, PROV.TATAKAI, mapping.serverName, LANG.HINDI);
        if (existingKeys.has(k)) continue;

        out.push(
          buildStreamInsert({
            episodeId,
            provider: PROV.TATAKAI,
            url: src.url,
            language: LANG.HINDI,
            serverName: mapping.serverName,
            sourceSlug: watchSlug,
          })
        );
      }
      return out;
    });
  }

  const results = await batch(tasks, CONCURRENCY);
  return results.flat();
}

// Fetch desidubanime anime info to extract accurate watch slugs
async function fetchDesiWatchSlugMap(
  baseUrl: string,
  animeSlug: string,
  timeoutMs: number
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const url = `${baseUrl}/api/v1/desidubanime/anime/${animeSlug}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return map;

    const data = await res.json();
    const episodes = data?.data?.episodes;
    if (!Array.isArray(episodes)) return map;

    for (const ep of episodes) {
      if (typeof ep?.number === "number" && typeof ep?.id === "string") {
        map.set(ep.number, ep.id);
      }
    }
  } catch {
    // ignore — fallback to constructed slugs
  } finally {
    clearTimeout(timer);
  }

  return map;
    }
