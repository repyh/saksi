import { test, expect } from "bun:test";
import { normalizeVendorNames } from "./vendor-name";

test("memecah dua badan usaha yang sama-sama valid", () => {
  expect(normalizeVendorNames("CV. BUMI SALAKA, CV. ZARMINA FAIQA")).toEqual([
    "CV. BUMI SALAKA",
    "CV. ZARMINA FAIQA",
  ]);
});

test("tidak memecah nama PT dengan gelar Tbk. di segmen kedua", () => {
  const nama = "PT. Telekomunikasi Indonesia, Tbk.";
  expect(normalizeVendorNames(nama)).toEqual([nama]);
});

test("tidak memecah nama instansi yang memakai koma", () => {
  const nama =
    "DINAS PERINDUSTRIAN, PERDAGANGAN, KOPERASI, USAHA KECIL DAN MENENGAH KOTA TANGERANG";
  expect(normalizeVendorNames(nama)).toEqual([nama]);
});

test("tidak memecah bila segmen kedua hanya prefiks tanpa nama", () => {
  const nama = "LIMA GAGAH NUSANTARA,CV";
  expect(normalizeVendorNames(nama)).toEqual([nama]);
});

test("tidak memecah bila segmen pertama hanya prefiks tanpa nama", () => {
  const nama = "CV, PT Setia Anugrah Medika";
  expect(normalizeVendorNames(nama)).toEqual([nama]);
});

test("deduplikasi case-insensitive mempertahankan ejaan pertama", () => {
  expect(normalizeVendorNames("CV. ROSAN MULIA, CV. ROSAN MULIA")).toEqual([
    "CV. ROSAN MULIA",
  ]);
  expect(normalizeVendorNames("CV. ROSAN MULIA, cv. rosan mulia")).toEqual([
    "CV. ROSAN MULIA",
  ]);
});

test("mengenali prefiks tanpa spasi setelah titik", () => {
  expect(normalizeVendorNames("CV.NAZWA PUTRI MANDIRI, PT.CAHAYA BERLIAN KEMBAR")).toEqual([
    "CV.NAZWA PUTRI MANDIRI",
    "PT.CAHAYA BERLIAN KEMBAR",
  ]);
});

test("mengenali prefiks lain seperti UD, Koperasi, dan Yayasan", () => {
  expect(
    normalizeVendorNames("UD. Sumber Rejeki, Koperasi Sejahtera, Yayasan Cahaya"),
  ).toEqual(["UD. Sumber Rejeki", "Koperasi Sejahtera", "Yayasan Cahaya"]);
});

test("tidak memecah bila salah satu segmen bukan badan usaha", () => {
  const nama = "CV. SATU, BUKAN BADAN USAHA";
  expect(normalizeVendorNames(nama)).toEqual([nama]);
});

test("tidak memecah lebih dari 6 segmen", () => {
  const nama = Array.from({ length: 7 }, (_, i) => `CV. USAHA ${i + 1}`).join(", ");
  expect(normalizeVendorNames(nama)).toEqual([nama]);
});

test("nama tunggal dan masukan kosong", () => {
  expect(normalizeVendorNames("CV. TUNGGAL")).toEqual(["CV. TUNGGAL"]);
  expect(normalizeVendorNames("  CV. TUNGGAL  ")).toEqual(["CV. TUNGGAL"]);
  expect(normalizeVendorNames(null)).toEqual([]);
  expect(normalizeVendorNames(undefined)).toEqual([]);
  expect(normalizeVendorNames("   ")).toEqual([]);
});
