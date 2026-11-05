import type { SanitizedImageAsset } from "@/features/uploads/contracts/file-intake.contract";

export type LocalReportPhoto = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
};

export function handleReportPhoto(asset: SanitizedImageAsset): LocalReportPhoto {
  const file = new File([asset.blob], "foto-kerusakan.webp", {
    type: asset.mediaType,
    lastModified: Date.now(),
  });

  return {
    file,
    previewUrl: URL.createObjectURL(asset.blob),
    width: asset.width,
    height: asset.height,
  };
}
