"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import type { NavActionItem } from "./nav-types";

interface NavActionsProps {
  actions?: NavActionItem[];
  className?: string;
}

const DEFAULT_ACTIONS: NavActionItem[] = [
  { id: "home", label: "Home", href: "/", variant: "ghost" },
  { id: "peta-pekerjaan", label: "Peta Pekerjaan", href: "/peta-pekerjaan", variant: "ghost" },
  { id: "project", label: "Proyek Jalan", href: "/project", variant: "ghost" },
  { id: "penyedia", label: "Penyedia", href: "/penyedia", variant: "ghost" },
  { id: "metode", label: "Metode", href: "/metode", variant: "ghost" },
  { id: "laporkan-jalan", label: "Laporkan Jalan", href: "/laporan/", variant: "ghost" },
];

export function NavActions({ actions = DEFAULT_ACTIONS, className = "" }: NavActionsProps) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

  function isActive(href: string) {
    const route = href.split("?")[0].replace(/\/+$/, "") || "/";
    return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));
  }

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className={cn("-mb-px hidden h-full items-stretch gap-4 lg:flex 2xl:gap-7", className)}
      >
        {navigationActions.map((item) => {
          if (item.id === "account-action" && isPending) {
            return <span key={item.id} aria-hidden="true" className="my-3 w-20 animate-pulse bg-white/15" />;
          }

          const active = isActive(item.href);
          const isAccount = item.id === "account-action";
          const isReport = item.id === "laporkan-jalan";

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center justify-center font-sans font-bold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                isAccount
                  ? cn(
                    "my-auto h-9 rounded-sm border px-4 text-[11px] tracking-[0.12em]",
                    session
                      ? "border-secondary bg-secondary text-secondary-foreground hover:bg-[#f2cf00]"
                      : "border-white/80 bg-transparent text-white hover:bg-white/10"
                  )
                  : isReport
                    ? cn(
                      "my-auto h-9 rounded-sm border px-4 text-[11px] tracking-[0.12em] text-white",
                      active
                        ? "border-secondary bg-white/15 text-secondary"
                        : "border-white/70 bg-white/5 hover:bg-white/15 hover:text-white"
                    )
                    : cn(
                      "h-full rounded-none border-0 border-b-[3px] px-1 py-0 text-[11px] tracking-[0.15em]",
                      active
                        ? "border-secondary text-secondary"
                        : "border-transparent text-white/85 hover:border-white/35 hover:text-secondary"
                    )
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="relative flex items-center lg:hidden">
        <button
          ref={mobileMenuButtonRef}
          type="button"
          aria-label={isMobileMenuOpen ? "Tutup navigasi" : "Buka navigasi"}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-primary-navigation"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="inline-flex size-10 items-center justify-center border border-white/65 text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {isMobileMenuOpen ? <FiX aria-hidden="true" className="size-5" /> : <FiMenu aria-hidden="true" className="size-5" />}
        </button>

        <nav
          id="mobile-primary-navigation"
          aria-label="Navigasi utama"
          hidden={!isMobileMenuOpen}
          className={cn(
            "absolute top-full right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] border border-white/20 bg-primary p-2 shadow-lg shadow-foreground/20",
            isMobileMenuOpen ? "grid" : "hidden"
          )}
        >
            {navigationActions.map((item) => {
              if (item.id === "account-action" && isPending) {
                return <span key={item.id} aria-hidden="true" className="m-2 h-10 animate-pulse bg-white/15" />;
              }

              const active = isActive(item.href);
              const isAccount = item.id === "account-action";
              const isReport = item.id === "laporkan-jalan";
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center border-b border-white/15 px-3 text-sm font-semibold text-white transition-colors last:border-b-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white",
                    active && "bg-white/10 text-secondary",
                    isReport && "my-1 border border-white/65 bg-white/5",
                    isAccount && session && "my-1 border-0 bg-secondary text-secondary-foreground hover:bg-[#f2cf00]",
                    isAccount && !session && "my-1 border border-white/65 bg-white/5"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>
      </div>
    </>
  );
}
