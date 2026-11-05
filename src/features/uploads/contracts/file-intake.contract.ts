export type SanitizedImageAsset = {
  blob: Blob;
  width: number;
  height: number;
  mediaType: "image/webp";
};

export type ImageIntakePolicy = {
  purpose: "report.photo";
  maxInputBytes: number;
  maxOutputBytes: number;
  maxPixels: number;
  maxDimension: number;
  quality: number;
};

export type ImageSanitizerStrategy = {
  supports(file: File): Promise<boolean>;
  sanitize(file: File, policy: ImageIntakePolicy): Promise<SanitizedImageAsset>;
};
