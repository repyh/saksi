"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiMenu, FiX } from "react-icons/fi";
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
    href: "/peta-pekerjaan",
    variant: "ghost",
  },
  {
    id: "project",
    label: "Proyek Jalan",
    href: "/project",
    variant: "ghost",
  },
  {
    id: "penyedia",
    label: "Penyedia",
    href: "/penyedia",
    variant: "ghost",
  },
  {
    id: "metode",
    label: "Metode",
    href: "/metode",
    variant: "ghost",
  },
  {
    id: "laporkan-jalan",
    label: "Laporkan Jalan",
    href: "/laporan/",
    variant: "ghost",
  },
];

const REPORT_ACTION = DEFAULT_ACTIONS.find((item) => item.id === "laporkan-jalan")!;

function isActivePath(pathname: string, href: string) {
  const normalizedHref = href.replace(/\/+$/, "") || "/";
  return pathname === normalizedHref || (normalizedHref !== "/" && pathname.startsWith(`${normalizedHref}/`));
}

export function NavActions({ actions = DEFAULT_ACTIONS, className = "" }: NavActionsProps) {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  const reportAction = actions.find((item) => item.id === "laporkan-jalan") ?? REPORT_ACTION;
  const secondaryActions = actions.filter((item) => item.id !== "laporkan-jalan");
  const account: NavActionItem = {
    id: "account-action",
    label: session ? "Dashboard" : "Masuk",
    href: session ? "/dashboard" : "/login?returnTo=%2Fdashboard",
  };

  useEffect(() => {
    navRef.current?.setAttribute("data-nav-ready", "true");
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Navigasi Utama"
        className={cn("hidden h-full items-stretch gap-7 md:flex", className)}
      >
        {[...actions, account].map((item) => {
          if (item.id === "account-action" && isPending) {
            return <span key={item.id} aria-hidden="true" className="my-3 w-20 animate-pulse bg-white/15" />;
          }

          const isActive = isActivePath(pathname, item.href);

          if (item.id === "account-action") {
            return (
              <Button
                key={item.id}
                render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
                nativeButton={false}
                variant="ghost"
                className={cn(
                  "my-auto h-9 rounded-sm border px-4 font-sans text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:ring-white",
                  session
                    ? "border-secondary bg-secondary text-secondary-foreground hover:bg-[#f2cf00]"
                    : "border-white/80 bg-transparent text-white hover:bg-white/10 hover:text-white"
                )}
              >
                {item.label}
              </Button>
            );
          }

          if (item.id === "laporkan-jalan") {
            return (
              <Button
                key={item.id}
                render={<Link href={item.href} aria-current={isActive ? "page" : undefined} />}
                nativeButton={false}
                variant="ghost"
                className={cn(
                  "my-auto h-9 rounded-sm border px-4 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors focus-visible:ring-white",
                  isActive
                    ? "border-secondary bg-white/15 text-white"
                    : "border-white/70 bg-white/5 hover:bg-white/15 hover:text-white"
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
                  ? "border-secondary text-white"
                  : "border-transparent text-white/85 hover:border-white/35 hover:text-secondary"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>

      <div className="flex items-center gap-1.5 md:hidden">
        <Link
          href={reportAction.href}
          aria-current={isActivePath(pathname, reportAction.href) ? "page" : undefined}
          className="inline-flex min-h-10 items-center border border-secondary bg-secondary px-2.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {reportAction.label.replace(" Jalan", "")}
        </Link>
        {isPending ? (
          <span aria-hidden="true" className="h-10 w-14 animate-pulse bg-white/15" />
        ) : (
          <Link
            href={account.href}
            aria-current={isActivePath(pathname, account.href) ? "page" : undefined}
            className="inline-flex min-h-10 items-center border border-white/80 px-2.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {account.label}
          </Link>
        )}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-panel"
          aria-label={menuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          className="inline-flex size-10 shrink-0 items-center justify-center border border-white/60 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {menuOpen ? <FiX aria-hidden="true" className="size-5" /> : <FiMenu aria-hidden="true" className="size-5" />}
        </button>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation-panel"
          className="absolute inset-x-0 top-full z-50 border-b border-white/20 bg-primary shadow-lg md:hidden"
        >
          <nav aria-label="Navigasi utama ponsel" className="mx-auto w-full max-w-7xl px-4 py-2">
            <ul>
              {secondaryActions.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.id} className="border-b border-white/15 last:border-b-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center font-sans text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                        active ? "text-secondary" : "text-white"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
