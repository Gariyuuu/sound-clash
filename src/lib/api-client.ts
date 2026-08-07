async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

export const api = {
  createRoom: (body: unknown) => request<{ room: import("@/types/database").RoomRow; player: import("@/types/database").RoomPlayerRow }>("/api/rooms", { method: "POST", body: JSON.stringify(body) }),
  listPublicRooms: (limit?: number) => request<{ rooms: (import("@/types/database").RoomRow & { room_players: { count: number }[] })[] }>(`/api/rooms${limit ? `?limit=${limit}` : ""}`),
  getRoom: (code: string) => request<{ room: import("@/types/database").RoomRow; players: import("@/types/database").RoomPlayerRow[] }>(`/api/rooms/${code}`),
  joinRoom: (code: string, body: unknown) => request<{ room: import("@/types/database").RoomRow; player: import("@/types/database").RoomPlayerRow }>(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify(body) }),
  leaveRoom: (code: string, playerId: string) => request(`/api/rooms/${code}/leave`, { method: "POST", body: JSON.stringify({ playerId }) }),
  updateSettings: (code: string, body: unknown) => request(`/api/rooms/${code}/settings`, { method: "POST", body: JSON.stringify(body) }),
  kickPlayer: (code: string, body: unknown) => request(`/api/rooms/${code}/kick`, { method: "POST", body: JSON.stringify(body) }),
  assignTeam: (code: string, body: unknown) => request(`/api/rooms/${code}/team`, { method: "POST", body: JSON.stringify(body) }),
  setAiOpponent: (code: string, body: unknown) => request<{ player?: import("@/types/database").RoomPlayerRow }>(`/api/rooms/${code}/ai-opponent`, { method: "POST", body: JSON.stringify(body) }),
  setReady: (code: string, body: unknown) => request(`/api/rooms/${code}/ready`, { method: "POST", body: JSON.stringify(body) }),
  startGame: (code: string, requesterPlayerId: string) => request<{ game: import("@/types/database").GameRow; round: import("@/types/database").GameRoundRow }>(`/api/rooms/${code}/start`, { method: "POST", body: JSON.stringify({ requesterPlayerId }) }),
  control: (code: string, body: unknown) => request(`/api/rooms/${code}/control`, { method: "POST", body: JSON.stringify(body) }),
  getGame: (code: string) => request<{ game: import("@/types/database").GameRow | null; round: import("@/types/database").GameRoundRow | null; matchHistoryId: string | null }>(`/api/rooms/${code}/game`),
  buzz: (roundId: string, body: unknown) => request<{ locked: boolean; holderId?: string; displayName?: string; phase?: number }>(`/api/rounds/${roundId}/buzz`, { method: "POST", body: JSON.stringify(body) }),
  submitAnswer: (roundId: string, body: unknown) => request<{ correct: boolean; total?: number; breakdown?: { label: string; points: number }[]; penalty?: number; roundOver?: boolean }>(`/api/rounds/${roundId}/answer`, { method: "POST", body: JSON.stringify(body) }),
  timeout: (roundId: string, body: unknown) => request(`/api/rounds/${roundId}/timeout`, { method: "POST", body: JSON.stringify(body) }),
  aiTurn: (roundId: string, body: unknown) => request<{ acted: boolean }>(`/api/rounds/${roundId}/ai-turn`, { method: "POST", body: JSON.stringify(body) }),
  hint: (roundId: string, body: unknown) => request<{ hint: import("@/lib/game/types").RevealedHint }>(`/api/rounds/${roundId}/hint`, { method: "POST", body: JSON.stringify(body) }),
  nextRound: (roundId: string, requesterPlayerId: string) => request<{ ended?: boolean; matchHistoryId?: string; round?: import("@/types/database").GameRoundRow }>(`/api/rounds/${roundId}/next`, { method: "POST", body: JSON.stringify({ requesterPlayerId }) }),
  listPlaylists: (params?: Record<string, string>) => request<{ playlists: (import("@/types/database").PlaylistRow & { songs: { count: number }[] })[] }>(`/api/playlists${params ? `?${new URLSearchParams(params)}` : ""}`),
  importYoutubePlaylist: (body: unknown) => request<{ playlist: import("@/types/database").PlaylistRow; songCount: number }>("/api/playlists/import-youtube", { method: "POST", body: JSON.stringify(body) }),
  importSpotifyPlaylist: (body: unknown) => request<{ playlist: import("@/types/database").PlaylistRow; songCount: number; songsWithPreview: number; warning: string | null }>("/api/playlists/import-spotify", { method: "POST", body: JSON.stringify(body) }),
  sendMessage: (code: string, body: unknown) => request(`/api/rooms/${code}/messages`, { method: "POST", body: JSON.stringify(body) }),
  getMatchHistory: (id: string) => request<{ matchHistory: import("@/types/database").MatchHistoryRow }>(`/api/match-history/${id}`),
  getLeaderboard: (type: string, limit?: number) =>
    request<{ type: string; entries: import("@/lib/game/types").LeaderboardEntry[] }>(
      `/api/leaderboards?${new URLSearchParams({ type, ...(limit ? { limit: String(limit) } : {}) })}`
    ),
  getProfile: (username: string) => request<{ profile: import("@/types/database").ProfileRow; achievements: (import("@/types/database").AchievementRow & { unlocked_at: string })[] }>(`/api/profiles/${username}`),
  updateProfileSettings: (body: unknown) => request(`/api/profiles/me/settings`, { method: "POST", body: JSON.stringify(body) }),
};
