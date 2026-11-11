import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { createPageMetadata } from "@/lib/seo";

export const metadata = {
  ...createPageMetadata({
    title: "Buat akun",
    description: "Buat akun SAKSI menggunakan undangan personal.",
    path: "/register",
    index: false,
  }),
  referrer: "no-referrer",
};

export default function RegisterPage() {
  return (
    <main className="relative isolate flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-4 py-10 sm:px-8 sm:py-14">
      <div
        aria-hidden="true"
        className="absolute inset-[-3px] -z-10 scale-[1.01] bg-cover bg-center blur-[1px]"
        style={{ backgroundImage: "url('/images/login-road.jpg')" }}
      />
      <div className="relative z-10 w-full max-w-5xl">
        <section aria-labelledby="register-title" className="grid w-full bg-white shadow-xl shadow-foreground/15 md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative flex min-h-48 flex-col justify-between overflow-hidden border-b-[5px] border-secondary bg-primary p-6 text-white sm:p-9 md:min-h-[34rem] md:border-b-0 md:border-r-[5px] md:p-12">
            <span className="font-heading text-sm font-black uppercase tracking-[0.28em]">SAKSI</span>
            <div className="mt-10 max-w-sm md:mt-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Akun undangan</p>
              <h1 id="register-title" className="mt-3 font-heading text-3xl leading-[1.12] font-extrabold tracking-[-0.035em] sm:text-4xl">
                Akses dimulai dari undangan.
              </h1>
              <p className="mt-4 max-w-xs text-sm leading-6 text-white/80">
                Buat akun menggunakan tautan personal dari pengelola SAKSI. Akun baru tidak mendapat izin khusus secara otomatis.
              </p>
            </div>
            <Link href="/" className="mt-8 w-fit text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:text-secondary hover:decoration-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Kembali ke beranda
            </Link>
          </div>

          <div className="flex items-center bg-white p-6 sm:p-9 md:p-12">
            <div className="w-full max-w-md">
              <h2 className="font-heading text-2xl font-bold tracking-[-0.025em] text-foreground">Buat akun</h2>
              <p className="mt-2 mb-8 text-sm leading-6 text-muted-foreground">
                Gunakan alamat email yang menerima undangan.
              </p>
              <RegisterForm />
            </div>
          </div>
        </section>
        <p className="mt-3 text-right text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
          Foto oleh{" "}
          <a
            href="https://unsplash.com/photos/an-overhead-view-of-a-city-street-with-lots-of-traffic-vfg8CJZxSUs"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-white/50 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            David Kristianto / Unsplash
          </a>
        </p>
      </div>
    </main>
  );
}
