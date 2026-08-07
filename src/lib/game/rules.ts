import type { AnswerCategory, GameModeKey, RoomSettings } from "@/types/database";
import type { ChaosRuleKey } from "@/lib/game/types";
import { CHAOS_RULES } from "@/lib/game/types";

export function resolveTimerSeconds(settings: RoomSettings): number {
  switch (settings.mode) {
    case "speed_round":
      return 5;
    case "hard_mode":
      return 5;
    case "sudden_death":
      return 7;
    default:
      return settings.timerSeconds;
  }
}

export function resolveCategories(settings: RoomSettings): AnswerCategory[] {
  switch (settings.mode) {
    case "speed_round":
      return ["title"];
    case "artist_rush":
      return ["artist"];
    case "album_rush":
      return ["album"];
    case "chorus_challenge":
      return ["chorus"];
    default:
      return settings.categories.length ? settings.categories : ["title", "artist"];
  }
}

export function hintsAllowed(settings: RoomSettings): boolean {
  return settings.hintsEnabled && settings.mode !== "hard_mode" && settings.mode !== "sudden_death";
}

export function eliminatesOnWrongAnswer(settings: RoomSettings): boolean {
  return settings.mode === "sudden_death";
}

export function isTeamMode(settings: RoomSettings): boolean {
  return settings.mode === "team_battle";
}

const CHAOS_KEYS = Object.keys(CHAOS_RULES) as ChaosRuleKey[];

export function rollChaosRule(mode: GameModeKey): ChaosRuleKey | null {
  if (mode !== "chaos") return null;
  return CHAOS_KEYS[Math.floor(Math.random() * CHAOS_KEYS.length)];
}
