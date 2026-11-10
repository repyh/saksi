"use client";

import { useEffect, useRef, useState } from "react";
import { FiChevronRight, FiSearch, FiX } from "react-icons/fi";
import type { ApiResult } from "@/contracts/shared/api.contract";
import {
  roadGroupsResponseSchema,
  roadSegmentsResponseSchema,
  type RoadGroup,
  type RoadSegment,
} from "@/contracts/reports/road-search.contract";

const CLASS_LABELS: Record<string, string> = {
  motorway: "Tol",
  trunk: "Jalan utama",
  primary: "Primer",
  secondary: "Sekunder",
  tertiary: "Tersier",
  unclassified: "Belum berkelas",
  residential: "Permukiman",
  living_street: "Jalan lingkungan",
  service: "Jalan servis",
  track: "Jalan setapak kendaraan",
  pedestrian: "Zona pejalan kaki",
  road: "Jalan",
};

function formatMeters(value: number | null) {
  if (value === null) return null;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m`;
}

export function RoadSearch({
  regionId,
  selected,
  onSelect,
}: {
  regionId: string;
  selected: RoadSegment | null;
  onSelect: (segment: RoadSegment | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<RoadGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<RoadGroup | null>(null);
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const bersih = query.trim();
    if (bersih.length < 2) return;
    const timer = window.setTimeout(() => {
      const urutan = ++requestRef.current;
      const controller = new AbortController();
      setLoadingGroups(true);
      setError("");
      fetch(`/api/roads?${new URLSearchParams({ region: regionId, q: bersih })}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = await response.json() as ApiResult<unknown>;
          if (urutan !== requestRef.current) return;
          if (!response.ok || result.error) throw new Error(result.error?.message ?? "Pencarian ruas belum dapat dimuat.");
          const parsed = roadGroupsResponseSchema.safeParse(result.data);
          if (!parsed.success) throw new Error("Format pencarian ruas tidak dikenali.");
          setGroups(parsed.data.groups);
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          if (urutan !== requestRef.current) return;
          setGroups([]);
          setError(cause instanceof Error ? cause.message : "Pencarian ruas belum dapat dimuat.");
        })
        .finally(() => {
          if (urutan === requestRef.current) setLoadingGroups(false);
        });
      return () => controller.abort();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, regionId]);

  async function pilihGrup(group: RoadGroup) {
    setActiveGroup(group);
    setLoadingSegments(true);
    setError("");
    try {
      const params = new URLSearchParams({ region: regionId });
      if (group.name) params.set("name", group.name);
      else params.set("unnamed", "1");
      const response = await fetch(`/api/roads?${params}`, { headers: { Accept: "application/json" } });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.error) throw new Error(result.error?.message ?? "Ruas belum dapat dimuat.");
      const parsed = roadSegmentsResponseSchema.safeParse(result.data);
      if (!parsed.success) throw new Error("Format ruas tidak dikenali.");
      setSegments(parsed.data.segments);
    } catch (cause) {
      setSegments([]);
      setError(cause instanceof Error ? cause.message : "Ruas belum dapat dimuat.");
    } finally {
      setLoadingSegments(false);
    }
  }

  return (
    <div>
      <label htmlFor="report-road-search" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Cari atau pilih ruas
      </label>
      <div className="relative mt-1.5">
        <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="report-road-search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setActiveGroup(null);
            setSegments([]);
            if (value.trim().length < 2) {
              setGroups([]);
              setLoadingGroups(false);
            }
          }}
          placeholder="Nama jalan, minimal 2 karakter"
          autoComplete="off"
          className="min-h-10 w-full border border-input bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
        Satu nama dapat memiliki banyak segmen. Pilih nama, lalu pilih segmen di peta atau daftar. Ruas hanya anotasi, bukan penaut paket.
      </p>

      {selected ? (
        <div className="mt-3 flex items-start justify-between gap-3 border border-primary/40 bg-primary/5 px-3 py-2.5">
          <div className="min-w-0 text-xs leading-5">
            <p className="font-bold text-foreground">{selected.name ?? "Ruas tanpa nama"}</p>
            <p className="text-muted-foreground">
              {[CLASS_LABELS[selected.roadClass] ?? selected.roadClass, formatMeters(selected.lengthM), selected.widthM ? `lebar ${formatMeters(selected.widthM)}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" onClick={() => onSelect(null)} aria-label="Hapus pilihan ruas" className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
            <FiX aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {loadingGroups ? <p className="mt-2 text-xs text-muted-foreground">Mencari ruas…</p> : null}
      {error ? <p role="alert" className="mt-2 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}

      {!activeGroup && groups.length > 0 ? (
        <div className="mt-3 max-h-56 overflow-y-auto border border-border">
          <ul>
            {groups.map((group) => (
              <li key={group.name ?? "__tanpa_nama"} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => void pilihGrup(group)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-foreground">{group.name ?? "Tanpa nama"}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{group.count} segmen</span>
                  </span>
                  <FiChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeGroup ? (
        <div className="mt-3 border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
            <p className="min-w-0 truncate text-xs font-bold text-foreground">{activeGroup.name ?? "Tanpa nama"}</p>
            <button type="button" onClick={() => { setActiveGroup(null); setSegments([]); }} className="text-xs font-semibold text-primary hover:underline">
              Ganti nama
            </button>
          </div>
          {loadingSegments ? <p className="px-3 py-3 text-xs text-muted-foreground">Memuat segmen…</p> : null}
          {!loadingSegments && segments.length === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground">Tidak ada segmen pada nama ini.</p> : null}
          {!loadingSegments && segments.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto">
              {segments.map((segment) => {
                const active = selected?.id === segment.id;
                return (
                  <li key={segment.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelect(segment)}
                      aria-pressed={active}
                      className={`w-full px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary ${active ? "bg-primary/5" : ""}`}
                    >
                      <span className="block font-semibold text-foreground">
                        {segment.name ?? "Ruas tanpa nama"}{active ? " · dipilih" : ""}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                        {[CLASS_LABELS[segment.roadClass] ?? segment.roadClass, formatMeters(segment.lengthM), segment.widthM ? `lebar ${formatMeters(segment.widthM)}` : null, segment.surface].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
