import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccessibilityProvider } from "@/components/providers/accessibility-provider";
import { BackgroundLayer } from "@/components/providers/background-layer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Sound Clash — Multiplayer Music Guessing Game",
    template: "%s · Sound Clash",
  },
  description:
    "Buzz in, guess the song, and clash for the win. A fast, social multiplayer music guessing game for you and your friends.",
  applicationName: "Sound Clash",
  keywords: ["music game", "multiplayer", "song guessing", "party game", "Sound Clash"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <AccessibilityProvider>
              <BackgroundLayer />
              <TooltipProvider delay={150}>
                {children}
                <Toaster position="top-center" richColors closeButton />
              </TooltipProvider>
            </AccessibilityProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
