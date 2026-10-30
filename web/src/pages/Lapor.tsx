import { useEffect, useMemo, useRef, useState } from 'react'
import { simpanLaporan, type Jenis, type Laporan, type Tingkat } from '../lib/reports'

const KTP_MM = 85.6 // lebar KTP (standar ISO/IEC 7810 ID-1)

type Pt = { x: number; y: number }

export default function Lapor() {
  const [file, setFile] = useState<File | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [exifDitemukan, setExifDitemukan] = useState<boolean | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [mode, setMode] = useState<'kalibrasi' | 'ukur'>('kalibrasi')
  const [kpts, setKpts] = useState<Pt[]>([])
  const [box, setBox] = useState<{ a: Pt; b: Pt } | null>(null)
  const [drag, setDrag] = useState<Pt | null>(null)
  const [jenis, setJenis] = useState<Jenis>('lubang')
  const [tingkat, setTingkat] = useState<Tingkat>('sedang')
  const [deskripsi, setDeskripsi] = useState('')
  const [gps, setGps] = useState<{ lat: number | null; lng: number | null; akurasi?: number }>({ lat: null, lng: null })
  const [pesan, setPesan] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const skala = useMemo(() => {
    if (kpts.length < 2) return null
    const d = Math.hypot(kpts[1].x - kpts[0].x, kpts[1].y - kpts[0].y)
    return d > 5 ? KTP_MM / d : null
  }, [kpts])

  const ukuran = useMemo(() => {
    if (!skala || !box) return null
    const w = Math.abs(box.b.x - box.a.x) * skala
    const h = Math.abs(box.b.y - box.a.y) * skala
    return { panjang_cm: w / 10, lebar_cm: h / 10, luas_cm2: (w * h) / 100 }
  }, [skala, box])

  // muat file → cek EXIF → re-encode (metadata hilang)
  async function onFile(f: File) {
    setFile(f)
    setKpts([])
    setBox(null)
    setMode('kalibrasi')
    const head = await f.slice(0, 65536).arrayBuffer()
    const teks = new TextDecoder('latin1').decode(head)
    setExifDitemukan(/exif/i.test(teks))
    const bmp = await createImageBitmap(f)
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.drawImage(bmp, 0, 0)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85))
    if (!blob) return
    setImgUrl(URL.createObjectURL(blob))
    setDims({ w: bmp.width, h: bmp.height })
  }

  // gambar kanvas
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !imgUrl || !dims) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      cv.width = dims.w
      cv.height = dims.h
      draw()
    }
    img.src = imgUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl, dims])

  function draw() {
    const cv = canvasRef.current
    const img = imgRef.current
    if (!cv || !img) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(img, 0, 0)
    const lw = Math.max(2, cv.width / 400)
    if (box) {
      ctx.strokeStyle = '#b3261e'
      ctx.lineWidth = lw
      ctx.fillStyle = 'rgba(179,38,30,0.16)'
      const x = Math.min(box.a.x, box.b.x)
      const y = Math.min(box.a.y, box.b.y)
      const w = Math.abs(box.b.x - box.a.x)
      const h = Math.abs(box.b.y - box.a.y)
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
    }
    if (drag && mode === 'ukur') {
      ctx.strokeStyle = '#1F4E5F'
      ctx.setLineDash([8, 6])
      ctx.lineWidth = lw
      ctx.strokeRect(Math.min(kpts[0]?.x ?? drag.x, drag.x), Math.min(drag.y, drag.y), Math.abs(drag.x - (kpts[0]?.x ?? drag.x)), Math.abs(drag.y - drag.y))
      ctx.setLineDash([])
    }
    kpts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(5, cv.width / 180), 0, Math.PI * 2)
      ctx.fillStyle = '#1F4E5F'
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `${Math.max(14, cv.width / 60)}px ui-monospace, monospace`
      ctx.fillText(String(i + 1), p.x + 10, p.y - 10)
    })
  }

  useEffect(draw, [kpts, box, drag, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  function toCanvas(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const cv = e.currentTarget
    const r = cv.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = toCanvas(e)
    if (mode === 'kalibrasi') {
      setKpts((k) => (k.length >= 2 ? [p] : [...k, p]))
    } else {
      setDrag(p)
      setBox(null)
    }
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'ukur' || !drag) return
    const p = toCanvas(e)
    setDrag(p)
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'ukur' || !drag) return
    const p = toCanvas(e)
    setBox({ a: drag, b: p })
    setDrag(null)
  }

  function ambilGps() {
    if (!navigator.geolocation) {
      setPesan('Perangkat ini tidak memberi akses lokasi. Isi manual di bawah.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6), akurasi: pos.coords.accuracy }),
      () => setPesan('Izin lokasi ditolak. Lokasi boleh dikosongkan — laporan tetap bisa dikirim.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  function kirim() {
    if (!imgUrl || !ukuran) {
      setPesan('Foto dan pengukuran wajib. Kalibrasi dengan KTP, lalu tarik kotak pada kerusakan.')
      return
    }
    if (deskripsi.trim().length < 15) {
      setPesan('Deskripsi minimal 15 karakter supaya bisa diproses NLP.')
      return
    }
    const l: Laporan = {
      id: `L-${Date.now().toString(36).toUpperCase()}`,
      dibuat: new Date().toISOString(),
      foto: imgUrl,
      jenis,
      tingkat,
      panjang_cm: +ukuran.panjang_cm.toFixed(1),
      lebar_cm: +ukuran.lebar_cm.toFixed(1),
      luas_cm2: +ukuran.luas_cm2.toFixed(0),
      skala_mm_per_px: +(skala ?? 0).toFixed(4),
      metode_kalibrasi: 'benda-acuan-2-titik',
      deskripsi: deskripsi.trim(),
      lat: gps.lat,
      lng: gps.lng,
      status: 'diduga',
      tindakan: null,
    }
    simpanLaporan(l)
    location.hash = '#/laporan'
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="label">Laporan warga · tanpa login</p>
      <h1 className="mt-2 max-w-3xl text-[30px] leading-tight font-semibold md:text-[38px]">
        Foto kerusakannya, taruh KTP di sampingnya, lalu tandai dua sudut KTP.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
        KTP dipakai sebagai acuan ukuran (lebar 8,56 cm). Dari dua titik itu kami menghitung skala
        piksel, sehingga luas kerusakan keluar dalam cm² — bukan perkiraan.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2 text-[12.5px]">
        {([
          ['1', 'Pilih foto', !!imgUrl],
          ['2', 'Kalibrasi KTP', !!skala],
          ['3', 'Tandai kerusakan', !!box],
          ['4', 'Kirim', false],
        ] as [string, string, boolean][]).map(([no, label, done], i) => {
          const aktif = !imgUrl ? i === 0 : !skala ? i === 1 : !box ? i === 2 : i === 3
          return (
          <li
            key={String(no)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
              done
                ? 'border-ink bg-ink text-paper'
                : aktif
                  ? 'border-accent text-accent'
                  : 'border-line text-muted'
            }`}
          >
            <span className="num font-bold">{no}</span> {label}
          </li>
          )
        })}
      </ol>

      <p className="mt-4 max-w-2xl rounded-xl bg-accent-soft px-4 py-3 text-[12.5px] leading-relaxed text-accent">
        <strong>Tentang KTP:</strong> tutup bagian NIK, nama, dan foto sebelum memotret — yang kami
        pakai hanya lebar fisiknya (8,56 cm). Foto diproses dan disimpan di perangkat ini saja; tidak
        ada yang dikirim ke server.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="receipt px-4 py-4">
            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-paper px-4 py-10 text-center">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="sr-only"
              />
              <span>
                <span className="block text-[15px] font-medium">{imgUrl ? 'Ganti foto' : 'Pilih atau ambil foto'}</span>
                <span className="mt-1 block text-[12px] text-muted">
                  Foto kerusakan + KTP di sebelahnya · JPG/PNG
                </span>
              </span>
            </label>
            {file && (
              <p className="mt-2 text-[12px] text-muted">
                {file.name} · {dims ? `${dims.w}×${dims.h} px` : 'memuat…'} ·{' '}
                {exifDitemukan === null ? 'memeriksa metadata…' : exifDitemukan ? 'EXIF terdeteksi — dibuang saat diproses' : 'tidak ada EXIF'}
              </p>
            )}
          </div>

          {!imgUrl && (
            <div className="receipt mt-4 px-5 py-5">
              <p className="label">Supaya ukurannya sah</p>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-muted">
                <li>• KTP dan kerusakan berada di satu bidang — jangan miring.</li>
                <li>• Foto dari atas, jarak ±1 meter, pencahayaan cukup.</li>
                <li>• Tandai lebar KTP (8,56 cm), bukan panjangnya.</li>
                <li>• Kotak ditarik mengelilingi kerusakan yang terlihat.</li>
              </ul>
              <p className="mt-3 border-t border-dashed border-line pt-3 text-[12px] text-muted">
                Ketelitian ±10% pada sudut pengambilan yang wajar. Ini ditulis apa adanya di laporan.
              </p>
            </div>
          )}

          {imgUrl && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setMode('kalibrasi')}
                  className={`rounded-full px-3 py-1.5 text-[13px] ${mode === 'kalibrasi' ? 'bg-ink text-paper' : 'border border-line'}`}
                >
                  1. Kalibrasi KTP
                </button>
                <button
                  onClick={() => skala && setMode('ukur')}
                  disabled={!skala}
                  className={`rounded-full px-3 py-1.5 text-[13px] ${mode === 'ukur' ? 'bg-ink text-paper' : 'border border-line'} disabled:opacity-40`}
                >
                  2. Tandai kerusakan
                </button>
                {skala && <span className="num text-[12px] text-muted">skala {skala.toFixed(3)} mm/px</span>}
              </div>
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                className="w-full cursor-crosshair rounded-xl border border-line bg-black/5 touch-none"
              />
              <p className="mt-2 text-[12px] text-muted">
                {mode === 'kalibrasi'
                  ? 'Klik dua sudut lebar KTP (bukan panjangnya).'
                  : 'Tarik kotak mengelilingi kerusakan. Lebar kotak = panjang kerusakan.'}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="receipt px-5 py-5">
            <p className="label">Hasil ukur</p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <p className="num text-2xl font-bold">{ukuran ? ukuran.luas_cm2.toFixed(0) : '—'}</p>
                <p className="text-[11px] leading-tight text-muted">Luas (cm²)</p>
              </div>
              <div>
                <p className="num text-2xl font-bold">{ukuran ? ukuran.panjang_cm.toFixed(0) : '—'}</p>
                <p className="text-[11px] leading-tight text-muted">Panjang (cm)</p>
              </div>
              <div>
                <p className="num text-2xl font-bold">{ukuran ? ukuran.lebar_cm.toFixed(0) : '—'}</p>
                <p className="text-[11px] leading-tight text-muted">Lebar (cm)</p>
              </div>
            </div>
            {!ukuran && (
              <p className="mt-2 text-[12px] text-muted">
                Menunggu foto dan kalibrasi — angka muncul setelah dua sudut KTP ditandai.
              </p>
            )}
            <p className="mt-3 border-t border-dashed border-line pt-3 text-[12px] leading-relaxed text-muted">
              Skala dihitung dari lebar KTP 8,56 cm. Ketelitian bergantung pada sudut pengambilan foto —
              tulis ini apa adanya di laporan.
            </p>
          </div>

          <div className="receipt mt-4 px-5 py-5">
            <label className="label block">Jenis kerusakan</label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value as Jenis)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px]">
              <option value="lubang">Lubang</option>
              <option value="retak memanjang">Retak memanjang</option>
              <option value="retak melintang">Retak melintang</option>
              <option value="alligator">Alligator (retak kulit buaya)</option>
            </select>
            <p className="mt-1 text-[11px] text-muted">Dinilai manual pada v1 — model CV menyusul, dan itu ditulis terbuka.</p>

            <label className="label mt-4 block">Tingkat (penilaian awal)</label>
            <div className="mt-1 flex gap-2">
              {(['ringan', 'sedang', 'berat'] as Tingkat[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTingkat(t)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[13px] ${tingkat === t ? 'bg-accent text-white' : 'border border-line'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="label mt-4 block">Deskripsi kerusakan</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={3}
              placeholder="Contoh: lubang di lajur kiri dekat halte, sudah dua minggu, membesar setelah hujan."
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px]"
            />

            <label className="label mt-4 block">Lokasi</label>
            <div className="mt-1 flex items-center gap-2">
              <button onClick={ambilGps} className="rounded-full border border-line px-3 py-1.5 text-[12px]">
                Ambil GPS
              </button>
              <span className="num text-[12px] text-muted">
                {gps.lat ? `${gps.lat}, ${gps.lng}` : 'belum ada'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Lokasi dibulatkan ≥10 m. Tidak ada nama, nomor, atau akun yang disimpan.
            </p>

            {pesan && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-[12px] text-accent">{pesan}</p>}

            <button
              onClick={kirim}
              disabled={!ukuran || deskripsi.trim().length < 15}
              className="mt-4 w-full rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kirim laporan
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Wajib: foto, kalibrasi, kotak kerusakan, deskripsi ≥15 karakter. Lokasi opsional.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
