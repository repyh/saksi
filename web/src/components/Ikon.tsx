/**
 * Ikon — SVG authored, stroke 1.5, kotak 24, currentColor.
 * Tidak ada emoji, tidak ada pustaka ikon (DESIGN.md §3).
 */

type Props = { size?: number; className?: string };

const dasar = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false as const,
});

export function PanahKanan({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function PanahKiri({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M20 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function Centang({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M5 12.5 10 17.5 19.5 6.5" />
    </svg>
  );
}

export function Kamera({ size = 20, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M3 8.5h3.2L8 6h8l1.8 2.5H21v10H3z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

export function Lokasi({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M12 21s6.5-6.2 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.8 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

export function Privat({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M4 4l16 16" />
      <path d="M8 8.2A9.6 9.6 0 0 1 12 4c4.4 3 6.5 5.6 6.5 8 0 1.3-.6 2.6-1.7 4M14.6 15.4A11 11 0 0 1 12 20c-4.4-3-6.5-5.6-6.5-8 0-.9.3-1.8.8-2.7" />
    </svg>
  );
}

export function Seru({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M12 4.5 21 20H3z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </svg>
  );
}

export function Info({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </svg>
  );
}

export function Silang({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function Kuas({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M4 20c1.8 0 3.2-.6 4-1.8.7-1.1.4-2.4-.6-3.1-1-.7-2.4-.6-3.2.5C3.4 16.6 3.2 18.4 4 20Z" />
      <path d="M9.4 15.6 19.5 5.5a2 2 0 0 0-2.8-2.8L6.6 12.8" />
    </svg>
  );
}

export function Perisai({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M12 3l7 2.6v5.6c0 4.4-2.8 7.6-7 9.8-4.2-2.2-7-5.4-7-9.8V5.6z" />
      <path d="M9 12l2.2 2.4L15.4 10" />
    </svg>
  );
}

export function Berkas({ size = 16, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <path d="M6 3h7l5 5v13H6z" />
      <path d="M13 3v5h5M9 13h6M9 16.5h4" />
    </svg>
  );
}

export function Kunci({ size = 14, className }: Props) {
  return (
    <svg {...dasar(size)} className={className}>
      <rect x="4.5" y="10" width="15" height="10" rx="1.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

/* ── Ikon jenis kerusakan (alur lapor) ─────────────────────── */

export function IkonJenis({
  jenis,
  size = 24,
  className,
}: Props & {
  jenis:
    | "lubang"
    | "retak"
    | "amblas"
    | "genangan"
    | "drainase_mampet"
    | "jembatan_rusak"
    | "lainnya";
}) {
  return (
    <svg {...dasar(size)} className={className}>
      {jenis === "lubang" && (
        <>
          <ellipse cx="12" cy="12.5" rx="8" ry="5.5" />
          <ellipse cx="11.4" cy="13.1" rx="4.2" ry="2.6" opacity="0.55" />
        </>
      )}
      {jenis === "retak" && (
        <path d="M13.5 3.5 9.5 10l4 2.6-3.4 4.2 2.4 3.7" />
      )}
      {jenis === "amblas" && (
        <>
          <path d="M3 8.5c2.6 5.4 15.4 5.4 18 0" />
          <path d="M3 8.5h18" strokeDasharray="2 3" />
          <path d="M4 8.5v4M20 8.5v4" />
        </>
      )}
      {jenis === "genangan" && (
        <>
          <path d="M3 10c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0" />
          <path d="M3 15c2-2.2 4-2.2 6 0s4 2.2 6 0 4-2.2 6 0" />
        </>
      )}
      {jenis === "drainase_mampet" && (
        <>
          <rect x="3.5" y="7.5" width="17" height="10" />
          <path d="M8 7.5v10M12 7.5v10M16 7.5v10" />
          <path d="M6 5.5l3.5 3M17.5 4.5l-2 3.5" />
        </>
      )}
      {jenis === "jembatan_rusak" && (
        <>
          <path d="M3 18v-6.5a9 9 0 0 1 18 0V18" />
          <path d="M3 18h18" />
          <path d="M12 3.2v3.4M12 6.6l-1.6 2.2M10.4 8.8l1.8 2" />
        </>
      )}
      {jenis === "lainnya" && (
        <>
          <circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
