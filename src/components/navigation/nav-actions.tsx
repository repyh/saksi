"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NavActionItem } from "./nav-types";

interface NavActionsProps {
  actions?: NavActionItem[];
  className?: string;
}

const DEFAULT_ACTIONS: NavActionItem[] = [
  {
    id: "peta-audit",
    label: "Peta Audit",
    href: "/",
    variant: "ghost",
  },
  {
    id: "lapor",
    label: "Lapor",
    href: "/lapor",
    variant: "ghost",
  },
];

export function NavActions({ actions = DEFAULT_ACTIONS, className = "" }: NavActionsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi Utama"
      className={cn("-mb-px flex h-full items-stretch gap-4 sm:gap-7", className)}
    >
      {actions.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Button
            key={item.id}
            render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
            nativeButton={false}
            variant={item.variant ?? "ghost"}
            className={cn(
              "h-full rounded-none border-0 border-b-[3px] px-1 py-0 bg-transparent hover:bg-transparent font-sans text-[11px] font-bold uppercase tracking-[0.15em] transition-colors active:translate-y-0",
              isActive
                ? "border-secondary text-secondary"
                : "border-transparent text-white/85 hover:border-white/35 hover:text-secondary"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
