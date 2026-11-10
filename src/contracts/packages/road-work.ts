import type { RoadWorkCategory } from "./road-package.contract";

export type SpecificRoadWorkCategory = Exclude<RoadWorkCategory, "SEMUA">;

export const ROAD_WORK_TYPES: readonly SpecificRoadWorkCategory[] = [
  "PERMUKAAN",
  "DRAINASE",
  "JEMBATAN",
];

export const ROAD_WORK_LABELS: Record<SpecificRoadWorkCategory, string> = {
  PERMUKAAN: "Permukaan & trotoar",
  DRAINASE: "Drainase & penahan",
  JEMBATAN: "Jembatan",
};

/**
 * Kata objek per kategori. Kategori ditentukan oleh objek yang **disebut paling awal** di nama
 * paket, bukan urutan pemeriksaan daftar ini: "Pembangunan Jembatan Saluran X" adalah jembatan,
 * sedangkan "Pembangunan Jalan Saluran Pembuang X" adalah permukaan jalan.
 * Kata baru hanya ditambahkan dari nama paket nyata, bukan tebakan.
 */
const OBJEK: ReadonlyArray<{ kategori: SpecificRoadWorkCategory; pola: RegExp }> = [
  { kategori: "JEMBATAN", pola: /\b(jembatan|flyover|underpass)\b/ },
  {
    kategori: "DRAINASE",
    pola: /\b(drainase|saluran|spal|turap|talud|tpt|bronjong|gorong|culvert|tanggul|got|selokan|riol)\b/,
  },
  {
    kategori: "PERMUKAAN",
    pola: /\b(jalan|jl|trotoar|paving|aspal|hotmix|beton|rabat)\b/,
  },
];

export function classifyRoadWork(name: string): SpecificRoadWorkCategory {
  const teks = ` ${name.toLocaleLowerCase("id-ID")} `;
  let kategori: SpecificRoadWorkCategory = "PERMUKAAN";
  let posisi = Number.POSITIVE_INFINITY;
  for (const objek of OBJEK) {
    const cocok = objek.pola.exec(teks);
    if (cocok && cocok.index < posisi) {
      posisi = cocok.index;
      kategori = objek.kategori;
    }
  }
  return kategori;
}
