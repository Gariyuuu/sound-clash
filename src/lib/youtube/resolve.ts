import "server-only";

export interface ResolvedYoutubeSong {
  title: string;
  artist: string;
  youtubeVideoId: string;
  durationSeconds: number;
  coverUrl: string;
}

function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const listParam = parsed.searchParams.get("list");
    if (listParam) return listParam;
  } catch {
    // not a URL — treat the raw input as an ID
  }
  if (/^[A-Za-z0-9_-]{10,}$/.test(url)) return url;
  return null;
}

function parseIso8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0);
}

/**
 * Splits a YouTube video title into artist/title using the common
 * "Artist - Title" convention official music-video uploads follow. Falls
 * back to using the whole string as the title when no separator is found —
 * hosts can rename tracks after import via the playlist editor.
 */
function splitArtistTitle(rawTitle: string): { artist: string; title: string } {
  const cleaned = rawTitle
    .replace(/\(official (music )?video\)/gi, "")
    .replace(/\[official (music )?video\]/gi, "")
    .replace(/\(official audio\)/gi, "")
    .replace(/\(lyrics?\)/gi, "")
    .trim();

  const separators = [" - ", " – ", " — ", ": "];
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const [artist, ...rest] = cleaned.split(sep);
      return { artist: artist.trim(), title: rest.join(sep).trim() };
    }
  }
  return { artist: "Unknown Artist", title: cleaned };
}

export async function resolveYoutubePlaylist(playlistUrl: string): Promise<ResolvedYoutubeSong[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "YOUTUBE_API_KEY is not configured — see .env.example and README.md 'YouTube API setup'."
    );
  }

  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) throw new Error("Couldn't find a playlist ID in that URL.");

  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`YouTube playlistItems request failed (${res.status})`);
    const data = await res.json();

    videoIds.push(...data.items.map((item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId));
    pageToken = data.nextPageToken;
  } while (pageToken && videoIds.length < 200);

  const songs: ResolvedYoutubeSong[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`YouTube videos request failed (${res.status})`);
    const data = await res.json();

    for (const item of data.items ?? []) {
      const { artist, title } = splitArtistTitle(item.snippet.title as string);
      songs.push({
        title,
        artist,
        youtubeVideoId: item.id,
        durationSeconds: parseIso8601Duration(item.contentDetails.duration),
        coverUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? "",
      });
    }
  }

  return songs;
}
