/** Satu variabel untuk peta dasar; nilai berupa URL style JSON vektor. */
export const BASEMAP_URL =
  process.env.NEXT_PUBLIC_BASEMAP_URL?.trim() || "https://tiles.openfreemap.org/styles/positron";

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OPENFREEMAP_ATTRIBUTION = '&copy; <a href="https://openfreemap.org/">OpenFreeMap</a>';

export function attributionBasemap(url: string) {
  if (url.includes("openfreemap.org")) {
    return `${OSM_ATTRIBUTION} ${OPENFREEMAP_ATTRIBUTION}`;
  }
  if (url.includes("cartocdn.com")) {
    return `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`;
  }
  if (url.includes("arcgisonline.com")) {
    return '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  }
  return OSM_ATTRIBUTION;
}

export const OVERTURE_ATTRIBUTION = "© OpenStreetMap contributors, Overture Maps Foundation (ODbL)";
export const PHOTON_ATTRIBUTION = "Pencarian alamat oleh Photon · data © OpenStreetMap contributors";
