import { test, expect } from "bun:test";
import { WORK_COLORS, dominantWork, topWork } from "./work-encoding";

const counts = (permukaan: number, drainase: number, jembatan: number) => ({
  PERMUKAAN: permukaan,
  DRAINASE: drainase,
  JEMBATAN: jembatan,
});

test("jenis dengan paket terbanyak dipakai untuk ikon wilayah", () => {
  expect(topWork(counts(4, 3, 3), 10)).toBe("PERMUKAAN");
  expect(topWork(counts(0, 0, 2), 2)).toBe("JEMBATAN");
  expect(topWork(counts(0, 0, 0), 0)).toBeNull();
});

test("jenis dominan hanya disebut bila melewati separuh paket", () => {
  expect(dominantWork(counts(6, 3, 1), 10)).toBe("PERMUKAAN");
  expect(dominantWork(counts(5, 5, 0), 10)).toBeNull();
  expect(dominantWork(counts(4, 3, 3), 10)).toBeNull();
});

test("setiap jenis punya warna tetap untuk legenda", () => {
  expect(WORK_COLORS.PERMUKAAN).toBe("#0058A3");
  expect(WORK_COLORS.DRAINASE).toBe("#7FAEDC");
  expect(WORK_COLORS.JEMBATAN).toBe("#FFDA1A");
});
