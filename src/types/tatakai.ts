// Tatakai API response shapes (animehindidubbed + desidubanime)

// ========== animehindidubbed ==========
export interface HindiDubbedServer {
  name: string;             // "Episode 1" or "01"
  url: string;              // embed URL
}

export interface HindiDubbedServers {
  filemoon?: HindiDubbedServer[];
  servabyss?: HindiDubbedServer[];
  vidgroud?: HindiDubbedServer[];
}

export interface HindiDubbedAnimeResponse {
  provider: string;
  status: number;
  data: {
    title: string;
    slug: string;
    thumbnail?: string;
    description?: string;
    rating?: string;
    servers: HindiDubbedServers;
  } | null;
}

export interface HindiDubbedSearchResult {
  title: string;
  slug: string;
  url: string;
  thumbnail?: string;
  categories?: string[];
}

export interface HindiDubbedSearchResponse {
  provider: string;
  status: number;
  data: {
    animeList: HindiDubbedSearchResult[];
    totalFound: number;
  };
}

// ========== desidubanime ==========
export interface DesiDubSource {
  server: string;           // "Mirrordub" | "Abyssdub" | "VMolydub" | "Streamp2pdub"
  url: string;
  type: string;             // "embed"
  referer: string;
}

export interface DesiDubWatchResponse {
  provider: string;
  status: number;
  data: {
    id: string;             // "naruto-episode-1"
    title: string;
    sources: DesiDubSource[];
  };
}

export interface DesiDubSearchResult {
  id: string;               // slug
  title: string;
  poster: string;
  type: string;             // "TV" | "MOVIE"
  url: string;
}

export interface DesiDubSearchResponse {
  provider: string;
  status: number;
  data: {
    results: DesiDubSearchResult[];
    query: string;
    totalFound: number;
  };
}
