import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon rendered from the same SVG as the favicon.
export default function AppleIcon() {
  const svg = fs.readFileSync(path.join(process.cwd(), "src/app/icon.svg"));
  // iOS masks the corners itself, so fill the square edge to edge (no transparent corners).
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "linear-gradient(135deg, #0f3a31, #0d7a63)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;base64,${svg.toString("base64")}`} width={204} height={204} style={{ margin: -12 }} alt="" />
      </div>
    ),
    size,
  );
}
