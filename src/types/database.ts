// Compatibility re-export shim. This file used to be the hand-authored
// Supabase type source (see git history / DECISIONS.md D-013 for the
// Neon+Drizzle migration). It's kept as a re-export barrel — rather than
// deleting it and updating every one of the ~30 files across this codebase
// that does `import type { RoomRow, ... } from "@/types/database"` — so
// prefer importing row types from "@/lib/db/schema" and domain types from
// "@/types/game" directly in new code, but existing imports from this path
// continue to work unchanged.
export * from "@/types/game";
export type {
  ProfileRow,
  AchievementRow,
  PlaylistRow,
  SongRow,
  RoomRow,
  RoomPlayerRow,
  GameRow,
  GameRoundRow,
  RoundLockRow,
  RoundAnswerRow,
  MatchHistoryRow,
  RoomMessageRow,
} from "@/lib/db/schema";
