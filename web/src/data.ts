import jalanRaw from '../../data/jalan.json'
import vendorRaw from '../../data/vendor_jakarta.json'

export type Kelas = { baik: number; sedang: number; rusak_ringan: number; rusak_berat: number }

export type Provinsi = {
  provinsi: string
  titik: number
  km: number
  rata_iri: number
  kelas: Record<keyof Kelas, number>
  persen: Record<keyof Kelas, number>
}

export const jalan = jalanRaw as unknown as {
  semester: string
  nasional: { titik: number; km: number; rata_iri: number; kelas: Kelas; persen: Kelas }
  provinsi: Provinsi[]
}

export type PaketVendor = {
  id: string
  nama_paket: string | null
  satuan_kerja: string | null
  metode: string | null
  tahun: string | null
  pagu: number | null
  hps: number | null
  lokasi: string | null
  pemenang: string | null
}

export const vendor = vendorRaw as unknown as {
  diambil: string
  jumlah: { kandidat: number; terbaca: number; jalan: number }
  paket: PaketVendor[]
}

export const kelasRusak = (p: { persen: Kelas }) =>
  Math.round((p.persen.rusak_ringan + p.persen.rusak_berat) * 10) / 10

export function nomor(v: number, digit = 0): string {
  return v.toLocaleString('id-ID', { minimumFractionDigits: digit, maximumFractionDigits: digit })
}

export function persen(v: number, digit = 1): string {
  return `${v.toLocaleString('id-ID', { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`
}

export function rupiah(v: number | null): string {
  if (!v) return '—'
  if (v >= 1e9) return `Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  if (v >= 1e6) return `Rp${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  return `Rp${nomor(v)}`
}

export const provinsiTerburuk = () =>
  [...jalan.provinsi].sort((a, b) => kelasRusak(b) - kelasRusak(a)).slice(0, 6)
