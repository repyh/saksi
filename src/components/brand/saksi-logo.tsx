import { cn } from "@/lib/utils";
import { BRAND_FULL_NAME } from "./mark-geometry";
import { SaksiMark } from "./saksi-mark";
import { SaksiWordmark } from "./saksi-wordmark";

export type SaksiLogoVariant = "mark" | "horizontal" | "horizontal-full" | "stacked";
export type SaksiLogoTone = "onLight" | "onDark" | "mono";

interface SaksiLogoProps {
  variant?: SaksiLogoVariant;
  /** onLight: emblem penuh di atas putih. onDark: emblem putih di atas cobalt/navy. mono: satu warna navy. */
  tone?: SaksiLogoTone;
  /** Tinggi emblem dalam px. Huruf dan jarak mengikuti proporsi ini. */
  size?: number;
  className?: string;
}

const TONE_CLASS: Record<SaksiLogoTone, string> = {
  onLight: "text-primary",
  onDark: "text-white",
  mono: "text-foreground",
};

export function SaksiLogo({ variant = "horizontal", tone = "onLight", size = 26, className }: SaksiLogoProps) {
  const capHeight = Math.round(size * 0.52 * 100) / 100;
  const markGap = Math.round(size * 0.5);
  const markVariant = tone === "onLight" ? "penuh" : "mono";

  if (variant === "mark") {
    return <SaksiMark size={size} variant={markVariant} className={cn(TONE_CLASS[tone], className)} />;
  }

  if (variant === "stacked") {
    return (
      <span
        className={cn("inline-flex flex-col items-center", TONE_CLASS[tone], className)}
        style={{ gap: Math.round(size * 0.32) }}
      >
        <SaksiMark size={size} variant={markVariant} />
        <SaksiWordmark capHeight={capHeight} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center", TONE_CLASS[tone], className)} style={{ gap: markGap }}>
      <SaksiMark size={size} variant={markVariant} />
      <SaksiWordmark capHeight={capHeight} />
      {variant === "horizontal-full" ? (
        <>
          <span
            aria-hidden="true"
            className="hidden w-px shrink-0 bg-current opacity-40 sm:block"
            style={{ height: Math.round(capHeight * 1.35) }}
          />
          <span className="hidden truncate font-sans text-xs font-normal tracking-normal opacity-80 sm:inline">
            {BRAND_FULL_NAME}
          </span>
        </>
      ) : null}
    </span>
  );
}
