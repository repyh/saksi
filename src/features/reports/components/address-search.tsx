"use client";

import { useEffect, useRef, useState } from "react";
import { FiMapPin, FiSearch } from "react-icons/fi";
import type { ApiResult } from "@/contracts/shared/api.contract";
import {
  geocodeResponseSchema,
  type GeocodeResult,
} from "@/contracts/reports/geocode.contract";
import { PHOTON_ATTRIBUTION } from "@/features/map/basemap";

export function AddressSearch({
  regionId,
  onSelect,
}: {
  regionId: string;
  onSelect: (result: GeocodeResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const bersih = query.trim();
    if (bersih.length < 3) return;
    const timer = window.setTimeout(() => {
      const urutan = ++requestRef.current;
      const controller = new AbortController();
      setError("");
      setLoading(true);
      fetch(`/api/geocode?${new URLSearchParams({ q: bersih, region: regionId })}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = await response.json() as ApiResult<unknown>;
          if (urutan !== requestRef.current) return;
          if (!response.ok || result.error) {
            throw new Error(result.error?.message ?? "Pencarian alamat belum dapat dimuat.");
          }
          const parsed = geocodeResponseSchema.safeParse(result.data);
          if (!parsed.success) throw new Error("Format hasil pencarian alamat tidak dikenali.");
          setResults(parsed.data.results);
          setOpen(true);
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          if (urutan !== requestRef.current) return;
          setResults([]);
          setOpen(false);
          setError(cause instanceof Error ? cause.message : "Pencarian alamat belum dapat dimuat.");
        })
        .finally(() => {
          if (urutan === requestRef.current) setLoading(false);
        });
      return () => controller.abort();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, regionId]);

  return (
    <div className="relative">
      <label htmlFor="report-address-search" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Cari alamat
      </label>
      <div className="relative mt-1.5">
        <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="report-address-search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setError("");
            if (value.trim().length < 3) {
              setResults([]);
              setOpen(false);
              setLoading(false);
            }
          }}
          placeholder="Contoh: Jl. Merdeka, Tangerang"
          autoComplete="off"
          className="min-h-10 w-full border border-input bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          aria-describedby="report-address-help"
        />
        {loading ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Mencari…</span> : null}
      </div>
      <p id="report-address-help" className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
        {PHOTON_ATTRIBUTION}. Hasil di luar Kota Tangerang tidak ditampilkan.
      </p>
      {error ? <p role="alert" className="mt-2 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-border bg-white shadow-lg">
          {results.map((result) => (
            <li key={`${result.osmType ?? "osm"}-${result.osmId ?? result.label}-${result.latitude}-${result.longitude}`} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onSelect(result);
                  setOpen(false);
                  setQuery(result.label);
                }}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
              >
                <FiMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block font-semibold leading-5 text-foreground">{result.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                    {[result.district, result.city].filter(Boolean).join(" · ") || `${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && !loading && results.length === 0 && !error ? (
        <p className="mt-2 text-xs text-muted-foreground">Tidak ada alamat di dalam Kota Tangerang yang cocok. Geser pin secara manual.</p>
      ) : null}
    </div>
  );
}
