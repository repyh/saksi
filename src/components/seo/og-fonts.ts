import { readFileSync } from "node:fs";
import path from "node:path";

interface BrandFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 800;
  style: "normal";
}

let cache: BrandFont[] | null = null;

/**
 * Font untuk ImageResponse. `next/font` tidak bisa dipakai di sini, jadi tiga subset
 * Raleway/Open Sans (OFL) disimpan di `public/fonts` dan dibaca sekali per proses.
 */
export function loadBrandFonts(): BrandFont[] {
  if (cache) return cache;

  const dir = path.join(process.cwd(), "public", "fonts");
  const read = (file: string) => readFileSync(path.join(dir, file));

  cache = [
    { name: "Open Sans", data: read("open-sans-400.ttf"), weight: 400, style: "normal" },
    { name: "Open Sans", data: read("open-sans-600.ttf"), weight: 600, style: "normal" },
    { name: "Raleway", data: read("raleway-800.ttf"), weight: 800, style: "normal" },
  ];

  return cache;
}
