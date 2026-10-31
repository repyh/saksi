"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { formatPrecisionBadgeLabel, formatRupiahFull } from "./road-types";

interface MapCanvasProps {
  packages: RoadPackageItem[];
  selectedPackage: RoadPackageItem | null;
  onSelectPackage: (pkg: RoadPackageItem) => void;
}

function MapViewportSync({ selectedPackage }: { selectedPackage: RoadPackageItem | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedPackage?.lat != null && selectedPackage?.lon != null) {
      map.setView([selectedPackage.lat, selectedPackage.lon], Math.max(map.getZoom(), 14), {
        animate: true,
      });
    }
  }, [map, selectedPackage]);

  return null;
}

export default function MapCanvas({
  packages,
  selectedPackage,
  onSelectPackage,
}: MapCanvasProps) {
  const mappedPackages = packages.filter(
    (pkg) => pkg.presisi_peta !== "Kabupaten" && pkg.lat != null && pkg.lon != null
  );

  const corridors = mappedPackages.filter(
    (pkg) =>
      pkg.presisi_peta === "Garis Koridor" &&
      pkg.koridor?.lat_dari != null &&
      pkg.koridor?.lon_dari != null &&
      pkg.koridor?.lat_ke != null &&
      pkg.koridor?.lon_ke != null
  );

  const centerLat = selectedPackage?.lat ?? -6.158197;
  const centerLon = selectedPackage?.lon ?? 106.559651;

  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={15}
      scrollWheelZoom
      preferCanvas
      className="h-[580px] w-full bg-muted/30"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapViewportSync selectedPackage={selectedPackage} />

      {corridors.map((pkg) => {
        if (!pkg.koridor) return null;
        const isSelected = selectedPackage?.kode_rup === pkg.kode_rup;

        return (
          <Polyline
            key={`corridor-${pkg.kode_rup}`}
            positions={[
              [pkg.koridor.lat_dari, pkg.koridor.lon_dari],
              [pkg.koridor.lat_ke, pkg.koridor.lon_ke],
            ]}
            pathOptions={{
              color: isSelected ? "#D9381E" : "#0058A3",
              weight: isSelected ? 4 : 2.5,
              opacity: isSelected ? 0.95 : 0.75,
            }}
            eventHandlers={{
              click: () => onSelectPackage(pkg),
            }}
          />
        );
      })}

      {mappedPackages.map((pkg) => {
        if (pkg.lat == null || pkg.lon == null) return null;
        const isSelected = selectedPackage?.kode_rup === pkg.kode_rup;
        const isDistrict = pkg.presisi_peta === "Kecamatan";

        const fillColor = isSelected
          ? "#D9381E"
          : isDistrict
          ? "#3B82F6"
          : "#0058A3";

        const strokeColor = isSelected ? "#FFDA1A" : "#FFFFFF";

        return (
          <CircleMarker
            key={pkg.kode_rup}
            center={[pkg.lat, pkg.lon]}
            radius={isSelected ? 8 : isDistrict ? 4.5 : 5}
            pathOptions={{
              color: strokeColor,
              weight: isSelected ? 3 : 1.2,
              fillColor,
              fillOpacity: isSelected ? 1 : 0.85,
            }}
            eventHandlers={{
              click: () => onSelectPackage(pkg),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <div className="font-sans text-xs">
                <p className="font-bold text-foreground">{pkg.nama}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatRupiahFull(pkg.pagu)} · {formatPrecisionBadgeLabel(pkg.presisi_peta)}
                </p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
