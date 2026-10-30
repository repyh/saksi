import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Stepper, { type Langkah } from "../components/Stepper";
import { StempelSimulasi } from "../components/Badge";
import {
  Berkas,
  Centang,
  IkonJenis,
  Info,
  Kamera,
  Kuas,
  Lokasi,
  PanahKanan,
  PanahKiri,
  Perisai,
  Privat,
  Seru,
  Silang,
} from "../components/Ikon";
import {
  bersihkan,
  capBlur,
  eksporJpeg,
  perkecil,
  siapkanFoto,
  ukuranBerkas,
  type Foto,
} from "../lib/foto";
import {
  angka1,
  bulanIndo,
  cariKandidat,
  daftarDesa,
  desaTerdekat,
  labelPresisi,
  muatData,
  rupiahRingkas,
  type Dataset,
  type Desa,
  type Kandidat,
  type Paket,
} from "../lib/paket";
import {
  bacaLaporan,
  contohLaporan,
  jamIndo,
  JENIS,
  kodeLaporan,
  labelJenis,
  labelPenyebab,
  labelUkuran,
  PENYEBAB,
  simpanLaporan,
  statusLabel,
  tanggalIndo,
  UKURAN,
  type JenisKerusakan,
  type Laporan,
  type Penyebab,
  type StatusTautan,
  type UkuranKasar,
} from "../lib/laporan";

/* ── Kanvas foto + kuas blur ──────────────────────────────── */

function KanvasFoto({ foto, onGores }: { foto: Foto; onGores: () => void }) {
  const wadah = useRef<HTMLDivElement | null>(null);
  const [radius, setRadius] = useState(34);
  const menggambar = useRef(false);
  const terakhir = useRef<{ x: number; y: number } | null>(null);
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  useEffect(() => {
    const el = foto.kanvas;
    const induk = wadah.current;
    if (!induk) return;

    el.style.display = "block";
    el.style.maxWidth = "100%";
    el.style.maxHeight = "420px";
    el.style.width = "auto";
    el.style.height = "auto";
    el.style.margin = "0 auto";
    el.style.cursor = "crosshair";
    el.style.touchAction = "none";
    el.style.borderRadius = "2px";
    induk.replaceChildren(el);

    const keKanvas = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return {
        x: ((ev.clientX - r.left) / r.width) * el.width,
        y: ((ev.clientY - r.top) / r.height) * el.height,
      };
    };
    const radiusKanvas = () => {
      const r = el.getBoundingClientRect();
      return (radiusRef.current * el.width) / Math.max(1, r.width);
    };

    const turun = (ev: PointerEvent) => {
      ev.preventDefault();
      el.setPointerCapture(ev.pointerId);
      menggambar.current = true;
      const p = keKanvas(ev);
      terakhir.current = p;
      capBlur(foto, p.x, p.y, radiusKanvas());
    };

    const gerak = (ev: PointerEvent) => {
      if (!menggambar.current) return;
      ev.preventDefault();
      const p = keKanvas(ev);
      const dari = terakhir.current ?? p;
      const r = radiusKanvas();
      const jarak = Math.hypot(p.x - dari.x, p.y - dari.y);
      const langkah = Math.max(1, Math.floor(r / 3));
      const mulai = Math.max(1, Math.ceil(jarak / langkah));
      for (let i = 1; i <= mulai; i += 1) {
        capBlur(
          foto,
          dari.x + ((p.x - dari.x) * i) / mulai,
          dari.y + ((p.y - dari.y) * i) / mulai,
          r,
        );
      }
      terakhir.current = p;
    };

    const naik = () => {
      if (!menggambar.current) return;
      menggambar.current = false;
      terakhir.current = null;
      onGores();
    };

    el.addEventListener("pointerdown", turun);
    el.addEventListener("pointermove", gerak);
    el.addEventListener("pointerup", naik);
    el.addEventListener("pointercancel", naik);

    return () => {
      el.removeEventListener("pointerdown", turun);
      el.removeEventListener("pointermove", gerak);
      el.removeEventListener("pointerup", naik);
      el.removeEventListener("pointercancel", naik);
    };
  }, [foto, onGores]);

  return (
    <div className="border border-line bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
        <span className="flex items-center gap-2 text-2xs text-ink-soft">
          <Kuas size={14} className="text-muted" />
          Seret pada foto untuk memburamkan wajah &amp; plat nomor.
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-2xs text-muted">
            Kuas
            <input
              type="range"
              min={12}
              max={80}
              step={2}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-24"
              aria-label="Ukuran kuas blur"
            />
          </label>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              bersihkan(foto);
              onGores();
            }}
          >
            Bersihkan
          </button>
        </div>
      </div>
      <div ref={wadah} className="bg-paper-recess p-2" />
    </div>
  );
}

/* ── Ringkasan samping ────────────────────────────────────── */

function Ringkasan({
  foto,
  ukuranFoto,
  jenis,
  desa,
  paket,
  skor,
}: {
  foto: Foto | null;
  ukuranFoto: number;
  jenis: JenisKerusakan | null;
  desa: string;
  paket: Paket | null;
  skor: number | null;
}) {
  return (
    <aside className="panel p-4 lg:sticky lg:top-[74px]">
      <div className="flex items-start justify-between gap-2">
        <span className="label label-strong">Ringkasan laporan</span>
        <StempelSimulasi />
      </div>

      <dl className="mt-3 border-t border-line">
        {[
          {
            label: "Foto",
            nilai: foto ? `${foto.lebar} × ${foto.tinggi} · ${ukuranBerkas(ukuranFoto)}` : "Belum ada",
            kosong: !foto,
          },
          { label: "Kerusakan", nilai: jenis ? labelJenis(jenis) : "Belum dipilih", kosong: !jenis },
          { label: "Desa", nilai: desa || "Belum dipilih", kosong: !desa },
          {
            label: "Paket",
            nilai: paket ? `RUP ${paket.kode_rup}${skor != null ? ` · skor ${skor}` : ""}` : "Belum ditautkan",
            kosong: !paket,
          },
        ].map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[72px_1fr] items-baseline gap-2 border-b border-line py-2"
          >
            <dt className="label leading-4">{r.label}</dt>
            <dd className={`min-w-0 text-xs ${r.kosong ? "text-muted" : "text-ink-soft"}`}>
              {r.nilai}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 grid gap-2 text-2xs leading-relaxed text-ink-soft">
        {[
          { ok: Boolean(foto), teks: "EXIF dibuang saat foto digambar ulang" },
          { ok: Boolean(foto), teks: "Wajah & plat diburamkan manual oleh Anda" },
          { ok: true, teks: "Tanpa login — laporan tersimpan di perangkat ini" },
        ].map((baris) => (
          <li key={baris.teks} className="flex items-start gap-2">
            {baris.ok ? (
              <Centang size={12} className="mt-0.5 flex-none text-badge-asli" />
            ) : (
              <span className="mt-[7px] block h-[5px] w-[5px] flex-none bg-line-strong" />
            )}
            <span className={baris.ok ? "" : "text-muted"}>{baris.teks}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-line pt-2 text-2xs leading-relaxed text-muted">
        Prototipe: laporan tidak dikirim ke server. Kode laporan dibuat di perangkat ini.
      </p>
    </aside>
  );
}

/* ── Kartu kandidat paket ─────────────────────────────────── */

function KartuKandidat({
  kandidat,
  terpilih,
  onPilih,
  luarDesa,
}: {
  kandidat: Kandidat;
  terpilih: boolean;
  onPilih: () => void;
  luarDesa: boolean;
}) {
  const p = kandidat.paket;
  const rincian = [
    `${angka1(kandidat.jarakKm)} km`,
    kandidat.desaSama ? "desa sama" : "luar desa",
    kandidat.jendela ? "jendela pemeliharaan" : "di luar jendela",
  ];
  if (kandidat.kemiripan > 0) rincian.push(`kemiripan ${Math.round(kandidat.kemiripan * 100)}%`);

  return (
    <label
      className="kandidat flex cursor-pointer gap-3 p-3"
      data-luar={luarDesa ? "true" : undefined}
      aria-disabled={luarDesa || undefined}
    >
      <input
        type="radio"
        name="kandidat-paket"
        className="sr-only"
        checked={terpilih}
        disabled={luarDesa}
        onChange={onPilih}
      />
      <span className="flex-none text-right">
        <span
          className="num block text-2xl leading-none"
          style={{ color: terpilih ? "var(--color-accent)" : "var(--color-ink)" }}
        >
          {kandidat.skor}
        </span>
        <span className="label mt-1 block">skor</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug text-ink">{p.nama}</span>
        <span className="num mt-1 block text-2xs text-muted">
          {rupiahRingkas(p.pagu)} · {bulanIndo(p.bulan)} · {labelPresisi(p)}
        </span>
        <span className="mt-1 block text-2xs text-muted">{rincian.join(" · ")}</span>
        <span className="num mt-1 block text-2xs text-ink-soft">RUP {p.kode_rup}</span>
      </span>
      {terpilih && <Centang size={16} className="flex-none text-accent" />}
    </label>
  );
}

/* ── Kartu laporan tersimpan ──────────────────────────────── */

function BadgeStatus({ status }: { status: StatusTautan }) {
  const kelas =
    status === "diduga_tidak_sesuai"
      ? "badge--indikator"
      : status === "tertaut"
        ? "badge--presisi"
        : "badge--netral";
  return (
    <span className={`badge ${kelas}`}>
      {status === "diduga_tidak_sesuai" ? <Seru size={11} /> : null}
      {statusLabel(status)}
    </span>
  );
}

function KartuLaporan({ laporan }: { laporan: Laporan }) {
  return (
    <article className="border border-line bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="num text-2xs text-muted">{laporan.kode}</span>
        <StempelSimulasi />
      </div>
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink">{labelJenis(laporan.jenis)}</h3>
            <p className="mt-0.5 text-2xs text-muted">
              {laporan.desa} · {laporan.kecamatan}
            </p>
            <p className="num mt-0.5 text-2xs text-muted">
              {tanggalIndo(laporan.waktu)} · {jamIndo(laporan.waktu)}
            </p>
          </div>
          <BadgeStatus status={laporan.status} />
        </div>

        {(laporan.penyebab.length > 0 || laporan.ukuran) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {laporan.ukuran && (
              <span className="badge badge--presisi">{labelUkuran(laporan.ukuran)}</span>
            )}
            {laporan.penyebab.map((p) => (
              <span key={p} className="badge badge--netral">
                {labelPenyebab(p)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-line pt-2">
          {laporan.kode_rup ? (
            <p className="num text-2xs text-ink-soft">
              Tertaut RUP {laporan.kode_rup}
              {laporan.skor != null && <span className="text-muted"> · skor {laporan.skor}</span>}
            </p>
          ) : (
            <p className="text-2xs text-ink-soft">Tidak Dapat Ditautkan — laporan tetap tersimpan.</p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-2xs text-muted">
            <Berkas size={12} />
            {laporan.foto
              ? `1 foto · ${laporan.foto.lebar}×${laporan.foto.tinggi} · ${ukuranBerkas(
                  laporan.foto.byte,
                )} · EXIF dibersihkan`
              : "tanpa foto"}
            {laporan.konfirmasi > 0 && ` · ${laporan.konfirmasi} warga mengonfirmasi`}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ── Halaman ──────────────────────────────────────────────── */

export default function Lapor({
  contoh,
  paketAwal,
}: {
  contoh: boolean;
  paketAwal: string | null;
}) {
  const [data, setData] = useState<Dataset | null>(null);
  const [galatData, setGalatData] = useState<string | null>(null);

  const [langkah, setLangkah] = useState<Langkah>(1);
  const [foto, setFoto] = useState<Foto | null>(null);
  const [ukuranFoto, setUkuranFoto] = useState(0);
  const [galatFoto, setGalatFoto] = useState<string | null>(null);

  const [jenis, setJenis] = useState<JenisKerusakan | null>(null);
  const [penyebab, setPenyebab] = useState<Penyebab[]>([]);
  const [ukuran, setUkuran] = useState<UkuranKasar | null>(null);

  const [desaNama, setDesaNama] = useState("");
  const [patokan, setPatokan] = useState("");
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [statusGps, setStatusGps] = useState<"idle" | "meminta" | "ok" | "ditolak">("idle");
  const [kodeTerpilih, setKodeTerpilih] = useState<string | null>(null);

  const [galatLangkah, setGalatLangkah] = useState<string | null>(null);
  const [terkirim, setTerkirim] = useState<Laporan | null>(null);
  const [daftar, setDaftar] = useState<Laporan[]>(() => bacaLaporan());
  const [paketAwalObj, setPaketAwalObj] = useState<Paket | null>(null);

  /* Muat data */
  useEffect(() => {
    const ac = new AbortController();
    muatData(ac.signal)
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setGalatData(e instanceof Error ? e.message : "Data paket gagal dimuat.");
      });
    return () => ac.abort();
  }, []);

  /* Paket yang dibuka dari panel detail */
  useEffect(() => {
    if (!data || !paketAwal || paketAwalObj) return;
    const p = data.paket.find((x) => x.kode_rup === paketAwal);
    if (!p) return;
    setPaketAwalObj(p);
    if (p.desa_resmi) setDesaNama(p.desa_resmi);
    setKodeTerpilih(p.kode_rup);
  }, [data, paketAwal, paketAwalObj]);

  const desaUrut = useMemo(() => (data ? daftarDesa(data.desa) : []), [data]);

  const kelompokDesa = useMemo(() => {
    const peta = new Map<string, Desa[]>();
    for (const d of desaUrut) {
      const daftarKec = peta.get(d.kecamatan) ?? [];
      daftarKec.push(d);
      peta.set(d.kecamatan, daftarKec);
    }
    return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0], "id"));
  }, [desaUrut]);

  const desaObj = useMemo(
    () => data?.desa.find((d) => d.desa === desaNama) ?? null,
    [data, desaNama],
  );

  const lat = gps?.lat ?? desaObj?.lat ?? null;
  const lon = gps?.lon ?? desaObj?.lon ?? null;

  const hasil = useMemo(() => {
    if (!data || lat == null || lon == null) return null;
    return cariKandidat(data.paket, {
      lat,
      lon,
      desa: data.desa,
      patokan,
      batas: 500,
    });
  }, [data, lat, lon, patokan]);

  const semuaKandidat = hasil?.kandidat ?? [];

  const kartu = useMemo(() => {
    const top = semuaKandidat.slice(0, 3);
    if (paketAwalObj) {
      const kunci = semuaKandidat.find((k) => k.paket.kode_rup === paketAwalObj.kode_rup);
      if (kunci && !top.some((k) => k.paket.kode_rup === kunci.paket.kode_rup)) top.unshift(kunci);
    }
    return top;
  }, [semuaKandidat, paketAwalObj]);

  /* Pilih kandidat pertama yang sah bila belum ada pilihan */
  useEffect(() => {
    if (!hasil) return;
    const sah = hasil.kandidat.some((k) => k.paket.kode_rup === kodeTerpilih);
    if (sah) return;
    const pertama = hasil.kandidat.find((k) => k.desaSama) ?? null;
    setKodeTerpilih(pertama?.paket.kode_rup ?? null);
  }, [hasil, kodeTerpilih]);

  const kandidatTerpilih = useMemo(
    () => semuaKandidat.find((k) => k.paket.kode_rup === kodeTerpilih) ?? null,
    [semuaKandidat, kodeTerpilih],
  );

  const paketTerpilih = kandidatTerpilih?.paket ?? paketAwalObj;

  const segarkanUkuran = useCallback(async () => {
    if (!foto) return;
    try {
      const blob = await eksporJpeg(foto.kanvas);
      setUkuranFoto(blob.size);
    } catch {
      /* abaikan — ukuran hanya informasi */
    }
  }, [foto]);

  async function pilihBerkas(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = e.target.files?.[0];
    if (!berkas) return;
    setGalatFoto(null);
    try {
      const siap = await siapkanFoto(berkas);
      setFoto(siap);
      setUkuranFoto((await eksporJpeg(siap.kanvas)).size);
      setGalatLangkah(null);
    } catch (err) {
      setGalatFoto(err instanceof Error ? err.message : "Foto tidak bisa dibaca.");
    } finally {
      e.target.value = "";
    }
  }

  function pakaiLokasiSaya() {
    if (!navigator.geolocation) {
      setStatusGps("ditolak");
      return;
    }
    setStatusGps("meminta");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const titik = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setGps(titik);
        setStatusGps("ok");
        if (data) {
          const dekat = desaTerdekat(titik.lat, titik.lon, data.desa);
          if (dekat) setDesaNama(dekat.desa.desa);
        }
      },
      () => setStatusGps("ditolak"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const selesai: Langkah[] = [];
  if (foto) selesai.push(1);
  if (jenis) selesai.push(2);
  if (lat != null) selesai.push(3);

  function pindah(target: Langkah) {
    if (target > 1 && !foto) {
      setGalatLangkah("Tambahkan satu foto kerusakan sebelum melangkah ke kategori.");
      setLangkah(1);
      return;
    }
    if (target > 2 && !jenis) {
      setGalatLangkah("Pilih satu jenis kerusakan sebelum mengisi lokasi.");
      setLangkah(2);
      return;
    }
    setGalatLangkah(null);
    setLangkah(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function lanjut() {
    if (langkah === 1) {
      if (!foto) {
        setGalatLangkah("Tambahkan satu foto kerusakan sebelum lanjut.");
        return;
      }
      pindah(2);
      return;
    }
    if (langkah === 2) {
      if (!jenis) {
        setGalatLangkah("Pilih satu jenis kerusakan — ini wajib.");
        return;
      }
      pindah(3);
      return;
    }
    kirim();
  }

  function kirim() {
    if (!data || !jenis) return;
    if (lat == null || lon == null) {
      setGalatLangkah("Pilih desa atau gunakan lokasi saya agar laporan punya titik.");
      return;
    }

    const terpilih = kandidatTerpilih;
    const tertaut = Boolean(terpilih && hasil?.tertaut);
    const laporan: Laporan = {
      kode: kodeLaporan(),
      waktu: new Date().toISOString(),
      desa: desaNama || (desaObj?.desa ?? "—"),
      kecamatan: desaObj?.kecamatan ?? "—",
      jenis,
      penyebab,
      ukuran,
      lat,
      lon,
      sumber_lokasi: gps ? "gps" : "desa",
      patokan,
      kode_rup: tertaut && terpilih ? terpilih.paket.kode_rup : null,
      skor: tertaut && terpilih ? terpilih.skor : null,
      status: tertaut ? "tertaut" : "tidak_dapat_ditautkan",
      konfirmasi: 0,
      foto: foto
        ? {
            lebar: foto.lebar,
            tinggi: foto.tinggi,
            byte: ukuranFoto,
            thumb: perkecil(foto.kanvas).toDataURL("image/jpeg", 0.7),
          }
        : null,
    };

    setTerkirim(laporan);
    setDaftar(simpanLaporan(laporan));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function ulangi() {
    setFoto(null);
    setUkuranFoto(0);
    setJenis(null);
    setPenyebab([]);
    setUkuran(null);
    setDesaNama("");
    setPatokan("");
    setGps(null);
    setStatusGps("idle");
    setKodeTerpilih(null);
    setTerkirim(null);
    setPaketAwalObj(null);
    setLangkah(1);
    setGalatLangkah(null);
    setGalatFoto(null);
  }

  const laporanContoh = useMemo(
    () => (contoh && data ? contohLaporan(data.desa, data.paket) : []),
    [contoh, data],
  );
  const semuaLaporan = [...daftar, ...laporanContoh];

  return (
    <>
      <section className="mx-auto max-w-[1180px] px-5 py-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Laporkan kerusakan jalan
            </h1>
            <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-muted">
              Tiga langkah: foto, kategori kerusakan, lalu lokasi. SAKSI menautkan laporan ke paket
              yang membangun ruas itu — atau menyatakan jujur bila tidak ada dasar penautan.
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StempelSimulasi />
          <span className="label">Data paket · SIRUP 29 Okt 2026</span>
        </div>

        {galatData && (
          <div className="callout callout--saksi mt-4">
            <Seru size={18} className="mt-0.5 flex-none" />
            <div>
              <strong className="block font-semibold text-ink">Data paket gagal dimuat.</strong>
              <span className="text-ink-soft">{galatData}</span>
            </div>
          </div>
        )}

        {terkirim ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StempelSimulasi />
                <BadgeStatus status={terkirim.status} />
              </div>
              <h2 className="mt-3 text-lg font-semibold text-ink">
                Laporan tersimpan di perangkat ini
              </h2>
              <p className="mt-1 text-sm text-muted">
                Kode laporan — sebutkan kode ini bila menanyakan tindak lanjut.
              </p>
              <p className="num mt-3 border-y border-line py-4 text-2xl tracking-[0.08em] text-ink">
                {terkirim.kode}
              </p>

              {terkirim.kode_rup ? (
                <div className="callout callout--asli mt-4">
                  <Perisai size={18} className="mt-0.5 flex-none" />
                  <div>
                    <strong className="block text-xs font-semibold text-ink">
                      Tertaut ke RUP {terkirim.kode_rup}
                    </strong>
                    <span className="text-2xs text-ink-soft">
                      Skor kecocokan {terkirim.skor}. Paket ini masuk daftar tinjauan bila masih dalam
                      masa pemeliharaan.
                    </span>
                    <a
                      className="btn btn--ghost btn--sm mt-1"
                      href={`#/?paket=${terkirim.kode_rup}`}
                    >
                      Lihat paket di peta audit
                    </a>
                  </div>
                </div>
              ) : (
                <div className="callout callout--saksi mt-4">
                  <Info size={18} className="mt-0.5 flex-none" />
                  <div>
                    <strong className="block text-xs font-semibold text-ink">
                      Tidak Dapat Ditautkan
                    </strong>
                    <span className="text-2xs text-ink-soft">
                      Tidak ada paket jalan di desa yang sama. Laporan tetap tersimpan dan tidak
                      menandai paket mana pun — supaya satu laporan tidak menuduh belasan paket.
                    </span>
                  </div>
                </div>
              )}

              <dl className="mt-4 border-t border-line">
                {[
                  ["Kerusakan", labelJenis(terkirim.jenis)],
                  ["Lokasi", `${terkirim.desa} · ${terkirim.kecamatan}`],
                  ["Waktu", `${tanggalIndo(terkirim.waktu)} ${jamIndo(terkirim.waktu)}`],
                  [
                    "Foto",
                    terkirim.foto
                      ? `${terkirim.foto.lebar}×${terkirim.foto.tinggi} · ${ukuranBerkas(
                          terkirim.foto.byte,
                        )} · EXIF dibuang`
                      : "tanpa foto",
                  ],
                ].map(([label, nilai]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[84px_1fr] items-baseline gap-3 border-b border-line py-2"
                  >
                    <dt className="label leading-4">{label}</dt>
                    <dd className="text-sm text-ink-soft">{nilai}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn--primary" onClick={ulangi}>
                  Buat laporan lain
                </button>
                <a className="btn" href="#/">
                  Kembali ke peta audit
                </a>
              </div>
            </div>

            <Ringkasan
              foto={foto}
              ukuranFoto={ukuranFoto}
              jenis={jenis}
              desa={desaNama}
              paket={paketTerpilih}
              skor={kandidatTerpilih?.skor ?? null}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <Stepper aktif={langkah} selesai={selesai} onPilih={pindah} />

              <div className="mt-5">
                {/* ── Langkah 1 ─────────────────────────── */}
                {langkah === 1 && (
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Foto kerusakan</h2>
                    <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
                      Foto diperkecil ke maksimal 1024 px dan digambar ulang di perangkat ini — EXIF
                      (termasuk lokasi GPS asli) hilang sebelum disimpan.
                    </p>

                    <div className="mt-4">
                      {foto ? (
                        <>
                          <KanvasFoto foto={foto} onGores={segarkanUkuran} />
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="num flex items-center gap-2 text-2xs text-ink-soft">
                              <Centang size={12} className="text-badge-asli" />
                              {foto.lebar} × {foto.tinggi} · JPEG · {ukuranBerkas(ukuranFoto)} ·
                              <span className="text-badge-asli">EXIF dibuang</span>
                            </p>
                            <label className="btn btn--sm cursor-pointer">
                              Ganti foto
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="sr-only"
                                onChange={pilihBerkas}
                              />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-line-strong bg-card px-6 py-12 text-center transition-colors hover:border-ink">
                          <Kamera size={26} className="text-ink-soft" />
                          <span className="text-sm font-medium text-ink">
                            Ambil atau pilih foto kerusakan
                          </span>
                          <span className="max-w-[48ch] text-2xs leading-relaxed text-muted">
                            JPG, PNG, atau WebP. Tidak diunggah ke server mana pun — diproses di
                            peramban Anda.
                          </span>
                          <span className="btn btn--sm mt-1">Pilih foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="sr-only"
                            onChange={pilihBerkas}
                          />
                        </label>
                      )}
                    </div>

                    {galatFoto && (
                      <div className="callout callout--saksi mt-3">
                        <Seru size={16} className="mt-0.5 flex-none" />
                        <span>{galatFoto}</span>
                      </div>
                    )}

                    <ul className="mt-4 grid gap-2 text-2xs leading-relaxed text-muted">
                      <li className="flex items-start gap-2">
                        <Privat size={13} className="mt-0.5 flex-none" />
                        Buramkan wajah orang dan plat nomor kendaraan dengan kuas sebelum lanjut.
                      </li>
                      <li className="flex items-start gap-2">
                        <Info size={13} className="mt-0.5 flex-none" />
                        Foto bukan alat ukur: kategori kerusakan di langkah berikutnya Anda yang
                        menentukan, tanpa perkiraan luas otomatis.
                      </li>
                    </ul>
                  </div>
                )}

                {/* ── Langkah 2 ─────────────────────────── */}
                {langkah === 2 && (
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Kategori kerusakan</h2>
                    <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
                      Pilih satu jenis yang paling terlihat. Penyebab dan ukuran kasar opsional —
                      cukup untuk memprioritaskan, tanpa klaim presisi.
                    </p>

                    <div
                      className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                      role="radiogroup"
                      aria-label="Jenis kerusakan"
                    >
                      {JENIS.map((j) => {
                        const aktif = jenis === j.nilai;
                        return (
                          <button
                            key={j.nilai}
                            type="button"
                            role="radio"
                            aria-checked={aktif}
                            onClick={() => {
                              setJenis(j.nilai);
                              setGalatLangkah(null);
                            }}
                            className="flex items-start gap-3 border p-3 text-left transition-colors"
                            style={{
                              borderColor: aktif ? "var(--color-accent)" : "var(--color-line)",
                              background: aktif ? "var(--color-accent-soft)" : "var(--color-card)",
                              boxShadow: aktif
                                ? "inset 0 0 0 1px var(--color-accent)"
                                : undefined,
                            }}
                          >
                            <IkonJenis
                              jenis={j.nilai}
                              size={24}
                              className={aktif ? "text-accent" : "text-ink-soft"}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium leading-tight text-ink">
                                {j.label}
                              </span>
                              <span className="mt-0.5 block text-2xs leading-snug text-muted">
                                {j.petunjuk}
                              </span>
                            </span>
                            {aktif && <Centang size={14} className="ml-auto flex-none text-accent" />}
                          </button>
                        );
                      })}
                    </div>

                    <fieldset className="mt-5">
                      <legend className="label mb-2">Penyebab terlihat (opsional)</legend>
                      <div className="flex flex-wrap gap-2">
                        {PENYEBAB.map((p) => {
                          const aktif = penyebab.includes(p.nilai);
                          return (
                            <button
                              key={p.nilai}
                              type="button"
                              className="chip"
                              aria-pressed={aktif}
                              onClick={() =>
                                setPenyebab((lama) =>
                                  lama.includes(p.nilai)
                                    ? lama.filter((x) => x !== p.nilai)
                                    : [...lama, p.nilai],
                                )
                              }
                            >
                              {aktif && <Centang size={11} />}
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset className="mt-5">
                      <legend className="label mb-2">Ukuran kasar (opsional)</legend>
                      <div className="flex flex-wrap gap-2">
                        {UKURAN.map((u) => (
                          <button
                            key={u.nilai}
                            type="button"
                            className="chip"
                            aria-pressed={ukuran === u.nilai}
                            onClick={() => setUkuran(ukuran === u.nilai ? null : u.nilai)}
                          >
                            {ukuran === u.nilai && <Centang size={11} />}
                            {u.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                )}

                {/* ── Langkah 3 ─────────────────────────── */}
                {langkah === 3 && (
                  <div>
                    <h2 className="text-lg font-semibold text-ink">Lokasi &amp; paket terkait</h2>
                    <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
                      SAKSI mencari paket jalan di desa yang sama, dihitung dengan{" "}
                      <span className="num text-ink-soft">MatchScore</span>: jarak, desa, jendela
                      pemeliharaan, dan kemiripan nama lokasi.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div className="field">
                        <label htmlFor="desa-lapor">Desa / kelurahan</label>
                        <select
                          id="desa-lapor"
                          className="select"
                          value={desaNama}
                          onChange={(e) => {
                            setDesaNama(e.target.value);
                            setKodeTerpilih(null);
                            setGalatLangkah(null);
                          }}
                        >
                          <option value="">Pilih desa…</option>
                          {kelompokDesa.map(([kec, isi]) => (
                            <optgroup key={kec} label={`${kec} (${isi.length})`}>
                              {isi.map((d) => (
                                <option key={d.id_desa} value={d.desa}>
                                  {d.desa}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={pakaiLokasiSaya}
                        disabled={statusGps === "meminta"}
                      >
                        <Lokasi size={15} />
                        {statusGps === "meminta" ? "Membaca lokasi…" : "Gunakan lokasi saya"}
                      </button>
                    </div>

                    {statusGps === "ok" && gps && (
                      <p className="mt-2 flex items-center gap-2 text-2xs text-badge-asli">
                        <Centang size={12} />
                        Titik GPS dipakai. Desa terdekat: {desaNama}.
                      </p>
                    )}
                    {statusGps === "ditolak" && (
                      <div className="callout mt-3">
                        <Info size={16} className="mt-0.5 flex-none" />
                        <span>
                          Izin lokasi tidak diberikan. Pilih desa secara manual — laporan tetap bisa
                          dikirim.
                        </span>
                      </div>
                    )}

                    <div className="field mt-4">
                      <label htmlFor="patokan-lapor">
                        Patokan lokasi (opsional) — nama jalan, kampung, RT/RW
                      </label>
                      <input
                        id="patokan-lapor"
                        className="input"
                        value={patokan}
                        onChange={(e) => setPatokan(e.target.value)}
                        placeholder="Contoh: Jl. Arjuna III, Bumi Asri RT 04/16"
                      />
                      <p className="text-2xs text-muted">
                        Dipakai untuk menghitung kemiripan dengan nama lokasi paket; tidak
                        diunggah.
                      </p>
                    </div>

                    <div className="mt-5">
                      {!data ? (
                        <div className="callout">
                          <Info size={16} className="mt-0.5 flex-none" />
                          <span>Memuat register paket…</span>
                        </div>
                      ) : !hasil ? (
                        <div className="callout">
                          <Info size={16} className="mt-0.5 flex-none" />
                          <span>Pilih desa atau gunakan lokasi saya untuk menghitung kandidat.</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-end justify-between gap-3 border-b border-line pb-2">
                            <h3 className="text-sm font-semibold text-ink">
                              {hasil.tertaut
                                ? "Kandidat paket di desa yang sama"
                                : "Kandidat paket terdekat"}
                            </h3>
                            <span className="label">
                              {hasil.kandidat.length} paket · skor 0–100
                            </span>
                          </div>

                          {hasil.desa && (
                            <p className="mt-2 text-2xs text-muted">
                              {gps ? (
                                <>
                                  <span className="num">{angka1(hasil.desa.jarakKm)} km</span> dari
                                  titik GPS · desa terdekat{" "}
                                  <span className="text-ink-soft">{hasil.desa.desa.desa}</span> (
                                  {hasil.desa.desa.kecamatan})
                                </>
                              ) : (
                                <>
                                  Titik laporan memakai sentroid desa{" "}
                                  <span className="text-ink-soft">{hasil.desa.desa.desa}</span> (
                                  {hasil.desa.desa.kecamatan}) — presisi desa, bukan koordinat paket.
                                </>
                              )}
                            </p>
                          )}

                          {!hasil.tertaut && (
                            <div className="callout callout--saksi mt-3">
                              <Seru size={16} className="mt-0.5 flex-none" />
                              <div>
                                <strong className="block text-xs font-semibold text-ink">
                                  Tidak Dapat Ditautkan
                                </strong>
                                <span className="text-2xs text-ink-soft">
                                  Tidak ada paket jalan di desa yang sama. Laporan tetap bisa dikirim
                                  tanpa menandai paket mana pun.
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="mt-3 grid gap-2">
                            {kartu.map((k) => (
                              <KartuKandidat
                                key={k.paket.kode_rup}
                                kandidat={k}
                                terpilih={kodeTerpilih === k.paket.kode_rup}
                                luarDesa={!k.desaSama}
                                onPilih={() => setKodeTerpilih(k.paket.kode_rup)}
                              />
                            ))}
                            {kartu.length === 0 && (
                              <p className="text-sm text-muted">
                                Tidak ada paket dalam radius 2 km. Laporan tetap bisa dikirim.
                              </p>
                            )}
                          </div>

                          <p className="mt-3 text-2xs leading-relaxed text-muted">
                            Skor ditampilkan apa adanya: 50 bobot jarak (≤2 km), 25 desa sama, 15
                            jendela pemeliharaan ≤12 bulan, 10 kemiripan nama lokasi. Paket tanpa
                            penanda lokasi tidak pernah diusulkan.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {galatLangkah && (
                <div className="callout callout--saksi mt-4">
                  <Seru size={16} className="mt-0.5 flex-none" />
                  <span>{galatLangkah}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
                <button
                  type="button"
                  className="btn"
                  onClick={() => pindah((langkah - 1) as Langkah)}
                  disabled={langkah === 1}
                >
                  <PanahKiri size={15} /> Kembali
                </button>
                <div className="flex items-center gap-3">
                  <span className="num hidden text-2xs text-muted sm:inline">
                    Langkah {langkah} dari 3
                  </span>
                  <button type="button" className="btn btn--saksi" onClick={lanjut}>
                    {langkah === 3 ? "Kirim laporan" : "Lanjut"}
                    <PanahKanan size={15} />
                  </button>
                </div>
              </div>
            </div>

            <Ringkasan
              foto={foto}
              ukuranFoto={ukuranFoto}
              jenis={jenis}
              desa={desaNama}
              paket={paketTerpilih}
              skor={kandidatTerpilih?.skor ?? null}
            />
          </div>
        )}
      </section>

      {/* ── Laporan warga ──────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-5 pb-14">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink pb-2">
          <h2 className="text-lg font-semibold text-ink">Laporan warga</h2>
          <span className="num text-2xs text-muted">
            {semuaLaporan.length} laporan · tersimpan di perangkat ini
          </span>
        </div>
        <p className="mt-2 max-w-[76ch] text-sm leading-relaxed text-muted">
          Setiap laporan menyimpan foto, waktu, dan kategori yang ditentukan pelapor. Contoh di bawah
          berlabel simulasi — bukan laporan warga sungguhan.
        </p>

        {semuaLaporan.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border border-line bg-card px-4 py-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-soft">Belum ada laporan di perangkat ini.</p>
              <p className="mt-0.5 text-2xs text-muted">
                Laporan yang Anda kirim akan muncul di sini dengan kode dan status penautannya.
              </p>
            </div>
            <a className="btn btn--sm" href="#/lapor?contoh=1">
              Lihat tiga contoh laporan
            </a>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {semuaLaporan.map((l) => (
              <KartuLaporan key={l.kode} laporan={l} />
            ))}
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 text-2xs leading-relaxed text-muted">
          <Silang size={12} className="mt-0.5 flex-none" />
          Status “Diduga Tidak Sesuai” hanya muncul bila laporan berfoto berada dalam masa pemeliharaan
          dan dikonfirmasi ≥2 warga sekitar. Tidak ada label korupsi atau fiktif.
        </p>
      </section>
    </>
  );
}
