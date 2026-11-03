"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type LoginFormProps = {
  returnTo: string;
};

export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password, rememberMe });
      if (result.error) {
        setErrorMessage(
          result.error.status === 503
            ? "Layanan autentikasi belum tersedia. Coba lagi nanti."
            : result.error.status === 429
              ? "Terlalu banyak percobaan masuk. Tunggu sebentar, lalu coba lagi."
              : result.error.status === 401
                ? "Email atau kata sandi belum cocok."
                : "Tidak dapat masuk. Periksa kembali data Anda lalu coba lagi.",
        );
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch {
      setErrorMessage("Tidak dapat terhubung ke layanan autentikasi. Coba lagi nanti.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" aria-describedby={errorMessage ? "login-error" : undefined}>
      <div className="space-y-2">
        <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-[0.12em] text-foreground">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full border border-border bg-white px-3.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="nama@contoh.id"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-[0.12em] text-foreground">
          Kata sandi
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full border border-border bg-white px-3.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Masukkan kata sandi"
        />
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="rememberMe"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        Ingat saya
      </label>

      {errorMessage && (
        <p id="login-error" role="alert" className="border-l-2 border-destructive bg-destructive/5 px-3 py-2.5 text-sm leading-5 text-foreground">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full items-center justify-center bg-primary px-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-65"
      >
        {isSubmitting ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
