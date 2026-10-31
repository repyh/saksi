import { cn } from "@/lib/utils";
import { NavBrand } from "./nav-brand";
import { NavActions } from "./nav-actions";
import type { NavbarProps } from "./nav-types";

export function Navbar({
  brand,
  actions,
  className = "",
  sticky = true,
  extraContent,
}: NavbarProps) {
  return (
    <header
      className={cn(
        "w-full border-b border-white/25 bg-primary/90 supports-[backdrop-filter]:backdrop-blur-sm",
        sticky ? "sticky top-0 z-50" : "relative",
        className
      )}
    >
      <div className="flex h-16 w-full items-stretch justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <NavBrand config={brand} />
        </div>

        <div className="flex items-stretch gap-4">
          {extraContent && <div className="flex items-center">{extraContent}</div>}
          <NavActions actions={actions} />
        </div>
      </div>
    </header>
  );
}
