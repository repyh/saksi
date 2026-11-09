import { test, expect } from "bun:test";
import { bagianLokal, instanLokal, jadwalBerikut, jadwalTerakhir, kunciHari } from "./jadwal";

const JAKARTA = "Asia/Jakarta";

test("membaca jam dinding WIB dari instan UTC", () => {
  expect(bagianLokal(new Date("2026-11-09T19:00:00.000Z"), JAKARTA)).toEqual({
    tahun: 2026,
    bulan: 11,
    hari: 10,
    jam: 2,
    menit: 0,
    detik: 0,
  });
});

test("memetakan jam dinding WIB ke instan UTC", () => {
  expect(instanLokal(2026, 11, 10, 2, 30, JAKARTA).toISOString()).toBe("2026-11-09T19:30:00.000Z");
});

test("jadwal terakhir memakai hari sebelumnya bila jadwal hari ini belum lewat", () => {
  const sekarang = new Date("2026-11-09T19:00:00.000Z"); // 02:00 WIB, 10 Nov
  expect(jadwalTerakhir(2, 30, JAKARTA, sekarang).toISOString()).toBe("2026-11-08T19:30:00.000Z");
});

test("jadwal terakhir memakai hari ini setelah jadwal lewat", () => {
  const sekarang = new Date("2026-11-09T20:00:00.000Z"); // 03:00 WIB, 10 Nov
  expect(jadwalTerakhir(2, 30, JAKARTA, sekarang).toISOString()).toBe("2026-11-09T19:30:00.000Z");
});

test("jadwal berikut melompat ke besok setelah jamnya lewat", () => {
  const sekarang = new Date("2026-11-09T20:00:00.000Z"); // 03:00 WIB, 10 Nov
  expect(jadwalBerikut(2, 30, JAKARTA, sekarang).toISOString()).toBe("2026-11-10T19:30:00.000Z");
});

test("jadwal berikut memakai hari ini bila jamnya belum lewat", () => {
  const sekarang = new Date("2026-11-09T19:00:00.000Z"); // 02:00 WIB, 10 Nov
  expect(jadwalBerikut(2, 30, JAKARTA, sekarang).toISOString()).toBe("2026-11-09T19:30:00.000Z");
});

test("kunci hari memakai tanggal setempat, bukan UTC", () => {
  expect(kunciHari(new Date("2026-11-09T19:00:00.000Z"), JAKARTA)).toBe("2026-11-10");
});

test("zona dengan DST tetap menghasilkan jam dinding yang diminta", () => {
  const sekarang = new Date("2026-07-01T12:00:00.000Z");
  const jadwal = jadwalTerakhir(2, 30, "Europe/Berlin", sekarang);
  expect(bagianLokal(jadwal, "Europe/Berlin")).toMatchObject({ jam: 2, menit: 30 });
  expect(jadwal.getTime()).toBeLessThan(sekarang.getTime());
});

test("zona tidak dikenal melempar RangeError", () => {
  expect(() => bagianLokal(new Date(), "Bukan/Zona")).toThrow(RangeError);
});
