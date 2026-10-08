import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../types/queue";
import type {
  AnimeRow,
  EpisodeRow,
  StreamInsert,
  StreamRow,
} from "../types/database";

export function createSupabaseClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ========== EPISODES ==========

export async function getEpisodesByAnime(
  supabase: SupabaseClient,
  animeId: string
): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from("episodes")
    .select("id, episode_number")
    .eq("anime_id", animeId)
    .is("deleted_at", null);

  if (error) throw new Error(`episodes query failed: ${error.message}`);

  const map = new Map<number, string>();
  for (const row of (data ?? []) as EpisodeRow[]) {
    map.set(row.episode_number, row.id);
  }
  return map;
}

// ========== EXISTING STREAMS (for idempotency) ==========

export async function getExistingStreamKeys(
  supabase: SupabaseClient,
  animeId: string
): Promise<Set<string>> {
  // Returns a Set of keys: "${episode_id}|${provider}|${server_name}|${language}"
  const { data: episodeRows, error: epErr } = await supabase
    .from("episodes")
    .select("id")
    .eq("anime_id", animeId)
    .is("deleted_at", null);

  if (epErr) throw new Error(`episodes fetch failed: ${epErr.message}`);

  const episodeIds = ((episodeRows ?? []) as { id: string }[]).map((e) => e.id);
  if (episodeIds.length === 0) return new Set();

  const { data: streamRows, error: strErr } = await supabase
    .from("streams")
    .select("episode_id, provider, server_name, language")
    .in("episode_id", episodeIds)
    .is("deleted_at", null);

  if (strErr) throw new Error(`streams fetch failed: ${strErr.message}`);

  const keys = new Set<string>();
  for (const row of (streamRows ?? []) as Partial<StreamRow>[]) {
    keys.add(
      `${row.episode_id}|${row.provider}|${row.server_name}|${row.language}`
    );
  }
  return keys;
}

// ========== INSERT ==========

export async function insertStreams(
  supabase: SupabaseClient,
  streams: StreamInsert[]
): Promise<{ inserted: number; failed: number }> {
  if (streams.length === 0) return { inserted: 0, failed: 0 };

  // Batch insert in chunks of 100 (Supabase safe limit)
  let inserted = 0;
  let failed = 0;
  const CHUNK = 100;

  for (let i = 0; i < streams.length; i += CHUNK) {
    const chunk = streams.slice(i, i + CHUNK);
    const { error } = await supabase.from("streams").insert(chunk);
    if (error) {
      failed += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, failed };
}

// ========== ANIME (for title fallback) ==========

export async function getAnimeById(
  supabase: SupabaseClient,
  animeId: string
): Promise<AnimeRow | null> {
  const { data, error } = await supabase
    .from("anime")
    .select(
      "id, slug, title, english_title, romaji_title, anilist_id, mal_id, is_movie, episodes_count"
    )
    .eq("id", animeId)
    .maybeSingle();

  if (error) throw new Error(`anime query failed: ${error.message}`);
  return (data as AnimeRow | null) ?? null;
}
