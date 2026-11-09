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
