import { test, expect } from "bun:test";
import { WORK_COLORS, WORK_MIXED_COLOR, dominantWork, workFill } from "./work-encoding";

const counts = (permukaan: number, drainase: number, jembatan: number) => ({
  PERMUKAAN: permukaan,
  DRAINASE: drainase,
  JEMBATAN: jembatan,
});

test("jenis yang melewati separuh paket menjadi dominan", () => {
  expect(dominantWork(counts(6, 3, 1), 10)).toBe("PERMUKAAN");
  expect(dominantWork(counts(1, 8, 1), 10)).toBe("DRAINASE");
  expect(dominantWork(counts(0, 0, 2), 2)).toBe("JEMBATAN");
});

test("tepat separuh bukan dominan: wilayah disebut campuran", () => {
  expect(dominantWork(counts(5, 5, 0), 10)).toBeNull();
  expect(workFill(counts(5, 5, 0), 10)).toBe(WORK_MIXED_COLOR);
});

test("tanpa paket tidak diberi jenis", () => {
  expect(dominantWork(counts(0, 0, 0), 0)).toBeNull();
});

test("warna peta dan swasta legenda memakai sumber yang sama", () => {
  expect(workFill(counts(9, 1, 0), 10)).toBe(WORK_COLORS.PERMUKAAN);
});
