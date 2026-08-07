"use client";

import { nanoid } from "nanoid";

const GUEST_ID_KEY = "sound-clash-guest-id";
const GUEST_NAME_KEY = "sound-clash-guest-name";
const GUEST_AVATAR_KEY = "sound-clash-guest-avatar";

const AVATAR_EMOJIS = ["🎧", "🎤", "🎸", "🥁", "🎹", "🎺", "🪩", "📻", "🎻", "🕺", "💃", "🔥"];

export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = nanoid(12);
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestName(): string {
  return localStorage.getItem(GUEST_NAME_KEY) ?? "";
}

export function setGuestName(name: string) {
  localStorage.setItem(GUEST_NAME_KEY, name);
}

export function getGuestAvatar(): string {
  let avatar = localStorage.getItem(GUEST_AVATAR_KEY);
  if (!avatar) {
    avatar = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
    localStorage.setItem(GUEST_AVATAR_KEY, avatar);
  }
  return avatar;
}

export function setGuestAvatar(emoji: string) {
  localStorage.setItem(GUEST_AVATAR_KEY, emoji);
}

export { AVATAR_EMOJIS };
