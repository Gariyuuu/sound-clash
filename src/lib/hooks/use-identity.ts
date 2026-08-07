"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getOrCreateGuestId, getGuestAvatar, getGuestName, setGuestName, setGuestAvatar } from "@/lib/guest";
import type { ProfileRow } from "@/types/database";

export interface Identity {
  loading: boolean;
  isAuthed: boolean;
  profile: ProfileRow | null;
  profileId: string | null;
  guestId: string | null;
  displayName: string;
  avatarEmoji: string;
  setDisplayName: (name: string) => void;
  setAvatarEmoji: (emoji: string) => void;
}

/**
 * Unifies Clerk-authenticated identity with the localStorage-backed guest
 * identity (see lib/guest.ts) into the one shape the rest of the app reads.
 * There is no direct client-side database access with Neon (unlike the old
 * Supabase anon-key client) — the extended `profiles` row (xp, stats, etc.)
 * is fetched via `GET /api/profiles/me`, which itself uses Clerk's
 * server-side `auth()` to identify the caller.
 */
export function useIdentity(): Identity {
  const { isLoaded, isSignedIn, user } = useUser();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState("");
  const [avatarEmoji, setAvatarEmojiState] = useState("🎧");

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      setProfileLoading(true);
      fetch("/api/profiles/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const fetchedProfile: ProfileRow | null = data?.profile ?? null;
          setProfile(fetchedProfile);
          if (fetchedProfile) {
            setDisplayNameState(fetchedProfile.username);
            setAvatarEmojiState(fetchedProfile.avatar_emoji);
          }
        })
        .finally(() => setProfileLoading(false));
      return;
    }

    const id = getOrCreateGuestId();
    setGuestId(id);
    setDisplayNameState(getGuestName());
    setAvatarEmojiState(getGuestAvatar());
    setProfileLoading(false);
  }, [isLoaded, isSignedIn, user]);

  return {
    loading: !isLoaded || profileLoading,
    isAuthed: Boolean(isSignedIn && profile),
    profile,
    profileId: profile?.id ?? null,
    guestId,
    displayName,
    avatarEmoji,
    setDisplayName: (name: string) => {
      setDisplayNameState(name);
      if (!profile) setGuestName(name);
    },
    setAvatarEmoji: (emoji: string) => {
      setAvatarEmojiState(emoji);
      if (!profile) setGuestAvatar(emoji);
    },
  };
}
