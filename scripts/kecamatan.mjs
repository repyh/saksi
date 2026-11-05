// Ambil batas kecamatan Kota Tangerang dari ArcGIS kota lalu simpan ke public/data/kec.geojson.
// Sumber: maps.tangerangkota.go.id — layer administrasi resmi (13 kecamatan).
import { writeFile } from "node:fs/promises";
import path from "node:path";

const LAYER =
  "https://maps.tangerangkota.go.id/arcgis/rest/services/Batas_Adminsitratif/Batas_Wilayah_Kecamatan_def/MapServer/0/query";
const OUT = path.join(process.cwd(), "public", "data", "kec.geojson");

const titleCase = (value) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .map((kata) => kata.charAt(0).toUpperCase() + kata.slice(1))
    .join(" ");

const bulatkan = (koordinat) => {
  if (typeof koordinat[0] === "number") {
    return [Number(koordinat[0].toFixed(5)), Number(koordinat[1].toFixed(5))];
  }
  return koordinat.map(bulatkan);
};

const url = `${LAYER}?where=1%3D1&outFields=objectid,wadmkc,wadmkk&outSR=4326&f=geojson&returnGeometry=true`;
const response = await fetch(url);
if (!response.ok) throw new Error(`ArcGIS menolak permintaan: ${response.status}`);
const data = await response.json();

const features = (data.features ?? []).map((feature) => ({
  type: "Feature",
  properties: {
    objectid: feature.properties?.objectid ?? null,
    wadmkc: titleCase(String(feature.properties?.wadmkc ?? "")),
  },
  geometry: {
    type: feature.geometry.type,
    coordinates: bulatkan(feature.geometry.coordinates),
  },
}));

if (features.length !== 13) {
  throw new Error(`Jumlah kecamatan tidak seperti yang diharapkan: ${features.length}`);
}

await writeFile(OUT, JSON.stringify({ type: "FeatureCollection", features }));
const nama = features.map((feature) => feature.properties.wadmkc).sort();
console.log(`kec.geojson: ${features.length} kecamatan`);
console.log(nama.join(" · "));
