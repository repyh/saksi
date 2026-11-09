"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch } from "react-icons/fi";

interface PackageSearchFormProps {
  inputId: string;
}

export function PackageSearchForm({ inputId }: PackageSearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const search = query.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search) return;

    const params = new URLSearchParams({ q: search });
    router.push(`/peta-pekerjaan?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Cari paket pekerjaan"
      className="mx-auto flex min-h-14 w-full max-w-2xl items-center gap-3 border border-white/80 bg-white/95 px-4 text-left text-foreground transition-colors focus-within:border-secondary sm:gap-4 sm:px-5"
    >
      <FiSearch className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <label htmlFor={inputId} className="sr-only">
        Cari paket berdasarkan kelurahan, jalan, kecamatan, atau nomor RUP
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cari kelurahan, ruas jalan, atau nomor RUP"
        autoComplete="off"
        className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:text-base"
      />
      <button
        type="submit"
        disabled={!search}
        className="flex h-10 shrink-0 items-center justify-center bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        Cari
      </button>
    </form>
  );
}
