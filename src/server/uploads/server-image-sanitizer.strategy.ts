import "server-only";
import sharp from "sharp";
import { ApiError } from "@/server/api/shared/api-error";

export type SanitizedReportImage = {
  bytes: Buffer;
  width: number;
  height: number;
  mediaType: "image/webp";
  sanitizerVersion: string;
};

export type SupportedRasterFormat = "jpeg" | "png" | "webp";

export class ServerImageSanitizerStrategy {
  constructor(private readonly sourceFormat: SupportedRasterFormat) {}

  async supports(input: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
      return metadata.format === this.sourceFormat;
    } catch {
      return false;
    }
  }

  async sanitize(input: Buffer): Promise<SanitizedReportImage> {
    try {
      const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error", animated: false });
      const metadata = await image.metadata();
      if (metadata.format !== this.sourceFormat || !metadata.width || !metadata.height || metadata.pages && metadata.pages > 1) {
        throw new ApiError(422, "INVALID_IMAGE", "Foto harus berupa satu gambar JPG, PNG, atau WebP yang valid.");
      }
      if (metadata.width * metadata.height > 40_000_000) {
        throw new ApiError(422, "IMAGE_RESOLUTION_TOO_LARGE", "Resolusi foto terlalu besar untuk diproses.");
      }

      const { data, info } = await image
        .rotate()
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      if (data.byteLength < 1 || data.byteLength > 5 * 1024 * 1024) {
        throw new ApiError(422, "SANITIZED_IMAGE_TOO_LARGE", "Foto hasil pemrosesan masih terlalu besar.");
      }

      return {
        bytes: data,
        width: info.width,
        height: info.height,
        mediaType: "image/webp",
        sanitizerVersion: "sharp-webp-v1",
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, "INVALID_IMAGE", "Foto tidak dapat dibuka atau diproses.");
    }
  }
}
