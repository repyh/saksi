import type { ImageSanitizerStrategy } from "@/features/uploads/contracts/file-intake.contract";
import { BrowserImageSanitizerStrategy } from "@/features/uploads/strategies/browser-image-sanitizer.strategy";

const strategies: ImageSanitizerStrategy[] = [new BrowserImageSanitizerStrategy()];

export async function resolveImageSanitizer(file: File): Promise<ImageSanitizerStrategy> {
  for (const strategy of strategies) {
    if (await strategy.supports(file)) return strategy;
  }
  throw new Error("Pilih gambar JPG, PNG, atau WebP yang valid.");
}
