import { test, expect } from "bun:test";
import type { RoadPackageContract } from "@/contracts/packages/road-package.contract";
import { buildPenyediaPanel, labelPenyediaLain } from "./penyedia-panel";

function kontrak(
  isi: Partial<RoadPackageContract> & Pick<RoadPackageContract, "penyedia">,
): RoadPackageContract {
  return {
    jenis: "lainnya",
    sumber: "Data INAPROC",
    metode: "Pengadaan Langsung",
    npwp: null,
    hps: null,
    nilai_kontrak: null,
    tahun: 2025,
    url: null,
    ...isi,
  };
}

const TIGA_PENYEDIA = kontrak({
  penyedia: "CV. SATU",
  nilai_kontrak: 175,
  paketRealisasi: [
    {
      kodePaket: "paket-1",
      penyedia: "CV. SATU",
      penyediaSemua: ["CV. SATU"],
      nilai: 100,
      sumber: "Non Tender",
    },
    {
      kodePaket: "paket-2",
      penyedia: "CV. DUA",
      penyediaSemua: ["CV. DUA"],
      nilai: 50,
      sumber: "Non Tender",
    },
    {
      kodePaket: "paket-3",
      penyedia: "CV. TIGA",
      penyediaSemua: ["CV. TIGA"],
      nilai: 25,
      sumber: "Non Tender",
    },
  ],
});

test("tiga penyedia memicu tombol +1 penyedia lainnya dan total tetap 175", () => {
  const panel = buildPenyediaPanel(TIGA_PENYEDIA);

  expect(panel.baris).toHaveLength(3);
  expect(panel.baris.map((baris) => baris.nama)).toEqual(["CV. SATU", "CV. DUA", "CV. TIGA"]);
  expect(panel.baris.map((baris) => baris.nilai)).toEqual([100, 50, 25]);
  expect(panel.total).toBe(175);
  expect(panel.total).toBe(TIGA_PENYEDIA.nilai_kontrak!);

  const tampil = panel.baris.slice(0, 2);
  expect(tampil).toHaveLength(2);
  expect(labelPenyediaLain(panel.baris.length)).toBe("+1 penyedia lainnya");
});

test("penyedia bersama tampil dengan nilai 0 tanpa membagi nilai transaksi", () => {
  const panel = buildPenyediaPanel(
    kontrak({
      penyedia: "CV. SATU",
      nilai_kontrak: 100,
      paketRealisasi: [
        {
          kodePaket: "paket-1",
          penyedia: "CV. SATU",
          penyediaSemua: ["CV. SATU", "CV. DUA"],
          nilai: 100,
          sumber: "Pencatatan Non Tender",
        },
      ],
    }),
  );

  expect(panel.baris).toEqual([
    { nama: "CV. SATU", nilai: 100 },
    { nama: "CV. DUA", nilai: 0 },
  ]);
  expect(panel.total).toBe(100);
  expect(panel.adaPenyediaBersama).toBe(true);
  expect(labelPenyediaLain(panel.baris.length)).toBeNull();
});

test("nilai penyedia yang sama di beberapa paket dijumlahkan, bukan diduplikasi", () => {
  const panel = buildPenyediaPanel(
    kontrak({
      penyedia: "CV. SATU",
      nilai_kontrak: 150,
      paketRealisasi: [
        {
          kodePaket: "paket-1",
          penyedia: "CV. SATU",
          penyediaSemua: ["CV. SATU"],
          nilai: 100,
          sumber: null,
        },
        {
          kodePaket: "paket-2",
          penyedia: "cv. satu",
          penyediaSemua: ["cv. satu"],
          nilai: 50,
          sumber: null,
        },
      ],
    }),
  );

  expect(panel.baris).toEqual([{ nama: "CV. SATU", nilai: 150 }]);
  expect(panel.total).toBe(150);
  expect(panel.adaPenyediaBersama).toBe(false);
});

test("tanpa rincian paket, panel memakai nilai kontrak dan penyedia lain bernilai 0", () => {
  const panel = buildPenyediaPanel(
    kontrak({
      penyedia: "PT. UTAMA",
      nilai_kontrak: 90,
      penyediaLain: ["CV. MITRA"],
    }),
  );

  expect(panel.baris).toEqual([
    { nama: "PT. UTAMA", nilai: 90 },
    { nama: "CV. MITRA", nilai: 0 },
  ]);
  expect(panel.total).toBe(90);
  expect(panel.adaPenyediaBersama).toBe(true);
});

test("kontrak kosong menghasilkan panel kosong", () => {
  expect(buildPenyediaPanel(null)).toEqual({
    baris: [],
    total: 0,
    adaPenyediaBersama: false,
  });
  expect(buildPenyediaPanel(undefined)).toEqual({
    baris: [],
    total: 0,
    adaPenyediaBersama: false,
  });
});
