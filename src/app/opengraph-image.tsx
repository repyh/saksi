import { ImageResponse } from "next/og";

export const alt = "SAKSI — peta dan audit anggaran jalan Kota Tangerang";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: 54,
          backgroundColor: "#f7f9fc",
          color: "#0b1b33",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "42px 48px",
            border: "1px solid #d5deea",
            borderTop: "10px solid #075da8",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                width: 12,
                height: 44,
                backgroundColor: "#ffdc19",
              }}
            />
            <div style={{ display: "flex", fontSize: 34, fontWeight: 800, letterSpacing: 8 }}>
              SAKSI
            </div>
            <div style={{ display: "flex", marginLeft: 4, fontSize: 17, color: "#52647a" }}>
              Sistem Akuntabilitas &amp; Komparasi Spasial Infrastruktur
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 36 }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
              <div
                style={{
                  display: "flex",
                  marginBottom: 20,
                  fontSize: 19,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: "#075da8",
                  textTransform: "uppercase",
                }}
              >
                Data publik · wilayah · kontrak
              </div>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 800, lineHeight: 1.1 }}>
                Peta dan audit anggaran jalan
              </div>
              <div style={{ display: "flex", marginTop: 18, fontSize: 27, color: "#52647a" }}>
                Kota Tangerang
              </div>
            </div>

            <div
              style={{
                display: "flex",
                width: 250,
                height: 220,
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #d5deea",
                backgroundColor: "#edf4fb",
              }}
            >
              <svg width="208" height="178" viewBox="0 0 208 178" fill="none">
                <path d="M17 22 78 12l13 46-59 16L17 22Z" fill="#b7d3ec" stroke="#075da8" strokeWidth="3" />
                <path d="m91 14 57 9-4 52-53-17V14Z" fill="#d9e8f5" stroke="#075da8" strokeWidth="3" />
                <path d="m148 23 43 22-17 48-30-18 4-52Z" fill="#a6c9e8" stroke="#075da8" strokeWidth="3" />
                <path d="m31 74 59-16 16 53-58 18-17-55Z" fill="#d9e8f5" stroke="#075da8" strokeWidth="3" />
                <path d="m90 58 54 17 6 54-44-18-16-53Z" fill="#82b3df" stroke="#075da8" strokeWidth="3" />
                <path d="m144 75 30 18-18 58-6-22-6-54Z" fill="#d9e8f5" stroke="#075da8" strokeWidth="3" />
                <path d="m48 129 58-18 44 18-35 31-67-31Z" fill="#b7d3ec" stroke="#075da8" strokeWidth="3" />
                <path d="m39 89 122 31" stroke="#ffcf00" strokeWidth="8" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
