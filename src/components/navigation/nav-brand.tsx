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
        "inline-flex items-center gap-3.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs",
        className
      )}
      aria-label={`${shortName} — ${fullName}`}
    >
      <span className="font-heading text-sm font-black uppercase tracking-[0.26em] text-primary">
        {shortName}
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="hidden font-sans text-xs font-normal tracking-normal text-muted-foreground sm:inline-block">
        {fullName}
      </span>
    </Link>
  );
}
