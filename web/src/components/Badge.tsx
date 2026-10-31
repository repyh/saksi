import type { Paket, Presisi } from "../lib/paket";

/* ── Glyph presisi (DESIGN.md §4) ──────────────────────────── */

const WARNA: Record<Presisi, string> = {
  RW: "var(--color-accent)",
  Kelurahan: "var(--color-koridor)",
  Kecamatan: "var(--color-badge-presisi)",
  Kabupaten: "var(--color-kabupaten)",
};

export function Glyph({
  presisi,
  size = 10,
  className,
}: {
  presisi: Presisi;
  size?: number;
  className?: string;
}) {
  const isi = WARNA[presisi] ?? "var(--color-badge-presisi)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none" }}
    >
      {presisi === "RW" && <circle cx="5" cy="5" r="3.5" fill={isi} />}
      {presisi === "Kelurahan" && <rect x="1" y="4" width="8" height="2" fill={isi} />}
      {presisi === "Kecamatan" && <rect x="1.6" y="1.6" width="6.8" height="6.8" fill={isi} />}
      {presisi === "Kabupaten" && (
        <>
          <rect x="0.8" y="4.2" width="3" height="1.6" fill={isi} />
          <rect x="6.2" y="4.2" width="3" height="1.6" fill={isi} />
        </>
      )}
    </svg>
  );
}

/* ── Stempel data ──────────────────────────────────────────── */

/** Teks persis sesuai AGENTS.md §8. */
export function StempelResmi() {
  return <span className="badge badge--asli">DATA RESMI (SIRUP / BINA MARGA)</span>;
}

export function StempelSimulasi() {
  return <span className="badge badge--simulasi">SIMULASI PROTOTIPE</span>;
}

/* ── Badge presisi ─────────────────────────────────────────── */

export function labelPresisiDari(presisi: Presisi): string {
  if (presisi === "RW") return "RW";
  if (presisi === "Kelurahan") return "Kelurahan";
  if (presisi === "Kecamatan") return "Kecamatan";
  return "Tanpa lokasi";
}

export function BadgePresisi({ paket }: { paket: Paket }) {
  return (
    <span className="badge badge--presisi">
      <Glyph presisi={paket.presisi_peta} size={10} />
      {labelPresisiDari(paket.presisi_peta)}
    </span>
  );
}

export function BadgePresisiDari({ presisi }: { presisi: Presisi }) {
  return (
    <span className="badge badge--presisi">
      <Glyph presisi={presisi} size={10} />
      {labelPresisiDari(presisi)}
    </span>
  );
}
