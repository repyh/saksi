import { test, expect } from "bun:test";
import {
  gabungKontrakRealisasi,
  kunciPenyedia,
  type BarisLpse,
  type BarisRealisasi,
} from "./lpse-merge";

function lpse(isi: Partial<BarisLpse> = {}): BarisLpse {
  return {
    kode_rup: "65400706",
    jenis_lpse: "nontender",
    metode: "Pekerjaan Konstruksi",
    pemenang: "RISAN GEMILANG JAYA",
    npwp: "01*6**6****16**0",
    hps: 299_980_000,
    nilai_kontrak: 298_616_000,
    tahun: 2026,
    url: "https://spse.inaproc.id/tangerangkota/nontender/11039836000/pengumumanpl",
    ...isi,
  };
}

function realisasi(isi: Partial<BarisRealisasi> = {}): BarisRealisasi {
  return {
    kode_rup: "65400706",
    kode_paket: "11039836000",
    tahun: 2026,
    metode: "Pengadaan Langsung",
    sumber_transaksi: "Non Tender",
    penyedia: "RISAN GEMILANG JAYA",
    nilai: 298_616_000,
    ...isi,
  };
}

test("rekam LPSE tetap memuat rincian realisasi Data INAPROC", () => {
  const { kontrakPerRup } = gabungKontrakRealisasi([lpse()], [realisasi()]);
  const kontrak = kontrakPerRup.get("65400706");

  expect(kontrak?.sumber).toBe("LPSE");
  expect(kontrak?.jenis).toBe("nontender");
  expect(kontrak?.nilai_kontrak).toBe(298_616_000);
  expect(kontrak?.paketRealisasi).toEqual([
    {
      kodePaket: "11039836000",
      nilai: 298_616_000,
      sumber: "Non Tender",
      penyedia: "RISAN GEMILANG JAYA",
      penyediaSemua: ["RISAN GEMILANG JAYA"],
    },
  ]);
  expect(kontrak?.transaksi).toBe(1);
  expect(kontrak?.jumlahPaket).toBe(1);
  expect(kontrak?.sumberTransaksi).toBe("Non Tender");
  expect(kontrak?.penyediaLain).toBeUndefined();
  expect(kontrak?.url).toContain("/nontender/");
});

test("rekam LPSE tanpa baris realisasi tidak mengarang rincian", () => {
  const { kontrakPerRup, realisasiPerRup } = gabungKontrakRealisasi([lpse()], []);

  expect(kontrakPerRup.get("65400706")?.paketRealisasi).toBeUndefined();
  expect(kontrakPerRup.get("65400706")?.sumberTransaksi).toBeUndefined();
  expect(realisasiPerRup.size).toBe(0);
});

test("tanpa rekam LPSE, kontrak diisi Data INAPROC", () => {
  const { kontrakPerRup, diisiRealisasi } = gabungKontrakRealisasi(
    [],
    [realisasi({ metode: "E-Purchasing" })],
  );
  const kontrak = kontrakPerRup.get("65400706");

  expect(kontrak?.sumber).toBe("Data INAPROC");
  expect(kontrak?.jenis).toBe("e-purchasing");
  expect(kontrak?.nilai_kontrak).toBe(298_616_000);
  expect(kontrak?.url).toBe("https://data.inaproc.id/realisasi?kode=11039836000");
  expect(kontrak?.paketRealisasi).toHaveLength(1);
  expect(diisiRealisasi).toBe(1);
});

test("penyedia lain dari realisasi tidak menggandakan pemenang LPSE", () => {
  const { kontrakPerRup } = gabungKontrakRealisasi(
    [lpse()],
    [
      realisasi({ kode_paket: "A", penyedia: "risan gemilang jaya", nilai: 100 }),
      realisasi({ kode_paket: "B", penyedia: "CV. MITRA JALAN", nilai: 50, sumber_transaksi: "Tender" }),
    ],
  );
  const kontrak = kontrakPerRup.get("65400706");

  expect(kontrak?.penyedia).toBe("RISAN GEMILANG JAYA");
  expect(kontrak?.penyediaLain).toEqual(["CV. MITRA JALAN"]);
  expect(kontrak?.paketRealisasi?.map((paket) => paket.kodePaket)).toEqual(["A", "B"]);
});

test("baris swakelola dan nama instansi tidak dihitung sebagai penyedia", () => {
  const { kontrakPerRup, realisasiPerRup } = gabungKontrakRealisasi(
    [],
    [
      realisasi({ metode: "Swakelola", penyedia: "CV. SWAKELOLA" }),
      realisasi({ penyedia: "Dinas Pekerjaan Umum Dan Penataan Ruang" }),
    ],
  );

  expect(kontrakPerRup.size).toBe(0);
  expect(realisasiPerRup.size).toBe(0);
});

test("varian penulisan penyedia dari dua sumber tidak menggandakan paket", () => {
  const { kontrakPerRup, rupPerPenyedia } = gabungKontrakRealisasi(
    [lpse({ pemenang: "CV JABARU" })],
    [realisasi({ penyedia: "CV. JABARU" })],
  );
  const kontrak = kontrakPerRup.get("65400706");

  expect(kontrak?.penyedia).toBe("CV JABARU");
  expect(kontrak?.penyediaLain).toBeUndefined();
  expect([...rupPerPenyedia.keys()]).toEqual(["CV JABARU"]);
  expect(rupPerPenyedia.get("CV JABARU")?.size).toBe(1);
});

test("kunci penyedia membuang tanda baca dan spasi ganda", () => {
  expect(kunciPenyedia("CV.  JABARU")).toBe(kunciPenyedia("cv JABARU"));
  expect(kunciPenyedia("CV.ADI PUTRA KARYA")).toBe(kunciPenyedia("CV. ADI PUTRA KARYA"));
  expect(kunciPenyedia("PT.  BERKAH KARYA NURANI")).toBe(kunciPenyedia("PT BERKAH KARYA NURANI"));
  expect(kunciPenyedia("cv. tri karya")).toBe(kunciPenyedia("CV TRI KARYA"));
});

test("nama yang hurufnya berbeda tetap dua penyedia", () => {
  const { kontrakPerRup } = gabungKontrakRealisasi(
    [lpse({ pemenang: "PT PRIAMA KARYATAMA GEMILANG" })],
    [realisasi({ penyedia: "PT PRIMA KARYATAMA GEMILANG" })],
  );
  const kontrak = kontrakPerRup.get("65400706");

  expect(kontrak?.penyediaLain).toEqual(["PT PRIMA KARYATAMA GEMILANG"]);
});

test("satu RUP dengan beberapa transaksi menjumlahkan nilai tanpa membagi nilai bersama", () => {
  const { kontrakPerRup } = gabungKontrakRealisasi(
    [],
    [
      realisasi({ kode_paket: "A", penyedia: "CV. BUMI SALAKA, CV. ZARMINA FAIQA", nilai: 200 }),
      realisasi({ kode_paket: "B", penyedia: "CV. BUMI SALAKA", nilai: 100 }),
    ],
  );
  const kontrak = kontrakPerRup.get("65400706");

  expect(kontrak?.nilai_kontrak).toBe(300);
  expect(kontrak?.transaksi).toBe(2);
  expect(kontrak?.paketRealisasi?.find((paket) => paket.kodePaket === "A")?.penyediaSemua).toEqual([
    "CV. BUMI SALAKA",
    "CV. ZARMINA FAIQA",
  ]);
  expect(kontrak?.penyediaLain).toEqual(["CV. ZARMINA FAIQA"]);
});
