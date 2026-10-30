import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Desa, Paket, Presisi } from "../lib/paket";
import { angka, labelPresisi, rupiahRingkas } from "../lib/paket";
import { Glyph } from "./Badge";

const WARNA: Record<Presisi, string> = {
  "Desa/Kelurahan": "#b3261e",
  "Garis Koridor": "#1d4e89",
  Kecamatan: "#5b5348",
  Kabupaten: "#a79c8c",
};

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

type IsiPeta = { lingkaran?: L.CircleMarker; garis?: L.Polyline };

export default function Peta({
  paket,
  desa,
  terpilih,
  onPilih,
}: {
  paket: Paket[];
  desa: Desa[];
  terpilih: Paket | null;
  onPilih: (p: Paket) => void;
}) {
  const wadah = useRef<HTMLDivElement | null>(null);
  const peta = useRef<L.Map | null>(null);
  const lapis = useRef<L.LayerGroup | null>(null);
  const kanvas = useRef<L.Canvas | null>(null);
  const isi = useRef<Map<string, IsiPeta>>(new Map());
  const cincin = useRef<L.CircleMarker | null>(null);
  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;

  /* Inisialisasi peta — sekali. */
  useEffect(() => {
    if (!wadah.current || peta.current) return;

    const m = L.map(wadah.current, {
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
      minZoom: 9,
      maxZoom: 18,
      zoomSnap: 0.5,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m);

    kanvas.current = L.canvas({ padding: 0.4, tolerance: 6 });
    lapis.current = L.layerGroup().addTo(m);

    if (desa.length > 0) {
      const batas = L.latLngBounds(desa.map((d) => [d.lat, d.lon] as [number, number]));
      m.fitBounds(batas, { padding: [28, 28] });
    } else {
      m.setView([-6.18, 106.5], 10);
    }

    peta.current = m;

    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(wadah.current);

    return () => {
      ro.disconnect();
      m.remove();
      peta.current = null;
      lapis.current = null;
      isi.current.clear();
      cincin.current = null;
    };
  }, [desa]);

  /* Layer data — dibangun ulang saat hasil filter berubah. */
  useEffect(() => {
    const g = lapis.current;
    if (!g) return;
    g.clearLayers();
    isi.current.clear();
    cincin.current = null;

    const renderer = kanvas.current ?? undefined;

    for (const p of paket) {
      if (p.lat == null || p.lon == null) continue; // 271 paket tanpa lokus tidak dipetakan

      if (p.presisi_peta === "Garis Koridor" && p.koridor) {
        const garis = L.polyline(
          [
            [p.koridor.lat_dari, p.koridor.lon_dari],
            [p.koridor.lat_ke, p.koridor.lon_ke],
          ],
          {
            renderer,
            color: WARNA["Garis Koridor"],
            weight: 2,
            opacity: 0.75,
            interactive: true,
          },
        );
        garis.bindTooltip(`${esc(p.koridor.dari)} – ${esc(p.koridor.ke)}`, {
          sticky: true,
          direction: "top",
        });
        garis.on("click", () => pilihRef.current(p));
        garis.addTo(g);
        isi.current.set(p.kode_rup, { garis });
      }

      const lingkaran = L.circleMarker([p.lat, p.lon], {
        renderer,
        radius: 4,
        weight: 1,
        color: "#16120e",
        opacity: 0.35,
        fillColor: WARNA[p.presisi_peta] ?? WARNA.Kecamatan,
        fillOpacity: p.presisi_peta === "Kecamatan" ? 0.62 : 0.8,
      });

      lingkaran.bindTooltip(
        `<div style="max-width:248px;line-height:1.4">
           <div style="font-weight:500">${esc(p.nama)}</div>
           <div style="margin-top:3px;opacity:.7">${esc(
             p.presisi_peta === "Garis Koridor" && p.koridor
               ? `${p.koridor.dari} – ${p.koridor.ke}`
               : (p.desa_resmi ?? "Kab. Tangerang"),
           )} · ${labelPresisi(p)} · ${rupiahRingkas(p.pagu)}</div>
         </div>`,
        { direction: "top", sticky: true },
      );
      lingkaran.on("click", () => pilihRef.current(p));
      lingkaran.addTo(g);

      const lama = isi.current.get(p.kode_rup);
      isi.current.set(p.kode_rup, { ...lama, lingkaran });
    }
  }, [paket]);

  /* Sorotan paket terpilih — hanya dua marker yang disentuh. */
  useEffect(() => {
    const m = peta.current;
    if (!m) return;

    if (cincin.current) {
      cincin.current.remove();
      cincin.current = null;
    }

    for (const { lingkaran, garis } of isi.current.values()) {
      if (!lingkaran) continue;
      lingkaran.setStyle({ weight: 1, color: "#16120e", opacity: 0.35 });
      lingkaran.setRadius(4);
      if (garis) garis.setStyle({ weight: 2, color: WARNA["Garis Koridor"], opacity: 0.75 });
    }

    if (!terpilih || terpilih.lat == null || terpilih.lon == null) return;

    const sasaran = isi.current.get(terpilih.kode_rup);
    if (sasaran?.lingkaran) {
      sasaran.lingkaran.setStyle({ weight: 2, color: "#b3261e", opacity: 1 });
      sasaran.lingkaran.setRadius(7);
      sasaran.lingkaran.bringToFront();
    }
    if (sasaran?.garis) {
      sasaran.garis.setStyle({ weight: 3.5, color: "#b3261e", opacity: 0.95 });
      sasaran.garis.bringToFront();
    }

    cincin.current = L.circleMarker([terpilih.lat, terpilih.lon], {
      renderer: kanvas.current ?? undefined,
      radius: 12,
      weight: 1,
      color: "#b3261e",
      opacity: 0.4,
      fill: false,
      interactive: false,
    }).addTo(m);

    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Koridor: bingkai kedua ujung ruas, bukan satu titik tengah. */
    if (terpilih.presisi_peta === "Garis Koridor" && terpilih.koridor) {
      const b = L.latLngBounds([
        [terpilih.koridor.lat_dari, terpilih.koridor.lon_dari],
        [terpilih.koridor.lat_ke, terpilih.koridor.lon_ke],
      ]);
      if (kurangiGerak) m.fitBounds(b, { padding: [64, 64], maxZoom: 14 });
      else m.flyToBounds(b, { padding: [64, 64], maxZoom: 14, duration: 0.9 });
      return;
    }

    const zoom = Math.max(m.getZoom(), 13);
    if (kurangiGerak) m.setView([terpilih.lat, terpilih.lon], zoom);
    else m.flyTo([terpilih.lat, terpilih.lon], zoom, { duration: 0.9 });
  }, [terpilih]);

  const totalTitik = useMemo(
    () => paket.reduce((n, p) => (p.lat != null && p.lon != null ? n + 1 : n), 0),
    [paket],
  );

  const hitung = useMemo(() => {
    const n: Record<string, number> = { "Desa/Kelurahan": 0, "Garis Koridor": 0, Kecamatan: 0 };
    for (const p of paket) {
      if (p.lat != null && n[p.presisi_peta] !== undefined) n[p.presisi_peta] += 1;
    }
    return n;
  }, [paket]);

  return (
    <div className="peta relative h-full w-full">
      <div ref={wadah} className="h-full w-full" role="application" aria-label="Peta paket jalan" />

      {totalTitik === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[800] w-[min(92%,420px)] -translate-x-1/2 border border-line bg-card px-3 py-2 text-center">
          <p className="text-xs text-ink-soft">Tidak ada paket bertitik pada filter ini.</p>
          <p className="mt-0.5 text-2xs text-muted">
            Paket tanpa penanda lokasi tetap ada di tabel, tidak dipetakan.
          </p>
        </div>
      )}

      <div
        className="pointer-events-none absolute bottom-6 left-3 z-[800] border border-line bg-card/95 px-3 py-2.5"
        aria-hidden="true"
      >
        <div className="label mb-2">Presisi peta</div>
        <ul className="grid gap-1.5 text-2xs text-ink-soft">
          {(
            [
              ["Desa/Kelurahan", "Titik Desa"],
              ["Garis Koridor", "Garis Koridor"],
              ["Kecamatan", "Kecamatan"],
            ] as Array<[Presisi, string]>
          ).map(([presisi, teks]) => (
            <li key={presisi} className="flex items-center gap-2">
              <Glyph presisi={presisi} size={10} />
              <span>{teks}</span>
              <span className="num ml-auto pl-3 text-muted">{angka(hitung[presisi] ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
