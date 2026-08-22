import { ImageResponse } from "next/og";
import { SparkMark } from "@/components/branding/logo";

/**
 * next/og resolves text glyphs through its emoji provider, which only covers
 * real pictographs. U+2726 BLACK FOUR POINTED STAR has no emoji presentation,
 * so no font is loaded for it and it renders as a tofu box. (Its neighbour
 * U+2728 SPARKLES does, which is why this is easy to miss.)
 */
const RENDERABLE_AS_TEXT = /\p{Extended_Pictographic}/u;

/** The brand mark uses U+2726, so this always takes the SparkMark path today --
 *  the guard is what keeps it correct if the mark ever changes. */
const MARK = "✦";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1ED760 0%, #7C3AED 100%)",
          borderRadius: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ width: 12, height: 26, borderRadius: 6, background: "#F5F7FF" }} />
            <div style={{ width: 12, height: 56, borderRadius: 6, background: "#F5F7FF" }} />
            <div style={{ width: 12, height: 92, borderRadius: 6, background: "#F5F7FF" }} />
          </div>
          {RENDERABLE_AS_TEXT.test(MARK) ? (
            <div style={{ fontSize: 64, color: "white", margin: "0 4px" }}>{MARK}</div>
          ) : (
            <div style={{ display: "flex", margin: "0 4px" }}>
              <SparkMark size={56} />
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ width: 12, height: 92, borderRadius: 6, background: "#F5F7FF" }} />
            <div style={{ width: 12, height: 56, borderRadius: 6, background: "#F5F7FF" }} />
            <div style={{ width: 12, height: 26, borderRadius: 6, background: "#F5F7FF" }} />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
