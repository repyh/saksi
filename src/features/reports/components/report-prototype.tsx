"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchRoadPackages } from "@/features/map/package-api";
import { localFileIntakeController } from "@/features/uploads/lib/local-file-intake.controller";
import { handleReportPhoto, type LocalReportPhoto } from "@/features/reports/lib/report-photo.handler";
import { reportPhotoPolicy } from "@/features/reports/lib/report-photo.policy";
import { deleteReportDraft, listReportDrafts, saveReportDraft } from "@/features/reports/lib/report-draft-store";
import { simulationBadgeEnabled } from "@/lib/flags";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import type { LineString, MultiLineString } from "geojson";
import type { RegionSummary } from "@/contracts/regions/region.contract";
import type { RoadSegment } from "@/contracts/reports/road-search.contract";
import type { GeocodeResult } from "@/contracts/reports/geocode.contract";
import type { ReportDraft, ReportDraftState, ReportLocationMode } from "@/contracts/reports/report-draft.contract";
import { isPointNearRoad } from "@/contracts/reports/location";
import type { ReportCoarseSize, ReportDamageType, ReportObservedCause } from "@/generated/prisma/client";
import { FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCamera, FiCheck, FiCheckCircle, FiImage, FiMapPin, FiSearch, FiX } from "react-icons/fi";
import { AddressSearch } from "./address-search";
import { RoadSearch } from "./road-search";
import ReportLocationMap, { type ReportMapFocus } from "./report-location-map";

const STEPS = ["Foto", "Kerusakan", "Lokasi & paket", "Sukses"] as const;
const DAMAGE_TYPES = [
  { label: "Lubang", detail: "Berlubang, kedalaman terlihat" },
  { label: "Retak", detail: "Garis retak memanjang atau melebar" },
  { label: "Amblas", detail: "Permukaan turun dari sekitarnya" },
  { label: "Genangan", detail: "Air menggenang di badan jalan" },
  { label: "Drainase mampet", detail: "Saluran tersumbat atau tidak mengalir" },
  { label: "Jembatan rusak", detail: "Gorong-gorong, box culvert, atau jembatan" },
  { label: "Lainnya", detail: "Kerusakan lain yang terlihat" },
] as const;
const CAUSE_OPTIONS = ["Dilalui kendaraan berat", "Tidak ada drainase", "Genangan berulang", "Lalu lintas padat", "Bahan tidak sesuai", "Tidak tahu"] as const;
const SIZE_OPTIONS = ["Setelapak tangan", "Sebesar ban", "Lebih dari 1 m²"] as const;
const DAMAGE_CODES: Record<(typeof DAMAGE_TYPES)[number]["label"], ReportDamageType> = {
  Lubang: "POTHOLE",
  Retak: "CRACK",
  Amblas: "SUBSIDENCE",
  Genangan: "STANDING_WATER",
  "Drainase mampet": "BLOCKED_DRAINAGE",
  "Jembatan rusak": "DAMAGED_BRIDGE",
  Lainnya: "OTHER",
};
const CAUSE_CODES: Record<(typeof CAUSE_OPTIONS)[number], ReportObservedCause> = {
  "Dilalui kendaraan berat": "HEAVY_VEHICLE",
  "Tidak ada drainase": "NO_DRAINAGE",
  "Genangan berulang": "RECURRING_FLOODING",
  "Lalu lintas padat": "HEAVY_TRAFFIC",
  "Bahan tidak sesuai": "UNSUITABLE_MATERIAL",
  "Tidak tahu": "UNKNOWN",
};
const SIZE_CODES: Record<(typeof SIZE_OPTIONS)[number], ReportCoarseSize> = {
  "Setelapak tangan": "PALM",
  "Sebesar ban": "TIRE",
  "Lebih dari 1 m²": "OVER_1M2",
};

const DRAFT_ID = "laporan-aktif";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECEIPT_STORAGE_KEY = "saksi:report-receipt";
const RECEIPT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredReceipt = {
  code: string;
  savedAt: string;
  pointPublic: boolean;
  areaLabel: string;
};

function readStoredReceipt(): StoredReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RECEIPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredReceipt>;
    if (!parsed.code || !parsed.savedAt) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > RECEIPT_TTL_MS) {
      window.localStorage.removeItem(RECEIPT_STORAGE_KEY);
      return null;
    }
    return {
      code: parsed.code,
      savedAt: parsed.savedAt,
      pointPublic: Boolean(parsed.pointPublic),
      areaLabel: typeof parsed.areaLabel === "string" ? parsed.areaLabel : "",
    };
  } catch {
    return null;
  }
}

function describeSubmitFailure(status: number, code: string, message: string) {
  if (status === 429) return message || "Batas tiga laporan per jam tercapai. Coba lagi setelah batasnya berakhir.";
  if (status === 422) {
    if (code === "UNKNOWN_REPORT_AREA") return "Wilayah laporan tidak dikenali. Pilih ulang kecamatan, kelurahan, dan RW.";
    if (code === "UNKNOWN_PACKAGE_REFERENCE") return "Paket rujukan tidak ditemukan. Batalkan tautan paket lalu coba lagi.";
    return "Ada isian yang belum sesuai. Periksa foto, jenis kerusakan, dan lokasi sebelum mengirim lagi.";
  }
  if (status === 400) return "Kiriman tidak valid. Muat ulang halaman lalu coba lagi.";
  if (status === 413) return "Foto terlalu besar untuk dikirim. Pilih foto lain di bawah 10 MB.";
  if (status === 503) return "Layanan laporan sedang tidak tersedia. Coba lagi nanti atau kirim melalui kanal resmi.";
  return message
    ? `${message} Coba lagi sebentar lagi; isian Anda tetap tersimpan.`
    : "Laporan belum dapat dikirim. Periksa koneksi lalu coba lagi; isian Anda tetap tersimpan.";
}

function writeStoredReceipt(receipt: StoredReceipt) {
  try {
    window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
  } catch {
    // Penyimpanan perangkat dapat penuh atau diblokir; tanda terima tetap tampil di layar.
  }
}

type AreaGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};
type AreaOption = {
  id: string;
  district: string;
  village: string;
  rw: string;
  geometry: AreaGeometry;
};

type AdminArea = {
  id: string;
  level: "RW" | "KELURAHAN" | "KECAMATAN";
  district: string;
  village: string | null;
  rw: string | null;
  geometry: AreaGeometry;
};

type ReportPointState = { latitude: number; longitude: number; accuracyM: number | null };
type ReportLocationSourceState =
  | "MANUAL_AREA"
  | "DEVICE_RESOLVED_AREA"
  | "DEVICE_GEOLOCATION"
  | "MAP_PIN"
  | "ADDRESS_GEOCODE";

function areaLabelOf(area: AdminArea) {
  if (area.level === "RW" && area.village && area.rw) return `${area.village}, RW ${area.rw}`;
  if (area.level === "KELURAHAN" && area.village) return area.village;
  return `Kec. ${area.district}`;
}

function titleCase(value: string) {
  return value.toLocaleLowerCase("id-ID").replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("id-ID"));
}

function pointInRing(longitude: number, latitude: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function containsPoint(geometry: AreaGeometry, longitude: number, latitude: number) {
  const polygons = geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : geometry.coordinates as number[][][][];

  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return pointInRing(longitude, latitude, outerRing)
      && !holes.some((hole) => pointInRing(longitude, latitude, hole));
  });
}

function candidateOrder(item: RoadPackageItem, area: AreaOption, landmark: string) {
  const sameVillage = item.desa_resmi?.toLocaleLowerCase("id-ID") === area.village.toLocaleLowerCase("id-ID");
  const sameRw = sameVillage && item.rw?.replace(/^0+/, "") === area.rw.replace(/^0+/, "");
  const phrase = landmark.trim().toLocaleLowerCase("id-ID");
  const searchable = `${item.nama} ${item.lokasi_mikro ?? ""}`.toLocaleLowerCase("id-ID");
  const landmarkMatch = phrase.length >= 4 && searchable.includes(phrase);
  return sameRw ? 0 : sameVillage ? 1 : landmarkMatch ? 2 : 3;
}

function packageMatchesArea(item: RoadPackageItem, area: AreaOption) {
  if (item.kecamatan_resmi?.toLocaleLowerCase("id-ID") !== area.district.toLocaleLowerCase("id-ID")) return false;
  if (item.presisi_peta === "RW") {
    return item.desa_resmi?.toLocaleLowerCase("id-ID") === area.village.toLocaleLowerCase("id-ID")
      && item.rw?.replace(/^0+/, "") === area.rw.replace(/^0+/, "");
  }
  if (item.presisi_peta === "Kelurahan") {
    return item.desa_resmi?.toLocaleLowerCase("id-ID") === area.village.toLocaleLowerCase("id-ID");
  }
  return true;
}

function formatBudget(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export default function ReportPrototype({
  initialPackage = null,
  region,
}: {
  initialPackage?: RoadPackageItem | null;
  region: RegionSummary;
}) {
  const [step, setStep] = useState(0);
  const previousStep = useRef(step);
  const [locationMode, setLocationMode] = useState<ReportLocationMode>("POINT");
  const [draftCandidate, setDraftCandidate] = useState<ReportDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<StoredReceipt | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [photo, setPhoto] = useState<LocalReportPhoto | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [damageType, setDamageType] = useState<string>("");
  const [observedCauses, setObservedCauses] = useState<string[]>([]);
  const [coarseSize, setCoarseSize] = useState<string>("");
  const [description, setDescription] = useState("");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [adminAreas, setAdminAreas] = useState<AdminArea[]>([]);
  const [areaId, setAreaId] = useState("");
  const [landmark, setLandmark] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [point, setPoint] = useState<ReportPointState | null>(null);
  const derivedArea = useMemo<AdminArea | null>(() => {
    if (!point || !adminAreas.length) return null;
    const urutan: Array<AdminArea["level"]> = ["RW", "KELURAHAN", "KECAMATAN"];
    for (const level of urutan) {
      const match = adminAreas.find((area) => area.level === level && containsPoint(area.geometry, point.longitude, point.latitude));
      if (match) return match;
    }
    return null;
  }, [adminAreas, point]);
  const pointMessage = point
    ? adminAreas.length === 0
      ? "Menentukan wilayah dari titik…"
      : derivedArea
        ? derivedArea.level === "RW"
        ? `Titik berada di ${areaLabelOf(derivedArea)}; wilayah diturunkan otomatis dari pin.`
        : derivedArea.level === "KELURAHAN"
          ? `Titik di luar RW terpetakan; wilayah memakai Kelurahan ${derivedArea.village}, Kecamatan ${derivedArea.district}.`
          : `Titik hanya dapat diturunkan sampai Kecamatan ${derivedArea.district}.`
      : "Titik berada di luar wilayah Kota Tangerang. Geser pin ke dalam batas kota."
    : "";
  const displayLocationMessage = point ? pointMessage : locationMessage;
  const [selectedRoad, setSelectedRoad] = useState<RoadSegment | null>(null);
  const [publicLocationConsent, setPublicLocationConsent] = useState(true);
  const [candidates, setCandidates] = useState<RoadPackageItem[]>([]);
  const [candidateAreaId, setCandidateAreaId] = useState("");
  const [candidateError, setCandidateError] = useState<{ areaId: string; message: string } | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [districtFilter, setDistrictFilter] = useState("");
  const [villageFilter, setVillageFilter] = useState("");
  const [pendingLocationMode, setPendingLocationMode] = useState<ReportLocationMode | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<RoadPackageItem | null>(initialPackage);
  const [packageSelectionSource, setPackageSelectionSource] = useState<"PACKAGE_PAGE" | "CANDIDATE_LIST" | null>(initialPackage ? "PACKAGE_PAGE" : null);
  const [locationSource, setLocationSource] = useState<ReportLocationSourceState>("MANUAL_AREA");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [advanceError, setAdvanceError] = useState("");
  const [receiptCode, setReceiptCode] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const restoredDraftRef = useRef(false);
  const invalidateSubmissionKey = () => { idempotencyKey.current = null; };
  const selectedArea = areas.find((area) => area.id === areaId) ?? null;
  const currentDistrict = selectedArea?.district ?? districtFilter;
  const currentVillage = selectedArea?.village ?? villageFilter;
  const districtOptions = Array.from(new Set(areas.map((area) => area.district)))
    .sort((a, b) => a.localeCompare(b, "id-ID"));
  const villageOptions = Array.from(new Set(
    areas.filter((area) => area.district === currentDistrict).map((area) => area.village),
  )).sort((a, b) => a.localeCompare(b, "id-ID"));
  const rwOptions = areas
    .filter((area) => area.district === currentDistrict && area.village === currentVillage)
    .sort((a, b) => Number(a.rw) - Number(b.rw));
  const candidateArea: AreaOption | null = selectedArea ?? (derivedArea
    ? {
      id: derivedArea.id,
      district: derivedArea.district,
      village: derivedArea.village ?? "",
      rw: derivedArea.rw ?? "",
      geometry: derivedArea.geometry,
    }
    : null);
  const pointOutsideRegion = Boolean(point && adminAreas.length > 0 && !derivedArea);
  const roadWarning = Boolean(point && selectedRoad && !isPointNearRoad(point, selectedRoad.geometry as unknown as LineString | MultiLineString));
  const canAdvance = step === 0
    ? photo !== null && !isProcessingPhoto
    : step === 1
      ? damageType.length > 0
      : step === 2
        ? (candidateArea !== null || selectedPackage !== null) && !pointOutsideRegion && !isSubmitting
        : false;
  const currentCandidateError = candidateArea && candidateError?.areaId === candidateArea.id ? candidateError.message : "";
  const candidatesLoading = Boolean(candidateArea && !currentCandidateError && candidateAreaId !== candidateArea.id);
  const rankedCandidates = candidateArea && candidateAreaId === candidateArea.id
    ? [...candidates].sort((a, b) => candidateOrder(a, candidateArea, landmark) - candidateOrder(b, candidateArea, landmark))
    : [];
  const normalizedCandidateSearch = candidateSearch.trim().toLocaleLowerCase("id-ID");
  const visibleCandidates = normalizedCandidateSearch
    ? rankedCandidates.filter((item) => `${item.nama} ${item.kode_rup}`.toLocaleLowerCase("id-ID").includes(normalizedCandidateSearch))
    : rankedCandidates;
  const displayedCandidates = normalizedCandidateSearch || showAllCandidates
    ? visibleCandidates
    : visibleCandidates.slice(0, 5);
  const consentSummary = point
    ? publicLocationConsent
      ? "Titik presisi akan tampil di halaman publik."
      : "Titik presisi tidak akan tampil di halaman publik."
    : "Tanpa titik: lokasi hanya sampai wilayah.";
  // Kamera hanya mengikuti wilayah yang dipilih eksplisit, bukan wilayah turunan dari pin,
  // supaya mengetik patokan atau menempatkan pin tidak memicu fitBounds ulang.
  const selectedAreaDistrict = selectedArea?.district ?? "";
  const selectedAreaVillage = selectedArea?.village ?? "";
  const selectedAreaRw = selectedArea?.rw ?? "";
  const mapFocus: ReportMapFocus | null = selectedAreaDistrict
    ? { level: "RW", district: selectedAreaDistrict, village: selectedAreaVillage, rw: selectedAreaRw }
    : null;
  const requirementText = step === 0
    ? "Pilih foto dulu"
    : step === 1
      ? "Pilih jenis kerusakan"
      : step === 2
        ? "Pilih lokasi laporan dulu"
        : "";

  function goToStep(nextStep: number) {
    setAdvanceError("");
    setStep(nextStep);
  }

  function handleAdvance() {
    setAdvanceError("");
    if (!canAdvance) {
      setAdvanceError(requirementText);
      if (step === 0) document.getElementById("report-photo-camera")?.focus();
      else if (step === 1) document.querySelector<HTMLInputElement>('input[name="damage-type"]')?.focus();
      else document.getElementById("report-location-heading")?.focus();
      return;
    }
    if (step === 2) {
      void submitReport();
      return;
    }
    goToStep(step + 1);
  }

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const heading = stepHeadingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [step]);

  useEffect(() => {
    const controller = new AbortController();
    const ambil = (url: string | null) => url
      ? fetch(url, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Batas wilayah belum dapat dimuat.");
        return response.json() as Promise<{ features?: Array<{ properties?: Record<string, unknown>; geometry?: AreaGeometry }> }>;
      })
      : Promise.resolve({ features: [] });
    Promise.all([
      ambil(region.boundaries.lingkungan),
      ambil(region.boundaries.kelurahan),
      ambil(region.boundaries.kecamatan),
    ])
      .then(([rw, kel, kec]) => {
        const fields = region.boundaryFields;
        const teks = (properties: Record<string, unknown> | undefined, key: string | null) => (
          key && typeof properties?.[key] === "string" ? String(properties[key]).trim() : ""
        );
        const admin: AdminArea[] = [];
        for (const feature of rw.features ?? []) {
          const district = teks(feature.properties, fields.kecamatan);
          const village = teks(feature.properties, fields.kelurahan);
          const rwCode = teks(feature.properties, fields.lingkungan);
          if (!district || !village || !rwCode || !feature.geometry) continue;
          const rwNormal = rwCode.replace(/^0+/, "") || "0";
          admin.push({
            id: `${district.toLocaleLowerCase("id-ID")}|${village.toLocaleLowerCase("id-ID")}|${rwNormal}`,
            level: "RW",
            district: titleCase(district),
            village: titleCase(village),
            rw: rwNormal,
            geometry: feature.geometry,
          });
        }
        for (const feature of kel.features ?? []) {
          const district = teks(feature.properties, fields.kecamatan);
          const village = teks(feature.properties, fields.kelurahan);
          if (!district || !village || !feature.geometry) continue;
          admin.push({
            id: `kel|${district.toLocaleLowerCase("id-ID")}|${village.toLocaleLowerCase("id-ID")}`,
            level: "KELURAHAN",
            district: titleCase(district),
            village: titleCase(village),
            rw: null,
            geometry: feature.geometry,
          });
        }
        for (const feature of kec.features ?? []) {
          const district = teks(feature.properties, fields.kecamatan);
          if (!district || !feature.geometry) continue;
          admin.push({
            id: `kec|${district.toLocaleLowerCase("id-ID")}`,
            level: "KECAMATAN",
            district: titleCase(district),
            village: null,
            rw: null,
            geometry: feature.geometry,
          });
        }
        const opsi = admin
          .filter((area): area is AdminArea & { level: "RW"; village: string; rw: string } => area.level === "RW")
          .map((area) => ({
            id: area.id,
            district: area.district,
            village: area.village,
            rw: area.rw,
            geometry: area.geometry,
          }))
          .sort((a, b) => a.district.localeCompare(b.district, "id-ID")
            || a.village.localeCompare(b.village, "id-ID")
            || Number(a.rw) - Number(b.rw));
        setAdminAreas(admin);
        setAreas(opsi);
        if (initialPackage?.presisi_peta === "RW" && initialPackage.desa_resmi && initialPackage.kecamatan_resmi && initialPackage.rw) {
          const packageArea = opsi.find((area) => (
            area.district.toLocaleLowerCase("id-ID") === initialPackage.kecamatan_resmi?.toLocaleLowerCase("id-ID")
            && area.village.toLocaleLowerCase("id-ID") === initialPackage.desa_resmi?.toLocaleLowerCase("id-ID")
            && area.rw.replace(/^0+/, "") === initialPackage.rw?.replace(/^0+/, "")
          ));
          if (packageArea && !restoredDraftRef.current) {
            setAreaId(packageArea.id);
            setDistrictFilter(packageArea.district);
            setVillageFilter(packageArea.village);
            setLocationMode("AREA");
          }
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") setLocationMessage(error.message);
      });
    return () => controller.abort();
  }, [initialPackage, region.boundaries.kecamatan, region.boundaries.kelurahan, region.boundaries.lingkungan, region.boundaryFields]);

  const candidateAreaKey = candidateArea?.id ?? "";
  const candidateDistrict = candidateArea?.district ?? "";
  useEffect(() => {
    if (!candidateAreaKey || !candidateDistrict) return;

    const controller = new AbortController();
    fetchRoadPackages({ district: candidateDistrict, limit: 300 }, controller.signal)
      .then((data) => {
        setCandidates(data.items);
        setCandidateAreaId(candidateAreaKey);
        setCandidateError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setCandidateError({ areaId: candidateAreaKey, message: error.message });
        }
      });
    return () => controller.abort();
  }, [candidateAreaKey, candidateDistrict]);

  useEffect(() => {
    return () => {
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo?.previewUrl]);

  useEffect(() => {
    const node = rootRef.current;
    node?.setAttribute("data-report-ready", "true");
    return () => {
      node?.removeAttribute("data-report-ready");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listReportDrafts()
      .then((drafts) => {
        if (cancelled) return;
        const latest = drafts[0];
        if (!latest) return;
        const fresh = Date.now() - new Date(latest.updatedAt).getTime() <= DRAFT_TTL_MS;
        if (fresh && latest.state && latest.state.step < 3) setDraftCandidate(latest);
        else void deleteReportDraft(latest.id).catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDraftReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setSavedReceipt(readStoredReceipt()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftReady || step >= 3) return;
    const timer = window.setTimeout(() => {
      const hasContent = Boolean(photo || damageType || point || areaId || description.trim() || landmark.trim());
      if (!hasContent) {
        void deleteReportDraft(DRAFT_ID).catch(() => undefined);
        return;
      }
      const state: ReportDraftState = {
        step,
        photo: photo
          ? { blob: photo.file, name: photo.file.name, type: photo.file.type, width: photo.width, height: photo.height }
          : null,
        damageType,
        observedCauses,
        coarseSize,
        description,
        point: point ? { latitude: point.latitude, longitude: point.longitude } : null,
        accuracyM: point?.accuracyM ?? null,
        areaId,
        landmark,
        publicLocationConsent,
        locationMode,
        locationSource,
        road: selectedRoad,
        package: selectedPackage,
        packageSelectionSource,
      };
      void saveReportDraft({ id: DRAFT_ID, state }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    areaId,
    coarseSize,
    damageType,
    description,
    draftReady,
    landmark,
    locationMode,
    locationSource,
    observedCauses,
    packageSelectionSource,
    photo,
    point,
    publicLocationConsent,
    selectedPackage,
    selectedRoad,
    step,
  ]);

  function applyDraft(draft: ReportDraft) {
    const state = draft.state;
    if (!state) return;
    restoredDraftRef.current = true;
    setDraftCandidate(null);
    setPhotoError("");
    if (state.photo?.blob) {
      const file = new File([state.photo.blob], state.photo.name || "foto-kerusakan.webp", {
        type: state.photo.type || "image/webp",
        lastModified: Date.now(),
      });
      setPhoto({
        file,
        previewUrl: URL.createObjectURL(state.photo.blob),
        width: state.photo.width,
        height: state.photo.height,
      });
    } else {
      setPhoto(null);
    }
    setDamageType(state.damageType ?? "");
    setObservedCauses(Array.isArray(state.observedCauses) ? state.observedCauses : []);
    setCoarseSize(state.coarseSize ?? "");
    setDescription(state.description ?? "");
    setPoint(state.point ? { ...state.point, accuracyM: state.accuracyM ?? null } : null);
    setAreaId(state.areaId ?? "");
    setDistrictFilter("");
    setVillageFilter("");
    setLandmark(state.landmark ?? "");
    setPublicLocationConsent(state.publicLocationConsent ?? true);
    setLocationMode(state.locationMode === "AREA" ? "AREA" : "POINT");
    setLocationSource((state.locationSource as ReportLocationSourceState) ?? "MANUAL_AREA");
    setSelectedRoad(state.road ?? null);
    setSelectedPackage(state.package ?? null);
    setPackageSelectionSource(state.packageSelectionSource ?? null);
    setStep(Math.max(0, Math.min(2, state.step ?? 0)));
    setLocationMessage("");
  }

  function discardDraft() {
    setDraftCandidate(null);
    setDraftReady(true);
    void deleteReportDraft(DRAFT_ID).catch(() => undefined);
  }

  function resetFlow() {
    discardDraft();
    setStep(0);
    setPhoto(null);
    setPhotoError("");
    setDamageType("");
    setObservedCauses([]);
    setCoarseSize("");
    setDescription("");
    setPoint(null);
    setAreaId("");
    setLandmark("");
    setPublicLocationConsent(true);
    setLocationMode("POINT");
    setLocationSource("MANUAL_AREA");
    setLocationMessage("");
    setCandidateSearch("");
    setShowAllCandidates(false);
    setDistrictFilter("");
    setVillageFilter("");
    setPendingLocationMode(null);
    setSelectedRoad(null);
    setSelectedPackage(initialPackage);
    setPackageSelectionSource(initialPackage ? "PACKAGE_PAGE" : null);
    invalidateSubmissionKey();
  }

  async function copyReceipt(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const field = document.createElement("textarea");
      field.value = code;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setReceiptCopied(true);
    window.setTimeout(() => setReceiptCopied(false), 2500);
  }

  async function choosePhoto(file?: File) {
    setPhotoError("");
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const cleanPhoto = await localFileIntakeController.dispatch(file, reportPhotoPolicy, handleReportPhoto);
      setPhoto(cleanPhoto);
      setAdvanceError("");
      invalidateSubmissionKey();
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Foto tidak dapat diproses di perangkat ini.");
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Peramban ini tidak menyediakan akses lokasi.");
      return;
    }
    setLocating(true);
    setLocationMessage("Mengambil lokasi perangkat…");
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setPoint({ latitude, longitude, accuracyM: Number.isFinite(accuracy) ? accuracy : null });
      setLocationMode("POINT");
      setAreaId("");
      setLocationSource("DEVICE_GEOLOCATION");
      setLocationMessage("Titik dari GPS perangkat. Geser pin bila perlu dan pastikan titik sudah benar.");
      invalidateSubmissionKey();
      setLocating(false);
    }, (error) => {
      setLocationMessage(error.code === error.PERMISSION_DENIED
        ? "Izin lokasi tidak diberikan. Anda tetap dapat mencari alamat, menggeser pin, atau memilih kelurahan/RW secara manual."
        : "Lokasi belum dapat dibaca. Coba lagi, cari alamat, atau geser pin secara manual.");
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  function updatePoint(next: { latitude: number; longitude: number }, source: ReportLocationSourceState) {
    setPoint({ ...next, accuracyM: null });
    setLocationMode("POINT");
    setAreaId("");
    setLocationSource(source);
    invalidateSubmissionKey();
  }

  function chooseAddress(result: GeocodeResult) {
    updatePoint({ latitude: result.latitude, longitude: result.longitude }, "ADDRESS_GEOCODE");
    setLocationMessage(`Titik dari pencarian alamat: ${result.label}. Geser pin bila titik belum tepat.`);
  }

  function chooseRoad(segment: RoadSegment | null) {
    setSelectedRoad(segment);
    invalidateSubmissionKey();
  }

  function clearPoint() {
    setPoint(null);
    setAreaId("");
    setLocationSource("MANUAL_AREA");
    setLocationMessage("");
    invalidateSubmissionKey();
  }

  function applyLocationMode(next: ReportLocationMode) {
    setPendingLocationMode(null);
    setLocationMode(next);
    setLocationMessage("");
    if (next === "AREA") {
      clearPoint();
      setDistrictFilter(selectedArea?.district ?? districtFilter);
      setVillageFilter(selectedArea?.village ?? villageFilter);
    } else {
      setAreaId("");
      setDistrictFilter("");
      setVillageFilter("");
    }
  }

  function requestLocationMode(next: ReportLocationMode) {
    if (next === locationMode || pendingLocationMode) return;
    if (next === "AREA" && point) {
      setPendingLocationMode("AREA");
      return;
    }
    applyLocationMode(next);
  }

  function chooseDistrict(value: string) {
    setDistrictFilter(value);
    setVillageFilter("");
    setAreaId("");
    setLocationMessage("");
    invalidateSubmissionKey();
  }

  function chooseVillage(value: string) {
    setVillageFilter(value);
    setAreaId("");
    setLocationMessage("");
    invalidateSubmissionKey();
  }

  function chooseArea(value: string) {
    const nextArea = areas.find((area) => area.id === value) ?? null;
    setAreaId(value);
    if (nextArea) {
      setDistrictFilter(nextArea.district);
      setVillageFilter(nextArea.village);
    }
    setPoint(null);
    setLocationSource("MANUAL_AREA");
    setLocationMode("AREA");
    invalidateSubmissionKey();
    if (selectedPackage && nextArea && !packageMatchesArea(selectedPackage, nextArea)) {
      setSelectedPackage(null);
      setPackageSelectionSource(null);
      setLocationMessage("Paket rujukan dilepas karena wilayahnya berbeda dari lokasi laporan.");
    } else {
      setLocationMessage("");
    }
  }

  async function submitReport() {
    if (!photo || !damageType || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    const key = idempotencyKey.current ?? crypto.randomUUID();
    idempotencyKey.current = key;

    const body = new FormData();
    body.set("photo", photo.file, "report-photo.webp");
    body.set("damageType", DAMAGE_CODES[damageType as keyof typeof DAMAGE_CODES]);
    observedCauses.forEach((cause) => body.append("observedCauses", CAUSE_CODES[cause as keyof typeof CAUSE_CODES]));
    if (coarseSize) body.set("coarseSize", SIZE_CODES[coarseSize as keyof typeof SIZE_CODES]);
    if (description.trim()) body.set("description", description.trim());
    if (point) {
      body.set("latitude", String(point.latitude));
      body.set("longitude", String(point.longitude));
      if (point.accuracyM !== null) body.set("accuracyM", String(point.accuracyM));
      body.set("publicLocationConsent", publicLocationConsent ? "true" : "false");
      body.set("locationSource", locationSource === "DEVICE_RESOLVED_AREA" || locationSource === "MANUAL_AREA"
        ? "MAP_PIN"
        : locationSource);
    } else if (selectedArea) {
      body.set("areaKey", selectedArea.id);
      body.set("locationSource", locationSource === "DEVICE_GEOLOCATION" || locationSource === "MAP_PIN" || locationSource === "ADDRESS_GEOCODE"
        ? "MANUAL_AREA"
        : locationSource);
    }
    if (selectedRoad) body.set("roadSegmentId", selectedRoad.id);
    if (landmark.trim()) body.set("locationHint", landmark.trim());
    if (selectedPackage) {
      body.set("packageRup", selectedPackage.kode_rup);
      body.set("packageSelectionSource", packageSelectionSource ?? "CANDIDATE_LIST");
    }

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body,
        credentials: "same-origin",
      });
      let result: {
        data: { code: string; status: "SUBMITTED" } | null;
        error: { message: string; code: string } | null;
      };
      try {
        result = await response.json() as typeof result;
      } catch {
        setSubmitError("Respons layanan tidak dikenali. Coba lagi sebentar lagi; isian Anda tetap tersimpan.");
        return;
      }
      if (!response.ok || !result.data) {
        setSubmitError(describeSubmitFailure(response.status, result.error?.code ?? "", result.error?.message ?? ""));
        return;
      }
      const receipt: StoredReceipt = {
        code: result.data.code,
        savedAt: new Date().toISOString(),
        pointPublic: Boolean(point && publicLocationConsent),
        areaLabel: derivedArea
          ? areaLabelOf(derivedArea)
          : selectedArea
            ? `${selectedArea.village}, RW ${selectedArea.rw}`
            : "",
      };
      setReceiptCode(receipt.code);
      setSavedReceipt(receipt);
      writeStoredReceipt(receipt);
      void deleteReportDraft(DRAFT_ID).catch(() => undefined);
      setStep(3);
    } catch {
      setSubmitError("Koneksi terputus. Laporan belum terkirim — coba lagi; isian Anda tetap tersimpan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main ref={rootRef} className="min-h-[calc(100dvh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
          <div className="flex min-w-0 flex-col">
            <div className="order-1 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <div className="max-w-2xl">
                {simulationBadgeEnabled() ? (
                  <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-secondary-foreground">
                    <FiAlertTriangle aria-hidden="true" className="size-3.5" />
                    SIMULASI PROTOTIPE
                  </span>
                ) : null}
                <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
                  Laporkan kerusakan jalan
                </h1>
                <p className="mt-3 max-w-[62ch] text-sm leading-6 text-muted-foreground sm:text-base">
                  Tambahkan bukti kerusakan dan, jika dapat dipastikan, tautkan ke paket pekerjaan terkait.
                  Laporan masuk antrean tinjauan internal dan tidak langsung dipublikasikan.
                </p>
                {draftCandidate ? (
                  <div role="status" className="mt-4 border-l-4 border-secondary bg-secondary/20 px-3 py-3">
                    <p className="text-sm font-semibold text-foreground">Draf tersimpan di perangkat ini</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Terakhir diubah {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draftCandidate.updatedAt))}.
                      Draf disimpan tujuh hari dan dihapus setelah laporan terkirim.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => applyDraft(draftCandidate)} className="inline-flex min-h-10 items-center bg-primary px-3 text-sm font-bold text-white hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        Lanjutkan draf
                      </button>
                      <button type="button" onClick={resetFlow} className="inline-flex min-h-10 items-center border border-border bg-white px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        Mulai baru
                      </button>
                    </div>
                  </div>
                ) : null}
                {savedReceipt && step < 3 ? (
                  <div role="status" className="mt-4 border border-border bg-muted/40 px-3 py-3">
                    <p className="text-sm font-semibold text-foreground">Tanda terima terakhir tersimpan di perangkat ini</p>
                    <p className="mt-1 break-all font-mono text-sm font-bold text-foreground">{savedReceipt.code}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <button type="button" onClick={() => void copyReceipt(savedReceipt.code)} className="inline-flex min-h-10 items-center gap-2 border border-border bg-white px-3 font-semibold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {receiptCopied ? "Tersalin" : "Salin nomor"}
                      </button>
                      <Link href="/dashboard" className="font-semibold text-primary underline-offset-4 hover:underline">Laporan saya</Link>
                      <span className="text-muted-foreground">Disimpan {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(savedReceipt.savedAt))}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <nav aria-label="Tahap laporan" className="order-2 mt-6 border-b border-border py-3 sm:mt-8 sm:py-4">
              <ol className="grid grid-cols-4 gap-1.5 sm:gap-6">
                {STEPS.map((label, index) => {
                  const complete = index < step;
                  const active = index === step;
                  const shortLabel = label === "Kerusakan" ? "Rusak" : label === "Lokasi & paket" ? "Lokasi" : label;
                  return (
                    <li key={label} aria-current={active ? "step" : undefined} className="flex min-h-11 min-w-0 items-center gap-1.5 sm:gap-2.5">
                        <span className={`flex size-7 shrink-0 items-center justify-center border text-xs font-bold tabular-nums transition-colors ${active ? "border-primary bg-primary text-white" : complete ? "border-primary bg-white text-primary" : "border-border bg-white text-muted-foreground"}`}>
                          {complete ? <FiCheck aria-hidden="true" /> : `0${index + 1}`}
                        </span>
                        <span className={`min-w-0 text-[11px] font-semibold leading-4 sm:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>
                          <span className="sm:hidden">{shortLabel}</span>
                          <span className="hidden sm:inline">{label}</span>
                        </span>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="order-4 sticky bottom-0 z-30 -mx-4 mt-2 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-7 sm:px-7 lg:static lg:order-3 lg:mx-0 lg:mt-4 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
              <span aria-live="polite" className="sr-only">
                Langkah {step + 1} dari {STEPS.length}: {STEPS[step]}
              </span>
              {submitError && step === 2 ? (
                <p role="alert" className="border-l-4 border-destructive bg-destructive/10 px-3 py-2.5 text-sm leading-5 text-foreground">{submitError}</p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                {step === 0 || step === 3 ? (
                  <span aria-hidden="true" />
                ) : (
                  <button type="button" onClick={() => goToStep(step - 1)} className="inline-flex min-h-11 items-center justify-center gap-1 px-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-2 sm:px-3">
                    <FiArrowLeft aria-hidden="true" />
                    Kembali
                  </button>
                )}
                <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-4">
                  {step < STEPS.length - 1 && !canAdvance && requirementText ? (
                    <p id="advance-requirement" className="text-right text-[11px] leading-4 text-muted-foreground sm:text-xs">{requirementText}</p>
                  ) : <span id="advance-requirement" className="sr-only" />}
                  {step < STEPS.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleAdvance}
                      aria-describedby="advance-requirement"
                      disabled={isSubmitting}
                      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:gap-3 sm:px-5 ${canAdvance ? "bg-primary text-white hover:bg-[#004682]" : "bg-muted text-muted-foreground hover:bg-muted"}`}
                    >
                      {step === 2 ? isSubmitting ? "Mengirim…" : "Kirim laporan" : "Lanjut"} <FiArrowRight aria-hidden="true" />
                    </button>
                  ) : (
                    <Link href="/peta-pekerjaan" className="inline-flex min-h-11 items-center justify-center gap-3 bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      Kembali ke peta <FiArrowRight aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
              {advanceError ? <p role="alert" className="text-right text-xs font-semibold text-destructive">{advanceError}</p> : null}
            </div>

            <section aria-labelledby="step-heading" className="order-3 pt-5 sm:pt-7 lg:order-4">
              {step === 0 && (
                <>
                  <h2 ref={stepHeadingRef} tabIndex={-1} id="step-heading" className="scroll-mt-24 font-heading text-xl font-bold tracking-[-0.02em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-2xl">Foto kerusakan</h2>
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground">JPG, PNG, atau WebP · maksimal 10 MB</p>

                  {photo ? (
                    <div className="mt-5 grid gap-4 border border-border p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:p-4">
                      {/* Local object URL preview of the sanitised WebP uploaded on submit. */}
                      <Image src={photo.previewUrl} alt="Pratinjau foto kerusakan yang dipilih" width={360} height={144} unoptimized className="h-36 w-full bg-muted object-cover sm:h-32" />
                      <div className="flex min-w-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">Foto siap ditinjau</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(photo.file.size / (1024 * 1024)).toFixed(1)} MB · {photo.width} × {photo.height} px
                          </p>
                        </div>
                        <button type="button" onClick={() => { setPhoto(null); invalidateSubmissionKey(); }} aria-label="Hapus foto pilihan" className="flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                          <FiX aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-col items-center justify-center border border-dashed border-primary/45 bg-muted/25 px-5 py-8 text-center sm:min-h-[260px]">
                      <span className="flex size-12 items-center justify-center border border-border bg-white text-primary">
                        <FiCamera className="size-5" aria-hidden="true" />
                      </span>
                      <p className="mt-4 font-heading text-base font-bold text-foreground">Ambil atau pilih foto</p>
                      <p className="mt-1.5 max-w-md text-sm leading-5 text-muted-foreground">
                        Lokasi dan data kamera dihapus otomatis dari foto. Saat laporan dikirim, foto tersanitasi disimpan privat sebagai bukti laporan.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        <label htmlFor="report-photo-camera" className="inline-flex min-h-11 cursor-pointer items-center gap-2 bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-[#004682] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                          <FiCamera aria-hidden="true" />
                          Ambil foto
                        </label>
                        <label htmlFor="report-photo-gallery" className="inline-flex min-h-11 cursor-pointer items-center gap-2 border border-primary bg-white px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                          <FiImage aria-hidden="true" />
                          Pilih dari galeri
                        </label>
                        <input
                          id="report-photo-camera"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          disabled={isProcessingPhoto}
                          className="sr-only"
                          onChange={(event) => {
                            const input = event.currentTarget;
                            void choosePhoto(input.files?.[0]);
                            input.value = "";
                          }}
                          aria-describedby={`photo-help${photoError ? " photo-error" : ""}`}
                        />
                        <input
                          id="report-photo-gallery"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={isProcessingPhoto}
                          className="sr-only"
                          onChange={(event) => {
                            const input = event.currentTarget;
                            void choosePhoto(input.files?.[0]);
                            input.value = "";
                          }}
                          aria-describedby={`photo-help${photoError ? " photo-error" : ""}`}
                        />
                      </div>
                    </div>
                  )}
                  {isProcessingPhoto ? <p role="status" className="mt-3 text-sm font-semibold text-primary">Memproses foto…</p> : null}
                  <p id="photo-help" className="mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
                    Pastikan wajah dan pelat nomor tidak terlihat sebelum memilih foto.
                  </p>
                  {photoError && <p id="photo-error" role="alert" className="mt-1 text-sm font-semibold text-destructive">{photoError}</p>}
                </>
              )}

              {step === 1 && (
                <>
                  <h2 ref={stepHeadingRef} tabIndex={-1} id="step-heading" className="scroll-mt-24 font-heading text-xl font-bold tracking-[-0.02em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-2xl">Jenis kerusakan</h2>
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground">Pilih kondisi yang paling mendekati.</p>
                  <fieldset className="mt-5">
                    <legend className="sr-only">Pilih jenis kerusakan</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DAMAGE_TYPES.map((type) => (
                        <label key={type.label} className={`flex min-h-[76px] cursor-pointer items-start gap-3 border px-3 py-3 transition-colors focus-within:outline-2 focus-within:outline-primary ${damageType === type.label ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted/45"}`}>
                          <input type="radio" name="damage-type" value={type.label} checked={damageType === type.label} onChange={() => { setDamageType(type.label); setAdvanceError(""); invalidateSubmissionKey(); }} className="mt-0.5 size-4 shrink-0 accent-[#0058A3]" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold leading-5">{type.label}</span>
                            <span className={`mt-0.5 block text-xs leading-4 ${damageType === type.label ? "text-white/80" : "text-muted-foreground"}`}>{type.detail}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="mt-6">
                    <legend className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Penyebab terlihat <span className="font-normal normal-case tracking-normal">(opsional)</span></legend>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {CAUSE_OPTIONS.map((cause) => {
                        const checked = observedCauses.includes(cause);
                        return (
                          <label key={cause} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 border px-3 text-xs font-medium transition-colors focus-within:outline-2 focus-within:outline-primary ${checked ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted/45"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => { setObservedCauses((current) => checked ? current.filter((item) => item !== cause) : [...current, cause]); invalidateSubmissionKey(); }}
                              className="size-3.5 accent-[#0058A3]"
                            />
                            {cause}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="mt-6">
                    <legend className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Ukuran kasar <span className="font-normal normal-case tracking-normal">(opsional)</span></legend>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {SIZE_OPTIONS.map((size) => (
                        <label key={size} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 border px-3 text-xs font-medium transition-colors focus-within:outline-2 focus-within:outline-primary ${coarseSize === size ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted/45"}`}>
                          <input type="radio" name="coarse-size" value={size} checked={coarseSize === size} onChange={() => { setCoarseSize(size); invalidateSubmissionKey(); }} className="size-3.5 accent-[#0058A3]" />
                          {size}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label htmlFor="report-description" className="mt-6 block text-sm font-semibold text-foreground">Keterangan tambahan <span className="font-normal text-muted-foreground">(opsional)</span></label>
                  <textarea id="report-description" value={description} onChange={(event) => { setDescription(event.target.value); invalidateSubmissionKey(); }} rows={4} maxLength={500} placeholder="Contoh: kerusakan berada di dekat persimpangan…" className="mt-2 w-full resize-y border border-input bg-white px-3 py-2.5 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
                  <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{description.length}/500</p>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 ref={stepHeadingRef} tabIndex={-1} id="step-heading" className="scroll-mt-24 font-heading text-xl font-bold tracking-[-0.02em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-2xl">Lokasi dan paket terkait</h2>
                  <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">
                    Tentukan lokasi lebih dulu. Ruas jalan dan paket rujukan bersifat opsional dan tidak mengubah titik laporan.
                  </p>

                  <section aria-labelledby="report-location-heading" className="mt-5 border border-border">
                    <div className="border-b border-border bg-muted/30 px-3 py-3 sm:px-4">
                      <h3 id="report-location-heading" tabIndex={-1} className="font-heading text-base font-bold text-foreground outline-none">1. Lokasi laporan</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Pilih satu cara: titik presisi atau wilayah saja.</p>
                      <div role="group" aria-label="Model lokasi laporan" className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => requestLocationMode("POINT")}
                          aria-pressed={locationMode === "POINT"}
                          className={`inline-flex min-h-11 items-center border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${locationMode === "POINT" ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted"}`}
                        >
                          Titik presisi
                        </button>
                        <button
                          type="button"
                          onClick={() => requestLocationMode("AREA")}
                          aria-pressed={locationMode === "AREA"}
                          className={`inline-flex min-h-11 items-center border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${locationMode === "AREA" ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted"}`}
                        >
                          Wilayah saja
                        </button>
                      </div>
                      {pendingLocationMode === "AREA" ? (
                        <div role="alert" className="mt-3 border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                          <p className="text-xs leading-5 text-foreground">Pindah ke wilayah saja akan menghapus titik presisi yang sudah ditandai.</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={() => applyLocationMode("AREA")} className="inline-flex min-h-10 items-center bg-destructive px-3 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive">
                              Ya, hapus titik
                            </button>
                            <button type="button" onClick={() => setPendingLocationMode(null)} className="inline-flex min-h-10 items-center border border-border bg-white px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="p-3 sm:p-4">
                      {locationMode === "POINT" ? (
                        <>
                          <ReportLocationMap
                            region={region}
                            point={point}
                            onPointChange={(next) => updatePoint(next, "MAP_PIN")}
                            selectedRoad={selectedRoad ? {
                              id: selectedRoad.id,
                              name: selectedRoad.name,
                              geometry: selectedRoad.geometry as LineString | MultiLineString,
                            } : null}
                            focus={mapFocus}
                            label="Titik laporan warga, bukan lokasi paket. Geser pin untuk mengoreksi."
                            className="h-[360px] sm:h-[420px]"
                          />

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button type="button" onClick={useMyLocation} disabled={locating || adminAreas.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 border border-input bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                              <FiMapPin aria-hidden="true" />
                              {locating ? "Mengambil lokasi…" : "Gunakan lokasi saya"}
                            </button>
                            {point ? (
                              <button type="button" onClick={clearPoint} className="inline-flex min-h-11 items-center gap-2 border border-border bg-white px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                                <FiX aria-hidden="true" />
                                Hapus titik
                              </button>
                            ) : null}
                            <span className="text-[11px] leading-5 text-muted-foreground">
                              {point ? "Pin dapat digeser atau ditandai ulang." : "Belum ada titik. Pakai GPS, cari alamat, atau aktifkan Tandai titik."}
                            </span>
                          </div>

                          <div className="mt-4">
                            <AddressSearch regionId={region.id} onSelect={chooseAddress} />
                          </div>

                          {point ? (
                            <div className="mt-4 border border-border bg-muted/30 p-3">
                              <label className="flex items-start gap-3 text-sm leading-5 text-foreground">
                                <input
                                  type="checkbox"
                                  checked={publicLocationConsent}
                                  onChange={(event) => { setPublicLocationConsent(event.target.checked); invalidateSubmissionKey(); }}
                                  className="mt-1 size-4 shrink-0 accent-[#0058A3]"
                                />
                                <span>
                                  <span className="block font-semibold">Tampilkan titik ini di halaman publik</span>
                                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                                    Titik presisi dapat menunjukkan lokasi rumah atau tempat kerja Anda. Jika dimatikan, titik tetap disimpan untuk staf berizin, tetapi tidak tampil di halaman publik.
                                  </span>
                                </span>
                              </label>
                            </div>
                          ) : null}

                          {pointOutsideRegion ? (
                            <p role="alert" className="mt-3 border-l-4 border-destructive bg-destructive/10 px-3 py-2.5 text-xs leading-5 text-foreground">
                              Titik berada di luar Kota Tangerang. Laporan tidak dapat dikirim sampai pin dipindahkan ke dalam wilayah kerja.
                            </p>
                          ) : displayLocationMessage ? (
                            <p role="status" className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">{displayLocationMessage}</p>
                          ) : !point ? (
                            <p className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">
                              Titik belum ada. Gunakan lokasi perangkat, cari alamat, atau aktifkan mode Tandai titik di peta.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <label htmlFor="report-district" className="block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Kecamatan</label>
                              <select
                                id="report-district"
                                value={currentDistrict}
                                onChange={(event) => chooseDistrict(event.target.value)}
                                className="mt-1.5 min-h-11 w-full border border-input bg-white px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                              >
                                <option value="">Pilih kecamatan…</option>
                                {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="report-village" className="block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Kelurahan</label>
                              <select
                                id="report-village"
                                value={currentVillage}
                                onChange={(event) => chooseVillage(event.target.value)}
                                disabled={!currentDistrict}
                                className="mt-1.5 min-h-11 w-full border border-input bg-white px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                              >
                                <option value="">{currentDistrict ? "Pilih kelurahan…" : "Pilih kecamatan dulu"}</option>
                                {villageOptions.map((village) => <option key={village} value={village}>{village}</option>)}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="report-rw" className="block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">RW</label>
                              <select
                                id="report-rw"
                                value={areaId}
                                onChange={(event) => chooseArea(event.target.value)}
                                disabled={!currentVillage}
                                className="mt-1.5 min-h-11 w-full border border-input bg-white px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                              >
                                <option value="">{currentVillage ? "Pilih RW…" : "Pilih kelurahan dulu"}</option>
                                {rwOptions.map((area) => <option key={area.id} value={area.id}>RW {area.rw}</option>)}
                              </select>
                            </div>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            Tanpa titik, wilayah dipilih bertingkat. Tiga pilihan ini cukup untuk menentukan RW.
                          </p>
                          {selectedArea ? (
                            <p role="status" className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">
                              Wilayah laporan: {selectedArea.village}, RW {selectedArea.rw}, Kecamatan {selectedArea.district}.
                            </p>
                          ) : displayLocationMessage ? (
                            <p role="status" className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">{displayLocationMessage}</p>
                          ) : !selectedPackage ? (
                            <p className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">
                              Pilih kecamatan, kelurahan, lalu RW. Laporan tetap dapat dikirim tanpa titik presisi.
                            </p>
                          ) : null}
                        </>
                      )}

                      <label htmlFor="report-landmark" className="mt-4 block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Patokan lokasi (opsional) — nama jalan, kampung, RT/RW</label>
                      <input id="report-landmark" value={landmark} onChange={(event) => { setLandmark(event.target.value); invalidateSubmissionKey(); }} maxLength={180} placeholder="Contoh: Jl. Arjuna III, Bumi Asri RT 04/16" className="mt-1.5 min-h-11 w-full border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Dipakai untuk membandingkan nama lokasi paket; disimpan privat dan tidak ditampilkan publik.</p>
                    </div>
                  </section>

                  {region.roadLayer ? (
                    <details className="mt-5 border border-border">
                      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 bg-muted/20 px-3 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4">
                        <span>2. Ruas jalan (opsional)</span>
                        <span className="text-[11px] font-normal text-muted-foreground">{selectedRoad ? selectedRoad.name ?? "Ruas tanpa nama" : "Buka"}</span>
                      </summary>
                      <div className="border-t border-border p-3 sm:p-4">
                        <RoadSearch regionId={region.id} selected={selectedRoad} onSelect={chooseRoad} />
                      </div>
                    </details>
                  ) : null}

                  <details className="mt-4 border border-border">
                    <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 bg-muted/20 px-3 text-sm font-bold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4">
                      <span>3. Paket rujukan (opsional)</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{selectedPackage ? `Nomor paket RUP ${selectedPackage.kode_rup}` : "Buka"}</span>
                    </summary>
                    <div className="border-t border-border p-3 sm:p-4">
                      <p className="text-xs leading-5 text-muted-foreground">
                        Tautan paket hanya rujukan untuk ditinjau, bukan bukti bahwa paket menyebabkan kerusakan.
                      </p>

                      {packageSelectionSource === "PACKAGE_PAGE" && selectedPackage ? (
                        <div className="mt-3 flex items-start justify-between gap-4 border-l-4 border-secondary bg-secondary/20 px-3 py-2.5">
                          <p className="min-w-0 text-xs leading-5 text-foreground">
                            <span className="block font-bold">Paket rujukan dari peta · Nomor paket RUP {selectedPackage.kode_rup}</span>
                            <span className="mt-0.5 block">{selectedPackage.nama}</span>
                          </p>
                          <button type="button" onClick={() => { setSelectedPackage(null); setPackageSelectionSource(null); invalidateSubmissionKey(); }} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-primary transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-primary">Batalkan tautan</button>
                        </div>
                      ) : null}

                      {candidateArea ? (
                        <div className="mt-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <h4 className="font-heading text-base font-bold text-foreground">Paket yang mungkin terkait</h4>
                            {!candidatesLoading && !currentCandidateError && <span className="text-xs font-medium text-muted-foreground">{visibleCandidates.length} paket ditemukan</span>}
                          </div>
                          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                            {derivedArea?.level === "KECAMATAN"
                              ? `Titik hanya dapat diturunkan sampai Kecamatan ${derivedArea.district}; kandidat paket memakai cakupan kecamatan.`
                              : derivedArea?.level === "KELURAHAN"
                                ? `Lokasi memakai Kelurahan ${derivedArea.village}, Kecamatan ${derivedArea.district}; paket yang lebih umum tidak dianggap sebagai titik kerusakan.`
                                : `Lokasi laporan memakai ${candidateArea.rw ? `RW ${candidateArea.rw} di ${candidateArea.village}` : candidateArea.village}; titik paket yang lebih umum tidak dianggap sebagai titik kerusakan.`}
                          </p>

                          {!candidatesLoading && !currentCandidateError && rankedCandidates.length > 0 && (
                            <label className="relative mt-3 block max-w-sm">
                              <span className="sr-only">Cari nama paket atau nomor paket RUP</span>
                              <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Cari nama paket atau nomor RUP" className="min-h-11 w-full border border-input bg-white pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
                            </label>
                          )}

                          {candidatesLoading && <p className="mt-4 text-sm text-muted-foreground">Memuat paket wilayah…</p>}
                          {currentCandidateError && <p role="alert" className="mt-4 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{currentCandidateError}</p>}
                          {!candidatesLoading && !currentCandidateError && rankedCandidates.length > 0 && candidateArea.rw && !rankedCandidates.some((item) => candidateOrder(item, candidateArea, landmark) === 0) && (
                            <p className="mt-3 border border-[#E6A49D] bg-[#FCEBE8] px-3 py-2.5 text-xs leading-5 text-foreground"><strong className="block">Belum ada paket yang menyebut RW ini</strong>Paket di bawah berasal dari wilayah yang lebih luas atau nama lokasi yang mirip. Periksa detailnya sebelum memilih; laporan tetap dapat dibuat tanpa tautan paket.</p>
                          )}
                          {!candidatesLoading && !currentCandidateError && rankedCandidates.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Belum ada paket jalan tercatat untuk wilayah ini. Laporan tetap dapat dibuat tanpa tautan paket.</p>}
                          {!candidatesLoading && !currentCandidateError && rankedCandidates.length > 0 && visibleCandidates.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Tidak ada paket yang cocok dengan pencarian.</p>}
                          {!candidatesLoading && !currentCandidateError && visibleCandidates.length > 0 && (
                            <div className="mt-3">
                              <ul className="grid gap-2.5">
                                {displayedCandidates.map((item) => {
                                  const matchOrder = candidateOrder(item, candidateArea, landmark);
                                  const active = selectedPackage?.kode_rup === item.kode_rup;
                                  return (
                                    <li key={item.kode_rup} className={`border transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
                                      <div className="flex items-stretch">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (active) return;
                                            setSelectedPackage(item);
                                            setPackageSelectionSource("CANDIDATE_LIST");
                                            invalidateSubmissionKey();
                                          }}
                                          aria-pressed={active}
                                          className="min-w-0 flex-1 p-3 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary"
                                        >
                                          <span className="block text-sm font-semibold leading-5 text-foreground">{item.nama}</span>
                                          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{formatBudget(item.pagu)} · {item.bulan ?? "jadwal belum tersedia"} · {item.presisi_peta}</span>
                                          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">Nomor paket RUP {item.kode_rup}</span>
                                          {matchOrder >= 2 && <span className="mt-2 block text-[10px] text-muted-foreground">Wilayah paket lebih luas; periksa detail sebelum ditautkan.</span>}
                                        </button>
                                        <div className="flex shrink-0 items-center border-l border-border px-2">
                                          {active ? (
                                            <button type="button" onClick={() => { setSelectedPackage(null); setPackageSelectionSource(null); invalidateSubmissionKey(); }} className="min-h-11 px-2 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-primary">
                                              Batalkan tautan
                                            </button>
                                          ) : (
                                            <span aria-hidden="true" className="px-2 text-xs font-bold text-primary">Tautkan</span>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                              {!normalizedCandidateSearch && visibleCandidates.length > 5 ? (
                                <button
                                  type="button"
                                  onClick={() => setShowAllCandidates((current) => !current)}
                                  className="mt-3 inline-flex min-h-11 items-center border border-border bg-white px-3 text-xs font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                  {showAllCandidates ? "Ringkas ke 5 teratas" : `Lihat semua (${visibleCandidates.length} paket)`}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">
                          Pilih titik atau wilayah dulu untuk melihat paket yang mungkin terkait. Paket rujukan dari halaman paket tetap dapat dipakai.
                        </p>
                      )}
                    </div>
                  </details>

                  {roadWarning ? (
                    <p className="mt-4 border border-[#E6C84D] bg-[#FFF8DB] px-3 py-2.5 text-xs leading-5 text-foreground">
                      <strong className="block">Ruas tidak beririsan dengan titik</strong>
                      Ruas tetap boleh dikirim sebagai anotasi, tetapi periksa kembali apakah ruas yang dipilih sudah benar.
                    </p>
                  ) : null}

                  <p className="mt-5 border-l-4 border-primary bg-muted/40 px-3 py-2.5 text-xs leading-5 text-foreground">
                    <strong className="font-semibold">Sebelum kirim: </strong>{consentSummary}
                  </p>
                </>
              )}

              {step === 3 && (
                <div className="flex min-h-[360px] flex-col items-center justify-center bg-muted/35 px-5 py-12 text-center sm:min-h-[420px]">
                  <span className="flex size-16 items-center justify-center bg-primary text-white">
                    <FiCheckCircle aria-hidden="true" className="size-8" />
                  </span>
                  <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">04 · Sukses</p>
                  <h2 ref={stepHeadingRef} tabIndex={-1} id="step-heading" className="mt-2 scroll-mt-24 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-3xl">Laporan berhasil dikirim</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    Diterima. Laporan ditinjau manual sebelum tampil publik; foto tidak pernah ditampilkan.
                  </p>
                  <div className="mt-5 w-full max-w-lg border border-border bg-white p-4 text-left">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Nomor tanda terima</p>
                    <p className="mt-1 break-all font-mono text-lg font-bold text-foreground">{receiptCode}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void copyReceipt(receiptCode)} className="inline-flex min-h-11 items-center gap-2 bg-primary px-3 text-sm font-bold text-white hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {receiptCopied ? "Tersalin" : "Salin nomor"}
                      </button>
                      <Link href="/dashboard" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">Laporan saya</Link>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Nomor ini disimpan di perangkat ini selama 30 hari. Untuk laporan anonim, nomor adalah satu-satunya rujukan sampai ada pencarian berbasis kode.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-foreground">
                      {(savedReceipt?.pointPublic ?? Boolean(point && publicLocationConsent))
                        ? "Titik presisi tampil di halaman publik setelah laporan disetujui."
                        : "Titik presisi tidak ditampilkan di halaman publik; staf berizin tetap dapat melihatnya."}
                    </p>
                  </div>
                  <ol className="mt-5 grid w-full max-w-lg gap-1 text-left text-xs leading-5 text-muted-foreground">
                    <li><strong className="text-foreground">1. Diterima</strong> — laporan masuk antrean tinjauan internal.</li>
                    <li><strong className="text-foreground">2. Ditinjau</strong> — staf memeriksa foto dan lokasi; foto tetap privat.</li>
                    <li><strong className="text-foreground">3. Tampil publik</strong> — hanya jika disetujui; titik mengikuti pilihan Anda.</li>
                  </ol>
                  <p className="mt-4 max-w-lg text-xs leading-5 text-muted-foreground">
                    Rujukan paket, bila dipilih, hanya mencatat pilihan Anda dan bukan bukti bahwa paket menyebabkan kerusakan.
                  </p>
                </div>
              )}
            </section>

          </div>

          <aside aria-labelledby="summary-heading" className="border border-border bg-white p-4 sm:p-5 lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <h2 id="summary-heading" className="font-heading text-base font-bold text-foreground">Ringkasan laporan</h2>
            </div>
            <dl className="pt-2">
              <SummaryRow label="Foto" value={photo ? "1 foto siap" : "Belum dipilih"} pending={!photo} />
              <SummaryRow label="Kerusakan" value={damageType || "Belum dipilih"} pending={!damageType} />
              <SummaryRow
                label="Lokasi"
                value={derivedArea ? areaLabelOf(derivedArea) : selectedArea ? `${selectedArea.village} RW ${selectedArea.rw}` : point ? "Titik ditandai" : "Belum dipilih"}
                pending={!derivedArea && !selectedArea && !point}
              />
              <SummaryRow label="Penyebab" value={observedCauses.length ? observedCauses.join(", ") : "—"} />
              <SummaryRow label="Ukuran" value={coarseSize || "—"} />
              <SummaryRow label="Ruas" value={selectedRoad ? selectedRoad.name ?? "Ruas tanpa nama" : "—"} />
              <SummaryRow label="Patokan" value={landmark || "—"} />
              <SummaryRow label="Paket" value={selectedPackage ? `Nomor paket RUP ${selectedPackage.kode_rup}` : "—"} />
              <SummaryRow label="Titik publik" value={point ? (publicLocationConsent ? "Tampil publik" : "Disembunyikan") : "Tidak berlaku"} />
            </dl>
            <p className="mt-3 bg-muted/50 p-3 text-xs leading-5 text-foreground">{consentSummary}</p>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-2.5 text-sm">
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium leading-5 text-foreground">
        {pending ? <><span aria-hidden="true" className="inline-block h-1 w-9 align-middle bg-border" /><span className="sr-only">{value}</span></> : value}
      </dd>
    </div>
  );
}
