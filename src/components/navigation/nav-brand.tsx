import Link from "next/link";
import { SaksiLogo } from "@/components/brand";
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
        "inline-flex min-w-0 items-center rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={`${shortName} — ${fullName}`}
    >
      <SaksiLogo variant="horizontal-full" tone="onDark" size={30} />
    </Link>
  );
}
