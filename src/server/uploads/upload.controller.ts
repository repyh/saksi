import "server-only";
import { ApiError } from "@/server/api/shared/api-error";
import { reportPhotoHandler, type StoredReportPhoto } from "@/server/uploads/purposes/report-photo.handler";
import { ServerImageSanitizerStrategy, type SupportedRasterFormat } from "@/server/uploads/server-image-sanitizer.strategy";

const imageStrategies: Array<{ format: SupportedRasterFormat; strategy: ServerImageSanitizerStrategy }> = [
  { format: "jpeg", strategy: new ServerImageSanitizerStrategy("jpeg") },
  { format: "png", strategy: new ServerImageSanitizerStrategy("png") },
  { format: "webp", strategy: new ServerImageSanitizerStrategy("webp") },
];

export class UploadController {
  async dispatch(input: { purpose: "report.photo"; objectPath: string; bytes: Buffer }): Promise<StoredReportPhoto> {
    for (const { strategy } of imageStrategies) {
      if (await strategy.supports(input.bytes)) {
        const sanitized = await strategy.sanitize(input.bytes);
        return reportPhotoHandler.store(input.objectPath, sanitized);
      }
    }
    throw new ApiError(422, "INVALID_IMAGE", "Pilih gambar JPG, PNG, atau WebP yang valid.");
  }
}

export const uploadController = new UploadController();
