"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Music, Upload, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaylistRow } from "@/types/database";

type PlaylistWithCount = PlaylistRow & { songs: { count: number }[] };

export function PlaylistPicker({
  selectedId,
  onSelect,
  ownerId,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  ownerId?: string;
}) {
  const [playlists, setPlaylists] = useState<PlaylistWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<"youtube" | "spotify">("youtube");
  const [importUrl, setImportUrl] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const { playlists } = await api.listPlaylists();
      setPlaylists(playlists);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleImport() {
    if (!importUrl.trim() || !importName.trim()) return;
    setImporting(true);
    try {
      if (importSource === "youtube") {
        const { playlist, songCount } = await api.importYoutubePlaylist({
          playlistUrl: importUrl.trim(),
          name: importName.trim(),
          ownerId,
        });
        toast.success(`Imported ${songCount} songs into "${playlist.name}"`);
        onSelect(playlist.id);
      } else {
        const { playlist, songCount, warning } = await api.importSpotifyPlaylist({
          playlistUrl: importUrl.trim(),
          name: importName.trim(),
          ownerId,
        });
        toast.success(`Imported ${songCount} songs into "${playlist.name}"`);
        if (warning) toast.warning(warning);
        onSelect(playlist.id);
      }
      setImportOpen(false);
      setImportUrl("");
      setImportName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import playlist.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Playlist</Label>
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
            <Upload className="size-3.5" /> Import playlist
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import a playlist</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                {(["youtube", "spotify"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setImportSource(s)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition",
                      importSource === s ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/5 text-muted-foreground"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="playlist-name">Playlist name</Label>
                <Input id="playlist-name" value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Friday Night Hits" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="playlist-url">{importSource === "youtube" ? "YouTube" : "Spotify"} playlist URL</Label>
                <Input
                  id="playlist-url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder={
                    importSource === "youtube"
                      ? "https://www.youtube.com/playlist?list=..."
                      : "https://open.spotify.com/playlist/..."
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {importSource === "youtube"
                    ? "Requires YOUTUBE_API_KEY to be configured — see README.md."
                    : "Requires SPOTIFY_CLIENT_ID/SECRET — see README.md. Not every track has a 30s preview available from Spotify."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading playlists...</p>
      ) : playlists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No playlists yet — import one from YouTube or run <code>npm run db:seed</code> for a demo set.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                selectedId === p.id ? "border-primary bg-primary/10 neon-ring" : "border-white/10 bg-white/5 hover:bg-white/10"
              )}
            >
              {p.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_url} alt="" className="size-10 rounded-lg object-cover" />
              ) : p.source === "spotify" ? (
                <Music className="size-8 text-emerald-400" />
              ) : (
                <Disc3 className="size-8 text-violet-400" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.songs?.[0]?.count ?? 0} songs · {p.source}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
