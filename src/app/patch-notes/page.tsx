import Link from "next/link";
import { LogoFull } from "@/components/branding/logo";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PatchNote {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
  knownIssues: string[];
}

const PATCH_NOTES: PatchNote[] = [
  {
    version: "0.3.0",
    date: "2026-08-06",
    added: [
      "Live gameplay screen: buzzer, answer panel, hints, steal rounds, host controls, floating score popups.",
      "Results screen with a podium, standings, and confetti.",
      "Leaderboards, profile, and settings pages.",
      "Actual visual theme backgrounds (Cyberpunk, Galaxy, Neon, and 11 more presets) plus custom image upload.",
    ],
    changed: [],
    fixed: [
      "The app now builds — fixed a missing-components bug, a database typing bug, a broken lint config, and several UI component prop mismatches.",
    ],
    knownIssues: [
      "The gameplay loop hasn't been played against a live server yet — expect rough edges.",
      "If the host disconnects mid-round, the game may stall until someone refreshes.",
      "Spotify and Team Battle are not fully functional yet.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-08-06",
    added: [
      "Room creation and join-by-code, lobby with chat and reactions, host settings panel.",
      "YouTube playlist import.",
      "Full multiplayer backend: buzz-race arbitration, scoring, steal mechanic, hints.",
    ],
    changed: [],
    fixed: [],
    knownIssues: ["No live gameplay screen yet — games could be started but not played."],
  },
  {
    version: "0.1.0",
    date: "2026-08-06",
    added: ["Initial project scaffold, branding, database schema, authentication."],
    changed: [],
    fixed: [],
    knownIssues: ["Nothing playable yet."],
  },
];

export default function PatchNotesPage() {
  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <LogoFull size={24} />
        <NavAuthLinks />
      </div>

      <h1 className="text-3xl font-extrabold text-center">Patch Notes</h1>

      <div className="flex flex-col gap-6">
        {PATCH_NOTES.map((note) => (
          <div key={note.version} className="glass rounded-2xl p-6 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-bold">v{note.version}</h2>
              <span className="text-sm text-muted-foreground">{note.date}</span>
            </div>
            {note.added.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-emerald-400 mb-1">Added</h3>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                  {note.added.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            )}
            {note.changed.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-violet-400 mb-1">Changed</h3>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                  {note.changed.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            )}
            {note.fixed.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-blue-400 mb-1">Fixed</h3>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                  {note.fixed.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            )}
            {note.knownIssues.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-400 mb-1">Known Issues</h3>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                  {note.knownIssues.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
