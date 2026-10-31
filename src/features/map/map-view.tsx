"use client";

import dynamic from "next/dynamic";

const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="h-[min(64vh,560px)] min-h-[360px] animate-pulse rounded-2xl bg-slate-100" />
  ),
});

export default function MapView() {
  return <MapCanvas packages={[]} selectedPackage={null} onSelectPackage={() => {}} />;
}
