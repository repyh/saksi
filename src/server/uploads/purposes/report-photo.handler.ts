import "server-only";
import { ApiError } from "@/server/api/shared/api-error";
import { uploadPrivateReportImage } from "@/server/storage/supabase-storage.client";
import type { SanitizedReportImage } from "@/server/uploads/server-image-sanitizer.strategy";

export type StoredReportPhoto = SanitizedReportImage & { objectPath: string };

export class ReportPhotoHandler {
  async store(objectPath: string, asset: SanitizedReportImage): Promise<StoredReportPhoto> {
    try {
      await uploadPrivateReportImage(objectPath, asset.bytes);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "REPORT_STORAGE_FAILED", "Foto laporan belum dapat disimpan.");
    }
    return { ...asset, objectPath };
  }
}

export const reportPhotoHandler = new ReportPhotoHandler();
