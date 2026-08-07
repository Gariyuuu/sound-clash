import "server-only";

export interface ResolvedSpotifySong {
  title: string;
  artist: string;
  featuredArtist: string | null;
  album: string;
  year: number | null;
  spotifyTrackId: string;
  previewUrl: string | null;
  coverUrl: string;
  durationSeconds: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Client Credentials flow — enough for reading public playlist/track
 * metadata (no user login needed). Token is cached in module scope for the
 * lifetime of the serverless function instance; a fresh one is fetched
 * whenever it's within 60s of expiring.
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not configured — see .env.example.");
  }

  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.value;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

function extractPlaylistId(url: string): string | null {
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9]{15,}$/.test(url)) return url;
  return null;
}

export async function resolveSpotifyPlaylist(playlistUrl: string): Promise<ResolvedSpotifySong[]> {
  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) throw new Error("Couldn't find a playlist ID in that URL.");

  const token = await getAccessToken();
  const songs: ResolvedSpotifySong[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=next,items(track(id,name,artists(name),album(name,release_date,images),preview_url,duration_ms))`;

  while (nextUrl && songs.length < 200) {
    const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`Spotify playlist request failed (${res.status})`);
    const data = await res.json();

    for (const item of data.items ?? []) {
      const track = item.track;
      if (!track || !track.id) continue;
      songs.push({
        title: track.name,
        artist: track.artists?.[0]?.name ?? "Unknown Artist",
        featuredArtist: track.artists?.length > 1 ? track.artists.slice(1).map((a: { name: string }) => a.name).join(", ") : null,
        album: track.album?.name ?? "",
        year: track.album?.release_date ? Number(track.album.release_date.slice(0, 4)) : null,
        spotifyTrackId: track.id,
        // Spotify no longer guarantees a preview_url on every track (many
        // return null depending on licensing/market) — see .env.example's
        // Spotify caveat and README's setup notes. Songs with no preview
        // simply can't be played if this is the room's only source; hosts
        // should prefer "mixed" source or a YouTube-backed playlist for
        // full coverage.
        previewUrl: track.preview_url ?? null,
        coverUrl: track.album?.images?.[0]?.url ?? "",
        durationSeconds: Math.round((track.duration_ms ?? 0) / 1000),
      });
    }

    nextUrl = data.next;
  }

  return songs;
}
