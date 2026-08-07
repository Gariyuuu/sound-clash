import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Sound Clash — the ultimate multiplayer music guessing game";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 20%, #182233 0%, #0a0e17 60%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #1ED760 0%, #7C3AED 100%)",
            }}
          >
            <div style={{ fontSize: 56, color: "white" }}>✦</div>
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              backgroundImage: "linear-gradient(90deg, #1ED760, #a78bfa)",
              backgroundClip: "text",
              color: "transparent",
              display: "flex",
            }}
          >
            Sound Clash
          </div>
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#9CA8BC", display: "flex" }}>
          Buzz in. Guess the song. Clash for the win.
        </div>
      </div>
    ),
    { ...size }
  );
}
