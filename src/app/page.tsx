import Link from "next/link";
import { LogoFull, LogoMark } from "@/components/branding/logo";
import { CreateRoomButton } from "@/components/home/create-room-button";
import { JoinRoomCard } from "@/components/home/join-room-card";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { Button } from "@/components/ui/button";
import {
  Music4,
  Zap,
  Users,
  Trophy,
  Sparkles,
  Headphones,
  Swords,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Buzz-in gameplay", desc: "First to smash the buzzer locks everyone else out — just like the real thing." },
  { icon: Swords, title: "Steal rounds", desc: "Miss it and the floor opens up — everyone else gets a shot at 80% points." },
  { icon: Music4, title: "YouTube & Spotify", desc: "Bring your own playlists, or pick from genre, decade, and mood packs." },
  { icon: Users, title: "2–20 players", desc: "Private rooms for your friend group, public rooms to meet new rivals." },
  { icon: Trophy, title: "Deep progression", desc: "XP, levels, achievements, and leaderboards across every game mode." },
  { icon: BarChart3, title: "Full match history", desc: "Every round, every steal, every score swing — replayable later." },
];

const MODES = [
  "Classic", "Speed Round", "Artist Rush", "Album Rush", "Chorus Challenge",
  "Instrumental", "Reverse Intro", "One Second", "Hard Mode", "Sudden Death",
  "Team Battle", "Chaos Mode",
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <LogoFull size={30} />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/career" />}>
            🤖 Career Mode
          </Button>
          <Button variant="ghost" render={<Link href="/leaderboards" />}>
            Leaderboards
          </Button>
          <Button variant="ghost" render={<Link href="/patch-notes" />}>
            Patch Notes
          </Button>
          <NavAuthLinks />
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(30,215,96,0.16),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(124,58,237,0.18),transparent_45%)]" />
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-6 px-6 py-20">
            <div className="flex items-center gap-2 rounded-full glass px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-3.5 text-emerald-400" />
              The ultimate multiplayer music guessing game
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
              Buzz in. Guess the song.
              <br />
              <span className="neon-text">Clash for the win.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Gather your friends, drop in a playlist, and race to name the song first.
              Steal rounds, hints, and 12 game modes keep every match unpredictable.
            </p>

            <div className="flex flex-col items-center gap-4 mt-4">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <CreateRoomButton />
              </div>
              <span className="text-sm text-muted-foreground">or join a friend&apos;s room</span>
              <JoinRoomCard />
              <Link href="/browse" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
                Browse public rooms
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-2xl p-6 flex flex-col gap-3">
                <f.icon className="size-6 text-emerald-400" />
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="glass-strong rounded-3xl p-8 flex flex-col items-center gap-6 text-center">
            <Headphones className="size-8 text-violet-400" />
            <h2 className="text-2xl font-bold">12 ways to play</h2>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              {MODES.map((m) => (
                <span key={m} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <LogoMark size={20} />
            Sound Clash
          </div>
          <div className="flex gap-4">
            <Link href="/patch-notes" className="hover:text-foreground">Patch Notes</Link>
            <Link href="/leaderboards" className="hover:text-foreground">Leaderboards</Link>
            <Link href="/settings" className="hover:text-foreground">Settings</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
