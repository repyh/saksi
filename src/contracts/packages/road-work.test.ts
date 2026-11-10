import { test, expect } from "bun:test";
import { classifyRoadWork } from "./road-work";

test("permukaan: nama jalan, trotoar, dan paving", () => {
  expect(classifyRoadWork("Peningkatan Jalan Iskandar Muda (Lanjutan)")).toBe("PERMUKAAN");
  expect(classifyRoadWork("Pembangunan Trotoar Jalan Kiasnawi (Lanjutan)")).toBe("PERMUKAAN");
  expect(classifyRoadWork("Pemeliharaan Paving Blok")).toBe("PERMUKAAN");
});

test("drainase: saluran, gorong-gorong, turap, dan tanggul", () => {
  expect(
    classifyRoadWork("Pembangunan Saluran Drainase/Gorong-gorong Jl. Halim Perdana Kusuma"),
  ).toBe("DRAINASE");
  expect(classifyRoadWork("Pembangunan Gorong-gorong Jl. Pinang")).toBe("DRAINASE");
  expect(classifyRoadWork("Pembangunan Turap Kali Perancis")).toBe("DRAINASE");
  expect(classifyRoadWork("Normalisasi Saluran Irigasi Tanggul Kali Baru")).toBe("DRAINASE");
});

test("jembatan: objek jembatan yang disebut lebih dulu menang atas saluran", () => {
  expect(classifyRoadWork("Pembangunan Jembatan Saluran Cisadane Barat 1")).toBe("JEMBATAN");
  expect(classifyRoadWork("Pelebaran Jembatan Jalan Lio Baru - Jalan Bouraq")).toBe("JEMBATAN");
  expect(classifyRoadWork("Pembangunan JEMBATAN Kali Syphon (Tugu Karya)")).toBe("JEMBATAN");
});

test("jalan yang menyusur saluran tetap permukaan, bukan drainase", () => {
  expect(
    classifyRoadWork("Pembangunan Jalan Saluran Pembuang Semanan (Poris Indah - Gor Gondrong)"),
  ).toBe("PERMUKAAN");
  expect(
    classifyRoadWork("Pelebaran Jalan Bouraq - Lio Baru (Lanjutan) - Jembatan Tanah Tinggi 1"),
  ).toBe("PERMUKAAN");
});

test("tanggul sebagai bagian nama jalan tidak dianggap pekerjaan penahan", () => {
  expect(
    classifyRoadWork("Peningkatan Jl. Lingk. Jl. Tanggul RW 01 dsk Kel. Kedaung Wetan (ABT)"),
  ).toBe("PERMUKAAN");
});

test("paket payung multi-objek mengikuti objek pertama yang disebut", () => {
  expect(
    classifyRoadWork(
      "Pemeliharaan/Rehabilitasi : Drainase, Irigasi, Rawa, Jalan, Jembatan, bantaran sungai",
    ),
  ).toBe("DRAINASE");
});
