import { ImageResponse } from "next/og";
import { getIndex } from "@/lib/data";

export const alt = "Fontory — Find your type.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default font only: no remote font fetches. Colors are flat, no gradients.
export default function Image() {
  const index = getIndex();
  const families = index.length;
  const styles = index.reduce((sum, f) => sum + f.styleCount, 0);
  const fmt = (n: number) => n.toLocaleString("en-US");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f6f2",
          color: "#141414",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: "-0.01em" }}>Fontory</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 120, lineHeight: 1.05 }}>Find your type.</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#141414" }}>
            {`${fmt(families)} font families · ${fmt(styles)} styles · open licenses`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
