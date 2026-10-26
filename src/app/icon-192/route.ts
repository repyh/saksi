import { createElement } from "react";
import { ImageResponse } from "next/og";
import AppIcon from "@/features/pwa/components/app-icon";

export function GET() {
  return new ImageResponse(createElement(AppIcon), {
    width: 192,
    height: 192,
  });
}
