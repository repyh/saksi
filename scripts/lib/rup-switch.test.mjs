import { describe, expect, test } from "bun:test";
import { indeksNama, hitungDerauPagu, kunciBulan, kunciNama, sidikNama } from "./rup-switch.mjs";

describe("kunciNama", () => {
  test("membuang tanda baca dan kapitalisasi", () => {
    expect(kunciNama("Jl. Lingk.Rw 08 dsk Kel. Alam Jaya")).toBe("jl lingk rw 08 dsk kel alam jaya");
  });

  test("nama kosong menjadi teks kosong", () => {
    expect(kunciNama(null)).toBe("");
    expect(kunciNama("  ")).toBe("");
  });
});

describe("sidikNama", () => {
  test("urutan kata dan pembungkus birokrasi tidak mengubah sidik", () => {
    expect(sidikNama("Kegiatan Pembangunan Sarana dan Prasarana di Kelurahan (DAU) Pembangunan Drainase Kelurahan Mekarsari")).toBe(
      sidikNama("Kegiatan Pembangunan Sarana dan Prasarana di Kelurahan Mekarsari (Pembangunan Drainase)"),
    );
  });

  test("paket lanjutan bukan paket yang sama", () => {
    expect(sidikNama("Peningkatan Jalan M. Toha")).not.toBe(sidikNama("Peningkatan Jalan M. Toha Lanjutan"));
  });

  test("nomor RW membedakan pekerjaan di kelurahan yang sama", () => {
    expect(sidikNama("Drainase RW 14 Kel. Gebang Raya")).not.toBe(sidikNama("Drainase RW 16 Kel. Gebang Raya"));
  });
});

describe("indeksNama", () => {
  test("mengelompokkan baris dengan kunci yang sama", () => {
    const baris = [
      { kode_rup: "1", paket: "Peningkatan Jalan M. Toha" },
      { kode_rup: "2", paket: "peningkatan jalan m toha" },
      { kode_rup: "3", paket: "Peningkatan Jalan Lain" },
    ];
    const peta = indeksNama(baris, (x) => x.paket);
    expect(peta.get("peningkatan jalan m toha")?.map((x) => x.kode_rup)).toEqual(["1", "2"]);
    expect(peta.size).toBe(2);
  });
});

describe("hitungDerauPagu", () => {
  const opsi = {
    tahun: (x) => x.tahun,
    satker: (x) => x.satker,
    pagu: (x) => x.pagu,
    kunciRup: (x) => x.kode_rup,
  };

  test("menghitung paket yang berbagi pagu dengan kode RUP lain", () => {
    const baris = [
      { kode_rup: "1", tahun: 2025, satker: "pu", pagu: 200_000_000 },
      { kode_rup: "2", tahun: 2025, satker: "pu", pagu: 200_000_000 },
      { kode_rup: "3", tahun: 2025, satker: "pu", pagu: 150_000_000 },
    ];
    expect(hitungDerauPagu(baris, opsi)).toBe(2);
  });

  test("tahun atau satker berbeda tidak dihitung", () => {
    const baris = [
      { kode_rup: "1", tahun: 2025, satker: "pu", pagu: 200_000_000 },
      { kode_rup: "2", tahun: 2026, satker: "pu", pagu: 200_000_000 },
      { kode_rup: "3", tahun: 2025, satker: "dishub", pagu: 200_000_000 },
    ];
    expect(hitungDerauPagu(baris, opsi)).toBe(0);
  });
});

describe("kunciBulan", () => {
  test("mengubah nama bulan Indonesia menjadi kunci urut", () => {
    expect(kunciBulan("Juli 2026")).toBe("2026-07");
    expect(kunciBulan("Desember 2026")).toBe("2026-12");
    expect(kunciBulan("Januari 2025")).toBe("2025-01");
  });

  test("format lain diabaikan", () => {
    expect(kunciBulan("")).toBeNull();
    expect(kunciBulan("2026-07")).toBeNull();
    expect(kunciBulan("Foo 2026")).toBeNull();
  });
});
