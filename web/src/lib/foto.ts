/**
 * lib/foto.ts — semua pemrosesan foto terjadi di perangkat.
 * Skala maks 1024 px, blur manual dengan kuas, ekspor JPEG tanpa EXIF.
 */

export type Foto = {
  kanvas: HTMLCanvasElement;
  /** Salinan asli (setelah diskalakan) untuk "Bersihkan". */
  asli: HTMLCanvasElement;
  /** Salinan yang sudah diburamkan, dipakai kuas. */
  blur: HTMLCanvasElement;
  lebar: number;
  tinggi: number;
};

function kanvasBaru(lebar: number, tinggi: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = lebar;
  c.height = tinggi;
  return c;
}

function duaD(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Kanvas 2D tidak tersedia di peramban ini.");
  return ctx;
}

/** Blur deterministik: filter kanvas bila ada, jika tidak downscale bertingkat. */
function buatBlur(sumber: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = sumber;
  const hasil = kanvasBaru(w, h);
  const ctx = duaD(hasil);

  ctx.filter = `blur(${Math.max(6, Math.round(w / 80))}px)`;
  const didukung = ctx.filter !== "none" && ctx.filter !== "";

  if (didukung) {
    ctx.drawImage(sumber, 0, 0);
    return hasil;
  }

  const kecil = kanvasBaru(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 10)));
  const kctx = duaD(kecil);
  kctx.imageSmoothingEnabled = true;
  kctx.drawImage(sumber, 0, 0, kecil.width, kecil.height);
  for (let i = 0; i < 2; i += 1) kctx.drawImage(kecil, 0, 0, kecil.width, kecil.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(kecil, 0, 0, w, h);
  return hasil;
}

async function dekode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* jatuh ke <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((selesai, gagal) => {
      const img = new Image();
      img.onload = () => selesai(img);
      img.onerror = () => gagal(new Error("Berkas bukan gambar yang bisa dibaca."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Muat, perkecil ke ≤`maks` px sisi terpanjang, gambar ulang (EXIF hilang). */
export async function siapkanFoto(file: File, maks = 1024): Promise<Foto> {
  if (!file.type.startsWith("image/")) throw new Error("Pilih berkas gambar (JPG/PNG/WebP).");
  const gambar = await dekode(file);
  const lw = "width" in gambar ? gambar.width : 0;
  const lh = "height" in gambar ? gambar.height : 0;
  if (!lw || !lh) throw new Error("Gambar tidak punya dimensi yang bisa dibaca.");

  const skala = Math.min(1, maks / Math.max(lw, lh));
  const lebar = Math.max(1, Math.round(lw * skala));
  const tinggi = Math.max(1, Math.round(lh * skala));

  const kanvas = kanvasBaru(lebar, tinggi);
  const ctx = duaD(kanvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(gambar as CanvasImageSource, 0, 0, lebar, tinggi);

  const asli = kanvasBaru(lebar, tinggi);
  duaD(asli).drawImage(kanvas, 0, 0);

  if ("close" in gambar) gambar.close();

  return { kanvas, asli, blur: buatBlur(kanvas), lebar, tinggi };
}

/** Cap kuas blur pada satu titik (koordinat piksel kanvas). */
export function capBlur(foto: Foto, x: number, y: number, radius: number): void {
  const ctx = duaD(foto.kanvas);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4, radius), 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(foto.blur, 0, 0);
  ctx.restore();
}

/** Kembalikan kanvas kerja ke gambar asli (membatalkan semua kuas). */
export function bersihkan(foto: Foto): void {
  const ctx = duaD(foto.kanvas);
  ctx.clearRect(0, 0, foto.lebar, foto.tinggi);
  ctx.drawImage(foto.asli, 0, 0);
}

export function eksporJpeg(kanvas: HTMLCanvasElement, kualitas = 0.86): Promise<Blob> {  return new Promise((selesai, gagal) => {
    kanvas.toBlob(
      (blob) => (blob ? selesai(blob) : gagal(new Error("Ekspor foto gagal."))),
      "image/jpeg",
      kualitas,
    );
  });
}

/** Thumbnail kecil untuk disimpan di localStorage. */
export function perkecil(kanvas: HTMLCanvasElement, maks = 480): HTMLCanvasElement {
  const skala = Math.min(1, maks / Math.max(kanvas.width, kanvas.height));
  const c = kanvasBaru(
    Math.max(1, Math.round(kanvas.width * skala)),
    Math.max(1, Math.round(kanvas.height * skala)),
  );
  const ctx = duaD(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(kanvas, 0, 0, c.width, c.height);
  return c;
}

export function ukuranBerkas(byte: number): string {
  if (byte >= 1024 * 1024) return `${(byte / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(byte / 1024))} KB`;
}
