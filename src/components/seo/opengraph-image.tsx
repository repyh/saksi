// Temporarily unused: keep this generator outside src/app so Next does not
// register it as the automatic Open Graph image metadata route.
//
// The visible identity (emblem + wordmark) is drawn from the brand paths, so the
// card matches the app exactly. Supporting copy still uses a system sans because
// ImageResponse cannot read next/font assets without shipping a font file; the
// active route in src/app/api/og/peta-pekerjaan follows the same rule.
import { ImageResponse } from "next/og";
import {
  BRAND_FULL_NAME,
  EMBLEM_ASPECT,
  EMBLEM_FRAME_PATH,
  EMBLEM_SOLID_PATH,
  EMBLEM_VIEWBOX,
  WORDMARK_ASPECT,
  WORDMARK_PATH,
  WORDMARK_VIEWBOX,
} from "@/components/brand/mark-geometry";

export const alt = "SAKSI — peta dan audit anggaran jalan Kota Tangerang";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_HEIGHT = 64;
const MARK_WIDTH = Math.round(MARK_HEIGHT * EMBLEM_ASPECT);
const CAP_HEIGHT = 26;
const WORDMARK_WIDTH = Math.round(CAP_HEIGHT * WORDMARK_ASPECT);

const CARD = {
  canvas: "#FFFFFF",
  panel: "#FFFFFF",
  border: "#CBD5E1",
  primary: "#0058A3",
  secondary: "#FFDA1A",
  ink: "#0A192F",
  muted: "#475569",
  mapFillA: "#DCE8F3",
  mapFillB: "#C8DCEE",
  mapFillC: "#AFCDE7",
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: 54,
          backgroundColor: CARD.canvas,
          color: CARD.ink,
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
            border: `1px solid ${CARD.border}`,
            borderTop: `10px solid ${CARD.primary}`,
            backgroundColor: CARD.panel,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width={MARK_WIDTH} height={MARK_HEIGHT} viewBox={EMBLEM_VIEWBOX} fill="none">
              <path d={EMBLEM_FRAME_PATH} fill={CARD.secondary} fillRule="evenodd" />
              <path d={EMBLEM_SOLID_PATH} fill={CARD.primary} fillRule="evenodd" />
            </svg>
            <svg width={WORDMARK_WIDTH} height={CAP_HEIGHT} viewBox={WORDMARK_VIEWBOX} fill="none">
              <path d={WORDMARK_PATH} fill={CARD.primary} />
            </svg>
            <div style={{ display: "flex", marginLeft: 4, fontSize: 17, color: CARD.muted }}>
              {BRAND_FULL_NAME}
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
                  color: CARD.primary,
                  textTransform: "uppercase",
                }}
              >
                Data publik · wilayah · kontrak
              </div>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 800, lineHeight: 1.1 }}>
                Peta dan audit anggaran jalan
              </div>
              <div style={{ display: "flex", marginTop: 18, fontSize: 27, color: CARD.muted }}>
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
                border: `1px solid ${CARD.border}`,
                backgroundColor: "#F1F5F9",
              }}
            >
              <svg width="208" height="178" viewBox="0 0 208 178" fill="none">
                <path d="M17 22 78 12l13 46-59 16L17 22Z" fill={CARD.mapFillC} stroke={CARD.primary} strokeWidth="3" />
                <path d="m91 14 57 9-4 52-53-17V14Z" fill={CARD.mapFillA} stroke={CARD.primary} strokeWidth="3" />
                <path d="m148 23 43 22-17 48-30-18 4-52Z" fill={CARD.mapFillB} stroke={CARD.primary} strokeWidth="3" />
                <path d="m31 74 59-16 16 53-58 18-17-55Z" fill={CARD.mapFillA} stroke={CARD.primary} strokeWidth="3" />
                <path d="m90 58 54 17 6 54-44-18-16-53Z" fill={CARD.mapFillC} stroke={CARD.primary} strokeWidth="3" />
                <path d="m144 75 30 18-18 58-6-22-6-54Z" fill={CARD.mapFillA} stroke={CARD.primary} strokeWidth="3" />
                <path d="m48 129 58-18 44 18-35 31-67-31Z" fill={CARD.mapFillB} stroke={CARD.primary} strokeWidth="3" />
                <path d="m39 89 122 31" stroke={CARD.secondary} strokeWidth="8" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
