import type { ImageIntakePolicy, ImageSanitizerStrategy, SanitizedImageAsset } from "@/features/uploads/contracts/file-intake.contract";

type ImageSignature = "jpeg" | "png" | "webp";

async function identifyImage(file: File): Promise<ImageSignature | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Foto tidak dapat diproses di perangkat ini."));
    }, "image/webp", quality);
  });
}

export class BrowserImageSanitizerStrategy implements ImageSanitizerStrategy {
  async supports(file: File): Promise<boolean> {
    return (await identifyImage(file)) !== null;
  }

  async sanitize(file: File, policy: ImageIntakePolicy): Promise<SanitizedImageAsset> {
    const signature = await identifyImage(file);
    if (!signature) throw new Error("Pilih gambar JPG, PNG, atau WebP yang valid.");

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      throw new Error("Foto tidak dapat dibuka. Coba pilih gambar lain.");
    }

    try {
      const sourcePixels = bitmap.width * bitmap.height;
      if (!bitmap.width || !bitmap.height || sourcePixels > policy.maxPixels) {
        throw new Error("Resolusi foto terlalu besar untuk diproses dengan aman.");
      }

      const scale = Math.min(1, policy.maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Foto tidak dapat diproses di perangkat ini.");
      context.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasBlob(canvas, policy.quality);
      if (blob.size > policy.maxOutputBytes) {
        throw new Error("Hasil pemrosesan foto masih terlalu besar. Pilih foto lain.");
      }

      return { blob, width, height, mediaType: "image/webp" };
    } finally {
      bitmap.close();
    }
  }
}
