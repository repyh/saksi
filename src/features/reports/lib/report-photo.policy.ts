import type { ImageIntakePolicy } from "@/features/uploads/contracts/file-intake.contract";

export const reportPhotoPolicy: ImageIntakePolicy = {
  purpose: "report.photo",
  maxInputBytes: 10 * 1024 * 1024,
  maxOutputBytes: 5 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxDimension: 1024,
  quality: 0.86,
};
