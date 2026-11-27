import type { ReactNode } from "react";

interface CatalogPageShellProps {
  variant: "directory" | "detail";
  header: ReactNode;
  children: ReactNode;
}

const widthByVariant = {
  directory: "max-w-6xl",
  detail: "max-w-5xl",
} as const;

export function CatalogPageShell({ variant, header, children }: CatalogPageShellProps) {
  const width = widthByVariant[variant];

  return (
    <main className="min-h-screen bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className={`mx-auto w-full ${width} px-4 ${variant === "directory" ? "py-10" : "py-8"} sm:px-6 lg:px-8`}>
          {header}
        </div>
      </section>
      <section className={`mx-auto w-full ${width} px-4 py-8 sm:px-6 lg:px-8`}>
        {children}
      </section>
    </main>
  );
}

export function CatalogDirectoryLoading({ label, searchMaxWidth = "max-w-4xl" }: { label: string; searchMaxWidth?: string }) {
  return (
    <CatalogPageShell
      variant="directory"
      header={
        <div aria-busy="true" aria-label={label}>
          <div className="h-9 w-72 animate-pulse bg-muted" />
          <div className="mt-3 h-5 max-w-2xl animate-pulse bg-muted/80" />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse bg-muted/60" />
            ))}
          </div>
          <div className={`mt-6 h-10 ${searchMaxWidth} animate-pulse bg-muted/70`} />
        </div>
      }
    >
      <div className="space-y-2 border border-border p-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse bg-muted/30" />
        ))}
      </div>
    </CatalogPageShell>
  );
}
