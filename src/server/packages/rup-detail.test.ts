import { test, expect } from "bun:test";
import { emptyPlanDetail, indexRupDetail, normalizeRupDetailRow, normalizeRupDetailText } from "./rup-detail";

test("normalizer mengubah nilai kosong menjadi null", () => {
  expect(normalizeRupDetailText(null)).toBeNull();
  expect(normalizeRupDetailText(undefined)).toBeNull();
  expect(normalizeRupDetailText("")).toBeNull();
  expect(normalizeRupDetailText("   ")).toBeNull();
  expect(normalizeRupDetailText("-")).toBeNull();
  expect(normalizeRupDetailText(" - ")).toBeNull();
  expect(normalizeRupDetailText("tidak ada")).toBeNull();
  expect(normalizeRupDetailText("Tidak Ada Data")).toBeNull();
});

test("normalizer mempertahankan teks asli sambil merapikan spasi dan CRLF", () => {
  expect(normalizeRupDetailText("  Volume pekerjaan  ")).toBe("Volume pekerjaan");
  expect(normalizeRupDetailText("Baris satu\r\nBaris dua")).toBe("Baris satu\nBaris dua");
  expect(normalizeRupDetailText("Baris satu\rBaris dua")).toBe("Baris satu\nBaris dua");
  expect(normalizeRupDetailText("1 paket")).toBe("1 paket");
});

test("baris detail dipetakan ke semua field rencana", () => {
  expect(
    normalizeRupDetailRow({
      kode_rup: "66059767",
      jadwal_pemilihan_mulai: "Juli 2026",
      jadwal_pemilihan_akhir: "Agustus 2026",
      jadwal_kontrak_mulai: "Agustus 2026",
      jadwal_kontrak_akhir: "-",
      uraian: "Pembangunan saluran",
      volume: "1",
      spesifikasi: "",
      mak: "1.03.06",
    }),
  ).toEqual({
    jadwalPemilihanMulai: "Juli 2026",
    jadwalPemilihanAkhir: "Agustus 2026",
    jadwalKontrakMulai: "Agustus 2026",
    jadwalKontrakAkhir: null,
    uraian: "Pembangunan saluran",
    volume: "1",
    spesifikasi: null,
    mak: "1.03.06",
  });
});

test("indeks kosong tidak menemukan detail apa pun", () => {
  const index = indexRupDetail([]);
  expect(index.size).toBe(0);
  expect(index.get("99999999") ?? null).toBeNull();
});

test("indeks melewati baris tanpa kode dan memakai baris pertama untuk kode ganda", () => {
  const index = indexRupDetail([
    { kode_rup: "", uraian: "tanpa kode" },
    { kode_rup: "123", uraian: "pertama" },
    { kode_rup: "123", uraian: "kedua" },
    { kode_rup: "456", uraian: "-" },
  ]);

  expect(index.size).toBe(2);
  expect(index.get("123")?.uraian).toBe("pertama");
  expect(index.get("456")?.uraian).toBeNull();
});

test("detail kosong tetap punya semua field bernilai null", () => {
  expect(emptyPlanDetail()).toEqual({
    jadwalPemilihanMulai: null,
    jadwalPemilihanAkhir: null,
    jadwalKontrakMulai: null,
    jadwalKontrakAkhir: null,
    uraian: null,
    volume: null,
    spesifikasi: null,
    mak: null,
  });
});
