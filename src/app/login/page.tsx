import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Masuk",
  description: "Masuk ke akun SAKSI.",
  path: "/login",
  index: false,
});

function safeReturnTo(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/peta-pekerjaan";
  }
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;

  return (
    <main className="relative isolate flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-4 py-12 sm:px-8 sm:py-16">
      <div
        aria-hidden="true"
        className="absolute inset-[-3px] -z-10 scale-[1.01] bg-cover bg-center blur-[1px]"
        style={{ backgroundImage: "url('/images/login-road.jpg')" }}
      />
      <div className="relative z-10 w-full max-w-5xl">
      <section aria-labelledby="login-title" className="grid w-full bg-white shadow-xl shadow-foreground/15 md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative flex min-h-48 flex-col justify-between overflow-hidden border-b-[5px] border-secondary bg-primary p-6 text-white sm:p-9 md:min-h-[31rem] md:border-b-0 md:border-r-[5px] md:p-12">
          <span aria-hidden="true" className="font-heading text-sm font-black uppercase tracking-[0.28em]">SAKSI</span>
          <div className="mt-10 max-w-sm md:mt-0">
            <h1 id="login-title" className="font-heading text-3xl leading-[1.12] font-extrabold tracking-[-0.035em] sm:text-4xl">
              Masuk ke akun Anda.
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/80">
              Gunakan akun yang telah diberi akses oleh pengelola SAKSI.
            </p>
          </div>
          <Link href="/" className="mt-8 w-fit text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-secondary hover:decoration-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Kembali ke beranda
          </Link>
        </div>

        <div className="flex items-center bg-white p-6 sm:p-9 md:p-12">
          <div className="w-full max-w-md">
            <h2 className="font-heading text-2xl font-bold tracking-[-0.025em] text-foreground">Masuk</h2>
            <p className="mt-2 mb-8 text-sm leading-6 text-muted-foreground">
              Masukkan email dan kata sandi akun Anda.
            </p>
            <LoginForm returnTo={safeReturnTo(returnTo)} />
          </div>
        </div>
      </section>
      <p className="mt-3 text-right text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
        Foto oleh{" "}
        <a
          href="https://unsplash.com/photos/an-overhead-view-of-a-city-street-with-lots-of-traffic-vfg8CJZxSUs"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          David Kristianto / Unsplash
        </a>
      </p>
      </div>
    </main>
  );
}
