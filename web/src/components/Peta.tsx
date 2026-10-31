import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Desa, Paket } from "../lib/paket";
import { angka, rupiahRingkas } from "../lib/paket";

/**
 * Peta koroplet batas wilayah resmi Kota Tangerang.
 *
 * Sumber: ArcGIS Kota Tangerang — `Batas_Adminsitratif/batas_rw_2021` (1.020 poligon RW) dan
 * `Batas_Wilayah_Kelurahan_def` (104 poligon kelurahan). Paket TIDAK dipetakan sebagai titik:
 * nama paket memuat RW/kelurahan, bukan koordinat pekerjaan, jadi yang diwarnai adalah wilayah.
 *
 * Disclosure bertahap: zoom < 12 → kelurahan (104), zoom ≥ 12 → RW (1.020).
 */

const esc = (s: string) =>
  String(s).replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

const ZOOM_RW = 12;

const KELAS = [
  { min: 0, maks: 0, isi: "#ffffff", garis: "#bdb5ac", label: "Tidak ada paket" },
  { min: 1, maks: 1, isi: "#f7ddd8", garis: "#c9a29c", label: "1 paket" },
  { min: 2, maks: 3, isi: "#eda9a0", garis: "#b5736b", label: "2–3 paket" },
  { min: 4, maks: 6, isi: "#d4695e", garis: "#8f4038", label: "4–6 paket" },
  { min: 7, maks: 10, isi: "#b3261e", garis: "#6f1711", label: "7–10 paket" },
  { min: 11, maks: Number.MAX_SAFE_INTEGER, isi: "#7d150f", garis: "#4c0d09", label: "11+ paket" },
] as const;

const kelas = (n: number) => KELAS.find((k) => n >= k.min && n <= k.maks) ?? KELAS[0];

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const judul = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

type Props = Record<string, string | number | null>;
type Fitur = { type: "Feature"; properties: Props; geometry: unknown };
type FC = { type: string; features: Fitur[] };

export default function Peta({
  paket,
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
  const lapisRw = useRef<L.GeoJSON | null>(null);
  const lapisKel = useRef<L.GeoJSON | null>(null);
  const perWilayah = useRef<Map<string, L.Polygon>>(new Map());
  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;

  const [rw, setRw] = useState<FC | null>(null);
  const [kel, setKel] = useState<FC | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let hidup = true;
    Promise.all([
      fetch("/data/rw.geojson").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch("/data/kel.geojson").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([a, b]) => {
        if (!hidup) return;
        setRw(a);
        setKel(b);
      })
      .catch(() => {
        if (hidup) setGagal(true);
      });
    return () => {
      hidup = false;
    };
  }, []);

  /* Hitungan paket per unit RW dan per kelurahan. */
  const hitung = useMemo(() => {
    const perRw = new Map<string, { jumlah: number; pagu: number }>();
    const perKel = new Map<string, { jumlah: number; pagu: number }>();
    for (const p of paket) {
      if (p.presisi_peta === "RW" && p.unit_id) {
        const k = norm(p.unit_id);
        const lama = perRw.get(k);
        if (lama) {
          lama.jumlah += 1;
          lama.pagu += p.pagu;
        } else perRw.set(k, { jumlah: 1, pagu: p.pagu });
      }
      if (p.desa_resmi) {
        const k = norm(p.desa_resmi);
        const lama = perKel.get(k);
        if (lama) {
          lama.jumlah += 1;
          lama.pagu += p.pagu;
        } else perKel.set(k, { jumlah: 1, pagu: p.pagu });
      }
    }
    return { perRw, perKel };
  }, [paket]);

  const aturZoom = (zoom: number) => {
    const m = peta.current;
    if (!m) return;
    const rinci = zoom >= ZOOM_RW;
    const pasang = (g: L.LayerGroup | null, tampil: boolean) => {
      if (!g) return;
      if (tampil && !m.hasLayer(g)) g.addTo(m);
      if (!tampil && m.hasLayer(g)) m.removeLayer(g);
    };
    pasang(lapisKel.current, !rinci);
    pasang(lapisRw.current, rinci);
  };

  useEffect(() => {
    if (!wadah.current || peta.current) return;
    const m = L.map(wadah.current, { zoomControl: true, minZoom: 10, maxZoom: 18, zoomSnap: 0.5 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m);
    m.setView([-6.178, 106.63], 12);
    peta.current = m;
    m.on("zoomend", () => aturZoom(m.getZoom()));
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(wadah.current);
    return () => {
      ro.disconnect();
      m.remove();
      peta.current = null;
      lapisRw.current = null;
      lapisKel.current = null;
    };
  }, []);

  /* Dua lapis koroplet: RW (rinci) dan kelurahan (ringkas). */
  useEffect(() => {
    const m = peta.current;
    if (!m || !rw || !kel) return;

    const buat = (
      fc: FC,
      kunciDari: (pr: Props) => string,
      data: Map<string, { jumlah: number; pagu: number }>,
      label: (pr: Props) => string,
      sub: (pr: Props) => string,
    ) =>
      L.geoJSON(fc as unknown as GeoJSON.GeoJsonObject, {
        style: (f) => {
          const pr = (f as unknown as Fitur).properties;
          const n = data.get(kunciDari(pr))?.jumlah ?? 0;
          const k = kelas(n);
          return {
            color: k.garis,
            weight: n === 0 ? 0.4 : 0.7,
            opacity: 0.65,
            fillColor: k.isi,
            fillOpacity: n === 0 ? 0.15 : 0.62,
          };
        },
        onEachFeature: (f, layer) => {
          const pr = (f as unknown as Fitur).properties;
          const kunci = kunciDari(pr);
          const d = data.get(kunci);
          perWilayah.current.set(kunci, layer as L.Polygon);
          (layer as L.Polygon).bindTooltip(
            `<div style="max-width:250px;line-height:1.4">
               <div style="font-weight:600">${esc(label(pr))}</div>
               <div style="opacity:.7">${esc(sub(pr))}</div>
               ${
                 d
                   ? `<div style="margin-top:4px">${angka(d.jumlah)} paket · ${rupiahRingkas(d.pagu)}</div>`
                   : `<div style="margin-top:4px;opacity:.7">Tidak ada paket jalan</div>`
               }
               <div style="margin-top:3px;opacity:.55">Batas wilayah resmi Kota Tangerang; paket dikaitkan lewat nama RW/kelurahan.</div>
             </div>`,
            { sticky: true, direction: "top" },
          );
          (layer as L.Polygon).on("mouseover", () =>
            (layer as L.Polygon).setStyle({ weight: 1.6, opacity: 1 }),
          );
          (layer as L.Polygon).on("mouseout", () => {
            const nn = data.get(kunci)?.jumlah ?? 0;
            (layer as L.Polygon).setStyle({ weight: nn === 0 ? 0.4 : 0.7, opacity: 0.65 });
          });
        },
      });

    perWilayah.current.clear();

    if (lapisRw.current) lapisRw.current.remove();
    lapisRw.current = buat(
      rw,
      (pr) => norm(`${pr.wadmkd}|${pr.rw}`),
      hitung.perRw,
      (pr) => `RW ${pr.rw}`,
      (pr) => `Kelurahan ${judul(String(pr.wadmkd))} · Kec. ${judul(String(pr.wadmkc))}`,
    );

    if (lapisKel.current) lapisKel.current.remove();
    lapisKel.current = buat(
      kel,
      (pr) => norm(pr.wadmkd),
      hitung.perKel,
      (pr) => judul(String(pr.wadmkd)),
      (pr) => `Kec. ${judul(String(pr.wadmkc))}`,
    );

    const kotak = lapisKel.current.getBounds();
    if (kotak.isValid()) m.fitBounds(kotak, { padding: [20, 20] });
    aturZoom(m.getZoom());
  }, [rw, kel, hitung]);

  /* Sorot wilayah paket terpilih — bukan titik. */
  useEffect(() => {
    const m = peta.current;
    if (!m) return;
    for (const l of perWilayah.current.values()) {
      l.setStyle({ weight: 0.7, opacity: 0.65, dashArray: undefined });
    }
    if (!terpilih) return;

    const kurangi = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rinci = terpilih.presisi_peta === "RW" && !!terpilih.unit_id;
    const kunci = rinci ? norm(terpilih.unit_id as string) : norm(terpilih.desa_resmi ?? "");
    if (!kunci) return;

    if (rinci && m.getZoom() < ZOOM_RW) {
      if (kurangi) m.setZoom(ZOOM_RW);
      else m.flyTo(m.getCenter(), ZOOM_RW, { duration: 0.7 });
    }

    const bentuk = perWilayah.current.get(kunci);
    if (!bentuk) return;

    bentuk.setStyle({
      color: "#111111",
      weight: 2.6,
      opacity: 1,
      dashArray: "6 4",
      fillOpacity: 0.72,
    });
    bentuk.bringToFront();
    bentuk.bindTooltip(
      `<div style="max-width:260px;line-height:1.4">
         <div style="font-weight:600">${esc(terpilih.desa_resmi ?? "Wilayah")}${terpilih.rw ? ` · RW ${esc(terpilih.rw)}` : ""}</div>
         <div style="opacity:.7">Paket ini dikaitkan ke wilayah ini. Lokasi pekerjaan di dalam wilayah tidak diketahui.</div>
       </div>`,
      { permanent: true, direction: "top", className: "tooltip-saksi", sticky: false },
    );
    const kotak = bentuk.getBounds();
    if (kurangi) m.fitBounds(kotak, { padding: [80, 80], maxZoom: 15 });
    else m.flyToBounds(kotak, { padding: [80, 80], maxZoom: 15, duration: 0.9 });
  }, [terpilih, rw, kel]);

  const legenda = useMemo(() => {
    const perKelas = (
      fc: FC | null,
      data: Map<string, { jumlah: number }>,
      kunciDari: (pr: Props) => string,
    ) => {
      const m = new Map<string, number>();
      if (!fc) return m;
      for (const f of fc.features) {
        const k = kelas(data.get(kunciDari(f.properties))?.jumlah ?? 0);
        m.set(k.label, (m.get(k.label) ?? 0) + 1);
      }
      return m;
    };
    const a = perKelas(rw, hitung.perRw, (pr) => norm(`${pr.wadmkd}|${pr.rw}`));
    const b = perKelas(kel, hitung.perKel, (pr) => norm(pr.wadmkd));
    return KELAS.map((k) => ({ ...k, rw: a.get(k.label) ?? 0, kel: b.get(k.label) ?? 0 }));
  }, [rw, kel, hitung]);

  const totalRw = legenda.reduce((s, k) => s + k.rw, 0);
  const berpaket = totalRw - (legenda[0]?.rw ?? 0);

  return (
    <div className="peta relative h-full w-full">
      <div
        ref={wadah}
        className="h-full w-full"
        role="application"
        aria-label="Peta koroplet paket jalan per RW Kota Tangerang"
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[800] mx-auto w-[min(96%,600px)] border border-line bg-card/95 px-3 py-2 text-center">
        <p className="text-xs leading-snug text-ink-soft">
          Peta mewarnai <strong>batas RW/kelurahan resmi</strong> menurut jumlah paket. Tidak ada paket
          yang punya koordinat pekerjaan — lokasi di dalam wilayah tidak diketahui.
        </p>
      </div>

      {gagal && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-[800] w-[min(92%,420px)] -translate-x-1/2 border border-line bg-card px-3 py-2 text-center">
          <p className="text-xs text-ink-soft">Batas wilayah gagal dimuat.</p>
          <p className="mt-0.5 text-2xs text-muted">Pilih paket di tabel untuk melihat wilayahnya.</p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-3 z-[800] border border-line bg-card/95 px-3 py-2.5">
        <div className="label mb-2">Cara membaca</div>
        <ul className="grid gap-1">
          {legenda.map((k) => (
            <li key={k.label} className="flex items-center gap-2 text-2xs text-ink-soft">
              <span
                className="inline-block h-2.5 w-3.5 flex-none border"
                style={{ background: k.isi, borderColor: k.garis, opacity: k.min === 0 ? 0.35 : 1 }}
              />
              <span className="flex-1">{k.label}</span>
              <span className="num text-muted">{k.rw} RW</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-line pt-2 text-2xs text-muted">
          Perbesar peta untuk melihat per RW (1.020 wilayah). Kelurahan: 104.
        </p>
        <p className="num mt-1 text-2xs text-muted">
          {angka(berpaket)} RW berpaket · {angka(totalRw)} RW total
        </p>
      </div>
    </div>
  );
}
