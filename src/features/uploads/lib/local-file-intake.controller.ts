import type { ImageIntakePolicy, SanitizedImageAsset } from "@/features/uploads/contracts/file-intake.contract";
import { resolveImageSanitizer } from "@/features/uploads/lib/sanitizer-registry";

export class LocalFileIntakeController {
  async dispatch<T>(
    file: File,
    policy: ImageIntakePolicy,
    purposeHandler: (asset: SanitizedImageAsset) => T | Promise<T>,
  ): Promise<T> {
    if (file.size <= 0) throw new Error("File foto kosong.");
    if (file.size > policy.maxInputBytes) throw new Error("Ukuran foto maksimal 10 MB.");

    const sanitizer = await resolveImageSanitizer(file);
    const sanitizedAsset = await sanitizer.sanitize(file, policy);
    return purposeHandler(sanitizedAsset);
  }
}

export const localFileIntakeController = new LocalFileIntakeController();
