export type GenreKey =
  | "pop"
  | "hip_hop"
  | "rock"
  | "rnb"
  | "country"
  | "electronic"
  | "kpop"
  | "latin"
  | "indie"
  | "oldies";

/** Matches `playlists.genre` / `songs.genre` (free-text columns) — these are the values written/filtered on, not a DB enum. */
export const GENRE_LABELS: Record<GenreKey, string> = {
  pop: "Pop",
  hip_hop: "Hip-Hop",
  rock: "Rock",
  rnb: "R&B",
  country: "Country",
  electronic: "Electronic",
  kpop: "K-Pop",
  latin: "Latin",
  indie: "Indie",
  oldies: "Oldies",
};

export const GENRE_KEYS = Object.keys(GENRE_LABELS) as GenreKey[];
