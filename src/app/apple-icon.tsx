import { ImageResponse } from "next/og";

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
          <div style={{ fontSize: 64, color: "white", margin: "0 4px" }}>✦</div>
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
