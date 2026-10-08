// Queue message types — W2 → W3 via stream-sync-queue

export type JobPriority = "high" | "normal" | "low";

export type MetadataCategory =
  | "trending"
  | "popular"
  | "seasonal"
  | "movies"
  | "latest"
  | "update"
  | "new"
  | "missing_search"
  | "home_discovery";

export interface StreamJob {
  anime_id: string;
  mal_id: number | null;
  anilist_id: number | null;
  // Optional titles for Tatakai search (added in W2 update)
  title?: string;
  english_title?: string | null;
  romaji_title?: string | null;
  episodes: number[];
  priority: JobPriority;
  category: MetadataCategory;
  requested_at?: string;
}

// Env bindings for the Worker
export interface Env {
  STREAM_QUEUE: Queue<StreamJob>;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANIVEXA_BASE: string;
  TATAKAI_BASE: string;
  API_TIMEOUT_MS: string;
  CONCURRENCY: string;
}
