import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Desa, Paket } from "../lib/paket";
import { angka, rupiahRingkas } from "../lib/paket";

/**
 * Peta koroplet batas desa.
 *
 * Aturan produk (AGENTS.md §5): paket tidak punya koordinat pekerjaan, jadi peta TIDAK memplot titik
 * paket. Yang diwarnai adalah **batas desa** (GeoJSON GADM level 4, 274 desa Kab. Tangerang) dengan
 * intensitas = jumlah paket di desa itu. Ini pernyataan yang benar dan bisa diperiksa:
 * "sekian paket berada di Desa X" — bukan "paket ini ada di titik ini".
 *
 * Batas desa diambil dari ../../public/data/desa-batas.geojson (lihat docs/DATA-BATAS-DESA.md).
 */

const esc = (s: string) =>
  String(s).replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

type BatasDesa = {
  desa: string;
  kecamatan: string;
  id_desa: string | null;
};

type FiturBatas = {
  type: "Feature";
  properties: BatasDesa;
  geometry: unknown;
};

/* Kelas warna: ambang jumlah paket, warna, label legenda. */
const KELAS = [
  { min: 0, maks: 0, isi: "#ffffff", garis: "#bdb5ac", label: "Tidak ada paket jalan" },
  { min: 1, maks: 4, isi: "#f7ddd8", garis: "#c9a29c", label: "1–4 paket" },
  { min: 5, maks: 9, isi: "#eda9a0", garis: "#b5736b", label: "5–9 paket" },
  { min: 10, maks: 24, isi: "#d4695e", garis: "#8f4038", label: "10–24 paket" },
  { min: 25, maks: 59, isi: "#b3261e", garis: "#6f1711", label: "25–59 paket" },
  { min: 60, maks: Number.MAX_SAFE_INTEGER, isi: "#7d150f", garis: "#4c0d09", label: "60+ paket" },
] as const;

function kelas(n: number) {
  return KELAS.find((k) => n >= k.min && n <= k.maks) ?? KELAS[0];
}

/** Busur kuadratik — sengaja melengkung agar terbaca "hubungan", bukan rute. */
function busur(a: [number, number], b: [number, number]): Array<[number, number]> {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const cLat = (lat1 + lat2) / 2 - (lon2 - lon1) * 0.18;
  const cLon = (lon1 + lon2) / 2 + (lat2 - lat1) * 0.18;
  const titik: Array<[number, number]> = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const u = 1 - t;
    titik.push([
      u * u * lat1 + 2 * u * t * cLat + t * t * lat2,
      u * u * lon1 + 2 * u * t * cLon + t * t * lon2,
    ]);
  }
  return titik;
}

const norm = (s: string) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** GADM menulis "BalaRaja"/"PasarKemis" tanpa spasi; paket menulis "Balaraja"/"Pasar Kemis". */
const kunciDesa = (kec: string, desa: string) => `${norm(kec)}|${norm(desa)}`;

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
  const lapisBatas = useRef<L.GeoJSON | null>(null);
  const lapisBusur = useRef<L.LayerGroup | null>(null);
  const sorotan = useRef<L.Layer | null>(null);
  const perFitur = useRef<Map<string, L.Path>>(new Map());
  const pilihRef = useRef(onPilih);
  pilihRef.current = onPilih;

  const [batas, setBatas] = useState<{ type: string; features: FiturBatas[] } | null>(null);
  const [gagalBatas, setGagalBatas] = useState(false);

  /* Batas desa — sekali. */
  useEffect(() => {
    let hidup = true;
    fetch("/data/desa-batas.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (hidup) setBatas(j);
      })
      .catch(() => {
        if (hidup) setGagalBatas(true);
      });
    return () => {
      hidup = false;
    };
  }, []);

  /* Jumlah & pagu per desa. */
  const perDesa = useMemo(() => {
    const idPerNama = new Map<string, string | null>();
    for (const d of desa) idPerNama.set(kunciDesa(d.kecamatan, d.desa), d.id_desa ?? null);

    const hasil = new Map<string, { jumlah: number; pagu: number }>();
    for (const p of paket) {
      if (!p.desa_resmi) continue;
      const kunci = kunciDesa(p.kecamatan_resmi ?? "", p.desa_resmi);
      const lama = hasil.get(kunci);
      if (lama) {
        lama.jumlah += 1;
        lama.pagu += p.pagu;
      } else {
        hasil.set(kunci, { jumlah: 1, pagu: p.pagu });
      }
    }
    return { hasil, idPerNama };
  }, [paket, desa]);

  const namaUnik = useMemo(
    () => new Set(paket.filter((p) => p.desa_resmi).map((p) => norm(p.desa_resmi ?? ""))).size,
    [paket],
  );

  /* Peta dasar — sekali. */
  useEffect(() => {
    if (!wadah.current || peta.current) return;

    const m = L.map(wadah.current, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 9,
      maxZoom: 18,
      zoomSnap: 0.5,
      preferCanvas: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m);

    lapisBusur.current = L.layerGroup().addTo(m);

    if (desa.length > 0) {
      m.fitBounds(L.latLngBounds(desa.map((d) => [d.lat, d.lon] as [number, number])), {
        padding: [28, 28],
        maxZoom: 11,
      });
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
      lapisBatas.current = null;
      lapisBusur.current = null;
      sorotan.current = null;
    };
  }, [desa]);

  /* Koroplet batas desa. */
  useEffect(() => {
    const m = peta.current;
    if (!m || !batas) return;

    if (lapisBatas.current) {
      lapisBatas.current.remove();
      lapisBatas.current = null;
    }
    perFitur.current = new Map();

    const lapis = L.geoJSON(batas as unknown as GeoJSON.GeoJsonObject, {
      style: (f) => {
        const pr = (f as unknown as FiturBatas).properties;
        const kunci = kunciDesa(pr.kecamatan, pr.desa);
        const j = perDesa.hasil.get(kunci)?.jumlah ?? 0;
        const k = kelas(j);
        return {
          color: k.garis,
          weight: 0.7,
          opacity: 0.7,
          fillColor: k.isi,
          fillOpacity: j === 0 ? 0.18 : 0.62,
        };
      },
      onEachFeature: (f, layer) => {
        const pr = (f as unknown as FiturBatas).properties;
        const kunci = kunciDesa(pr.kecamatan, pr.desa);
        const data = perDesa.hasil.get(kunci);
        perFitur.current.set(kunci, layer as L.Path);

        (layer as L.Path).bindTooltip(
          `<div style="max-width:250px;line-height:1.4">
             <div style="font-weight:600">Desa ${esc(pr.desa)}</div>
             <div style="opacity:.7">Kec. ${esc(pr.kecamatan)}${pr.id_desa ? ` · ${esc(pr.id_desa)}` : ""}</div>
             ${
               data
                 ? `<div style="margin-top:4px">${angka(data.jumlah)} paket jalan · ${rupiahRingkas(data.pagu)}</div>`
                 : `<div style="margin-top:4px;opacity:.7">Tidak ada paket jalan pada data ini</div>`
             }
             <div style="margin-top:3px;opacity:.55">Batas desa dari GADM; paket dikaitkan lewat nama desa.</div>
           </div>`,
          { sticky: true, direction: "top" },
        );
        (layer as L.Path).on("mouseover", () => {
          (layer as L.Path).setStyle({ weight: 1.6, opacity: 1 });
        });
        (layer as L.Path).on("mouseout", () => {
          const jj = perDesa.hasil.get(kunci)?.jumlah ?? 0;
          (layer as L.Path).setStyle({ weight: 0.7, opacity: 0.7, color: kelas(jj).garis });
        });
      },
    }).addTo(m);

    lapisBatas.current = lapis;
    const kotak = lapis.getBounds();
    if (kotak.isValid()) m.fitBounds(kotak, { padding: [20, 20], maxZoom: 11 });
  }, [batas, perDesa]);

  /* Busur koridor — di atas koroplet, putus-putus, non-interaktif. */
  useEffect(() => {
    const g = lapisBusur.current;
    if (!g) return;
    g.clearLayers();

    const sudah = new Set<string>();
    for (const p of paket) {
      if (p.presisi_peta !== "Garis Koridor" || !p.koridor) continue;
      const tanda = [p.koridor.dari, p.koridor.ke].sort().join("|");
      if (sudah.has(tanda)) continue;
      sudah.add(tanda);
      L.polyline(
        busur([p.koridor.lat_dari, p.koridor.lon_dari], [p.koridor.lat_ke, p.koridor.lon_ke]),
        { color: "#1d4e89", weight: 1.6, opacity: 0.65, dashArray: "3 7", interactive: false },
      )
        .bindTooltip(
          `<div style="max-width:230px;line-height:1.4">
             <div style="font-weight:500">Koridor indikatif</div>
             <div style="opacity:.75">${esc(p.koridor.dari)} ↔ ${esc(p.koridor.ke)}</div>
             <div style="margin-top:3px;opacity:.6">Bukan geometri ruas — dua pusat desa dihubungkan.</div>
           </div>`,
          { sticky: true, direction: "top" },
        )
        .addTo(g);
    }
  }, [paket]);

  /* Paket terpilih: sorot batas desanya, bukan memberi titik. */
  useEffect(() => {
    const m = peta.current;
    if (!m) return;

    if (sorotan.current) {
      sorotan.current.remove();
      sorotan.current = null;
    }
    for (const l of perFitur.current.values()) {
      l.setStyle({ weight: 0.7, opacity: 0.7, dashArray: undefined, fillOpacity: 0.62 });
    }
    if (!terpilih) return;

    const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (terpilih.presisi_peta === "Garis Koridor" && terpilih.koridor) {
      const a: [number, number] = [terpilih.koridor.lat_dari, terpilih.koridor.lon_dari];
      const b: [number, number] = [terpilih.koridor.lat_ke, terpilih.koridor.lon_ke];
      sorotan.current = L.polyline(busur(a, b), {
        color: "#1d4e89",
        weight: 3,
        opacity: 1,
        dashArray: "7 6",
        interactive: false,
      })
        .bindTooltip(
          `<div style="max-width:250px;line-height:1.4">
             <div style="font-weight:600">Ruas indikatif</div>
             <div style="opacity:.75">${esc(terpilih.koridor.dari)} ↔ ${esc(terpilih.koridor.ke)}</div>
             <div style="margin-top:3px;opacity:.6">Ujung busur = pusat desa, bukan ujung ruas.</div>
           </div>`,
          { permanent: true, direction: "top", className: "tooltip-saksi" },
        )
        .addTo(m);
      const kotak = L.latLngBounds([a, b]);
      if (kurangiGerak) m.fitBounds(kotak, { padding: [64, 64], maxZoom: 14 });
      else m.flyToBounds(kotak, { padding: [64, 64], maxZoom: 14, duration: 0.9 });
      return;
    }

    if (!terpilih.desa_resmi) return;
    const kunci = kunciDesa(terpilih.kecamatan_resmi ?? "", terpilih.desa_resmi);
    const path = perFitur.current.get(kunci) as L.Polygon | undefined;

    if (path) {
      path.setStyle({
        color: "#111111",
        weight: 2.6,
        opacity: 1,
        dashArray: "6 4",
        fillOpacity: 0.72,
      });
      path.bringToFront();
      path.bindTooltip(
        `<div style="max-width:260px;line-height:1.4">
           <div style="font-weight:600">Desa ${esc(terpilih.desa_resmi ?? "")}</div>
           <div style="opacity:.75">Kec. ${esc(terpilih.kecamatan_resmi ?? "")}</div>
           <div style="margin-top:3px;opacity:.7">Paket ini dikaitkan ke desa ini. Lokasi pekerjaan di dalam desa tidak diketahui.</div>
         </div>`,
        { permanent: true, direction: "top", className: "tooltip-saksi", sticky: false },
      );
      const kotak = path.getBounds();
      if (kurangiGerak) m.fitBounds(kotak, { padding: [80, 80], maxZoom: 14 });
      else m.flyToBounds(kotak, { padding: [80, 80], maxZoom: 14, duration: 0.9 });
      return;
    }

    /* Desa tidak ada di batas (mis. nama beda) — jatuh ke pusat desa. */
    if (terpilih.lat != null && terpilih.lon != null) {
      sorotan.current = L.circleMarker([terpilih.lat, terpilih.lon], {
        radius: 6,
        color: "#111111",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 0.9,
      })
        .bindTooltip(
          `<div style="max-width:240px">Batas desa tidak ditemukan; ini pusat desa dari gazetteer.</div>`,
          { permanent: true, direction: "top", className: "tooltip-saksi" },
        )
        .addTo(m);
      if (kurangiGerak) m.setView([terpilih.lat, terpilih.lon], 13);
      else m.flyTo([terpilih.lat, terpilih.lon], 13, { duration: 0.9 });
    }
  }, [terpilih]);

  /* Hitungan desa per kelas warna untuk legenda. */
  const legenda = useMemo(() => {
    const jumlah = new Map<string, number>();
    if (!batas) return KELAS.map((k) => ({ ...k, desa: 0 }));
    for (const f of batas.features) {
      const pr = f.properties;
      const n = perDesa.hasil.get(kunciDesa(pr.kecamatan, pr.desa))?.jumlah ?? 0;
      const k = kelas(n);
      jumlah.set(k.label, (jumlah.get(k.label) ?? 0) + 1);
    }
    return KELAS.map((k) => ({ ...k, desa: jumlah.get(k.label) ?? 0 }));
  }, [batas, perDesa]);

  return (
    <div className="peta relative h-full w-full">
      <div
        ref={wadah}
        className="h-full w-full"
        role="application"
        aria-label="Peta koroplet jumlah paket jalan per desa di Kabupaten Tangerang"
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[800] mx-auto w-[min(96%,580px)] border border-line bg-card/95 px-3 py-2 text-center">
        <p className="text-xs leading-snug text-ink-soft">
          Peta ini mewarnai <strong>batas desa</strong> menurut jumlah paket. Tidak ada paket yang
          punya koordinat pekerjaan — lokasi di dalam desa tidak diketahui.
        </p>
      </div>

      {gagalBatas && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-[800] w-[min(92%,420px)] -translate-x-1/2 border border-line bg-card px-3 py-2 text-center">
          <p className="text-xs text-ink-soft">Batas desa gagal dimuat.</p>
          <p className="mt-0.5 text-2xs text-muted">Pilih paket di tabel untuk melihat desanya.</p>
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
              <span className="num text-muted">{k.desa} desa</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-line pt-2 text-2xs text-muted">
          Busur putus-putus = koridor indikatif antar dua desa, bukan geometri ruas.
        </p>
        <p className="num mt-2 border-t border-line pt-2 text-2xs text-muted">
          {angka(legenda.reduce((s, k) => s + k.desa, 0) - (legenda[0]?.desa ?? 0))} wilayah desa
          berpaket · {angka(namaUnik)} nama unik
        </p>
        <p className="mt-1 text-2xs text-muted">
          "Jatimulya" tercatat di dua kecamatan, jadi wilayah &gt; nama.
        </p>
      </div>
    </div>
  );
}
