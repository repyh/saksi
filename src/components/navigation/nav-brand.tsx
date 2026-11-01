import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavBrandConfig } from "./nav-types";

interface NavBrandProps {
  config?: NavBrandConfig;
  className?: string;
}

const DEFAULT_BRAND: NavBrandConfig = {
  shortName: "SAKSI",
  fullName: "Sistem Akuntabilitas & Komparasi Spasial Infrastruktur",
  href: "/",
};

export function NavBrand({ config = DEFAULT_BRAND, className = "" }: NavBrandProps) {
  const { shortName, fullName, href = "/" } = config;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-w-0 items-center gap-3.5 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={`${shortName} — ${fullName}`}
    >
      <span className="shrink-0 font-heading text-sm font-black uppercase tracking-[0.28em] text-white">
        {shortName}
      </span>

      <span className="hidden h-4 w-px bg-white/35 sm:inline-block" aria-hidden="true" />

      <span className="hidden truncate font-sans text-xs font-normal tracking-normal text-white/80 sm:inline-block">
        {fullName}
      </span>
    </Link>
  );
}
