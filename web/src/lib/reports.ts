export type Tingkat = 'ringan' | 'sedang' | 'berat'
export type Jenis = 'retak memanjang' | 'retak melintang' | 'alligator' | 'lubang'
export type Status = 'diduga' | 'terverifikasi' | 'ditindaklanjuti' | 'selesai'

export type Laporan = {
  id: string
  dibuat: string
  foto: string
  jenis: Jenis
  tingkat: Tingkat
  panjang_cm: number
  lebar_cm: number
  luas_cm2: number
  skala_mm_per_px: number
  metode_kalibrasi: 'benda-acuan-2-titik'
  deskripsi: string
  lat: number | null
  lng: number | null
  status: Status
  tindakan: string | null
}

const KEY = 'ruas.reports.v2'

export function daftarLaporan(): Laporan[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Laporan[]) : []
  } catch {
    return []
  }
}

export function simpanLaporan(l: Laporan): void {
  const all = [l, ...daftarLaporan()]
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)))
}

export function ubahStatus(id: string, status: Status, tindakan?: string): void {
  const all = daftarLaporan().map((l) => (l.id === id ? { ...l, status, tindakan: tindakan ?? l.tindakan } : l))
  localStorage.setItem(KEY, JSON.stringify(all))
}

export const labelStatus: Record<Status, string> = {
  diduga: 'Diduga — belum diverifikasi',
  terverifikasi: 'Terverifikasi',
  ditindaklanjuti: 'Ditindaklanjuti',
  selesai: 'Selesai',
}
