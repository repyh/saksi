import { cn } from "@/lib/utils";
import { EMBLEM_ASPECT, EMBLEM_FRAME_PATH, EMBLEM_SOLID_PATH, EMBLEM_VIEWBOX } from "./mark-geometry";

interface SaksiMarkProps {
  /** Tinggi emblem dalam px. */
  size?: number;
  /** mono: satu warna (mewarisi currentColor). penuh: cobalt + kuning sesuai token. */
  variant?: "penuh" | "mono";
  className?: string;
}

export function SaksiMark({ size = 26, variant = "penuh", className }: SaksiMarkProps) {
  const height = size;
  const width = Math.round(size * EMBLEM_ASPECT * 100) / 100;

  if (variant === "mono") {
    return (
      <svg
        aria-hidden="true"
        className={cn("shrink-0 fill-current", className)}
        width={width}
        height={height}
        viewBox={EMBLEM_VIEWBOX}
      >
        <path fillRule="evenodd" d={EMBLEM_FRAME_PATH} />
        <path fillRule="evenodd" d={EMBLEM_SOLID_PATH} />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      width={width}
      height={height}
      viewBox={EMBLEM_VIEWBOX}
    >
      <path className="fill-secondary" fillRule="evenodd" d={EMBLEM_FRAME_PATH} />
      <path className="fill-primary" fillRule="evenodd" d={EMBLEM_SOLID_PATH} />
    </svg>
  );
}
