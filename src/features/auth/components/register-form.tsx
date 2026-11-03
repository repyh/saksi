"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const [inviteToken, setInviteToken] = useState("");
  const [inviteResolved, setInviteResolved] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get("invite") ?? "";
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setInviteToken(token);
      setInviteResolved(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !inviteToken) return;
    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi belum cocok.");
      return;
    }
    if (password.length < 12) {
      setErrorMessage("Kata sandi harus terdiri dari minimal 12 karakter.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const result = await authClient.signUp.email(
        { name: name.trim(), email: email.trim(), password },
        { headers: { "x-saksi-invite-token": inviteToken } },
      );
      if (result.error) {
        setErrorMessage(
          result.error.status === 503
            ? "Layanan autentikasi belum tersedia. Coba lagi nanti."
            : result.error.status === 429
              ? "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi."
              : "Undangan tidak valid, kedaluwarsa, atau tidak sesuai dengan email. Periksa kembali data Anda atau minta undangan baru.",
        );
        return;
      }
      setIsRegistered(true);
    } catch {
      setErrorMessage("Tidak dapat terhubung ke layanan autentikasi. Coba lagi nanti.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!inviteResolved) {
    return <p className="text-sm leading-6 text-muted-foreground" role="status">Memeriksa tautan undangan…</p>;
  }

  if (isRegistered) {
    return (
      <div className="space-y-5" role="status" aria-live="polite">
        <div className="border-l-4 border-primary bg-muted px-4 py-4">
          <h3 className="font-heading text-lg font-bold text-foreground">Akun berhasil dibuat</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Undangan sudah digunakan. Masuk dengan email dan kata sandi yang baru Anda buat.
          </p>
        </div>
        <Link href="/login" className="flex h-12 w-full items-center justify-center bg-primary px-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Masuk ke SAKSI
        </Link>
      </div>
    );
  }

  if (!inviteToken) {
    return (
      <div className="space-y-5">
        <p className="border-l-2 border-secondary bg-muted px-3 py-3 text-sm leading-6 text-foreground">
          Tautan undangan tidak ditemukan. Buka tautan personal dari pengelola SAKSI atau minta undangan baru.
        </p>
        <Link href="/login" className="inline-flex text-sm font-semibold text-primary underline underline-offset-4 hover:text-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby={errorMessage ? "register-error" : undefined}>
      <div className="space-y-2">
        <label htmlFor="register-name" className="block text-xs font-bold uppercase tracking-[0.12em] text-foreground">Nama</label>
        <input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 w-full border border-border bg-white px-3.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Nama Anda"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="register-email" className="block text-xs font-bold uppercase tracking-[0.12em] text-foreground">Email undangan</label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full border border-border bg-white px-3.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="nama@contoh.id"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="register-password" className="block text-xs font-bold uppercase tracking-[0.12em] text-foreground">Kata sandi</label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full border border-border bg-white px-3.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Minimal 12 karakter"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="register-confirm-password" className="block text-xs font-bold uppercase tracking-[0.12em] text-foreground">Ulangi kata sandi</label>
        <input
          id="register-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-12 w-full border border-border bg-white px-3.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Ulangi kata sandi"
        />
      </div>

      {errorMessage && (
        <p id="register-error" role="alert" className="border-l-2 border-destructive bg-destructive/5 px-3 py-2.5 text-sm leading-5 text-foreground">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex h-12 w-full cursor-pointer items-center justify-center bg-primary px-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-65"
      >
        {isSubmitting ? "Membuat akun…" : "Buat akun"}
      </button>
      <p className="text-xs leading-5 text-muted-foreground">
        Undangan sekali pakai akan ditandai terpakai setelah akun berhasil dibuat. Akun baru tidak memperoleh izin khusus secara otomatis.
      </p>
    </form>
  );
}
