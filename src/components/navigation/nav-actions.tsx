"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import type { NavActionItem } from "./nav-types";

interface NavActionsProps {
  actions?: NavActionItem[];
  className?: string;
}

const DEFAULT_ACTIONS: NavActionItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/",
    variant: "ghost",
  },
  {
    id: "peta-pekerjaan",
    label: "Peta Pekerjaan",
    href: "/project",
    variant: "ghost",
  },
  {
    id: "laporkan-jalan",
    label: "Laporkan Jalan",
    href: "/laporan/",
    variant: "ghost",
  },
  {
    id: "penyedia",
    label: "Penyedia",
    href: "/penyedia",
    variant: "ghost",
  },
];

export function NavActions({ actions = DEFAULT_ACTIONS, className = "" }: NavActionsProps) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const navigationActions = [
    ...actions,
    {
      id: "account-action",
      label: session ? "Dashboard" : "Masuk",
      href: session ? "/dashboard" : "/login?returnTo=%2Fdashboard",
      variant: "ghost" as const,
      isPrimary: true,
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama"
      className={cn("-mb-px flex h-full items-stretch gap-2 sm:gap-7", className)}
    >
      {navigationActions.map((item) => {
        if (item.id === "account-action" && isPending) {
          return <span key={item.id} aria-hidden="true" className="my-3 w-[4.5rem] animate-pulse bg-white/15 sm:w-20" />;
        }

        const normalizedHref = item.href.replace(/\/+$/, "") || "/";
        const isActive = pathname === normalizedHref || (normalizedHref !== "/" && pathname.startsWith(`${normalizedHref}/`));

        if (item.id === "account-action") {
          return (
            <Button
              key={item.id}
              render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
              nativeButton={false}
              variant="ghost"
              className={cn(
                "my-auto h-9 rounded-sm border px-3 font-sans text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:ring-white sm:px-4 sm:text-[11px]",
                session
                  ? "border-secondary bg-secondary text-secondary-foreground hover:bg-[#f2cf00]"
                  : "border-white/80 bg-transparent text-white hover:bg-white/10 hover:text-white"
              )}
            >
              {item.label}
            </Button>
          );
        }

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
