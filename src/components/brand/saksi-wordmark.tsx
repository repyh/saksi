import { cn } from "@/lib/utils";
import { WORDMARK_ASPECT, WORDMARK_PATH, WORDMARK_VIEWBOX } from "./mark-geometry";

interface SaksiWordmarkProps {
  /** Tinggi huruf kapital dalam px. */
  capHeight?: number;
  className?: string;
}

export function SaksiWordmark({ capHeight = 12, className }: SaksiWordmarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0 fill-current", className)}
      width={Math.round(capHeight * WORDMARK_ASPECT * 100) / 100}
      height={capHeight}
      viewBox={WORDMARK_VIEWBOX}
    >
      <path d={WORDMARK_PATH} />
    </svg>
  );
}
