import { createElement } from "react";
import { ImageResponse } from "next/og";
import AppIcon from "@/features/pwa/components/app-icon";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(createElement(AppIcon), size);
}
