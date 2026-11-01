"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchRoadPackages } from "@/features/map/package-api";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { FiArrowLeft, FiArrowRight, FiCamera, FiCheck, FiCheckCircle, FiImage, FiMapPin, FiSearch, FiX } from "react-icons/fi";

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

type LocalPhoto = { file: File; previewUrl: string };
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

export default function ReportPrototype({ initialPackage = null }: { initialPackage?: RoadPackageItem | null }) {
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [damageType, setDamageType] = useState<string>("");
  const [observedCauses, setObservedCauses] = useState<string[]>([]);
  const [coarseSize, setCoarseSize] = useState<string>("");
  const [description, setDescription] = useState("");
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [areaId, setAreaId] = useState("");
  const [landmark, setLandmark] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [candidates, setCandidates] = useState<RoadPackageItem[]>([]);
  const [candidateAreaId, setCandidateAreaId] = useState("");
  const [candidateError, setCandidateError] = useState<{ areaId: string; message: string } | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<RoadPackageItem | null>(initialPackage);
  const selectedArea = areas.find((area) => area.id === areaId) ?? null;
  const canAdvance = step === 0 ? photo !== null : step === 1 ? damageType.length > 0 : step === 2 ? selectedArea !== null || selectedPackage !== null : false;
  const currentCandidateError = selectedArea && candidateError?.areaId === selectedArea.id ? candidateError.message : "";
  const candidatesLoading = Boolean(selectedArea && !currentCandidateError && candidateAreaId !== selectedArea.id);
  const rankedCandidates = selectedArea && candidateAreaId === selectedArea.id
    ? [...candidates].sort((a, b) => candidateOrder(a, selectedArea, landmark) - candidateOrder(b, selectedArea, landmark))
    : [];
  const normalizedCandidateSearch = candidateSearch.trim().toLocaleLowerCase("id-ID");
  const visibleCandidates = normalizedCandidateSearch
    ? rankedCandidates.filter((item) => `${item.nama} ${item.kode_rup}`.toLocaleLowerCase("id-ID").includes(normalizedCandidateSearch))
    : rankedCandidates;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/rw.geojson", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Daftar desa dan RW belum dapat dimuat.");
        return response.json();
      })
      .then((geojson: { features?: Array<{ properties?: { wadmkc?: string; wadmkd?: string; rw?: string }; geometry?: AreaGeometry }> }) => {
        const options = (geojson.features ?? []).flatMap((feature) => {
          const district = feature.properties?.wadmkc?.trim();
          const village = feature.properties?.wadmkd?.trim();
          const rw = feature.properties?.rw?.trim();
          if (!district || !village || !rw || !feature.geometry) return [];
          return [{
            id: `${district.toLocaleLowerCase("id-ID")}|${village.toLocaleLowerCase("id-ID")}|${rw}`,
            district: titleCase(district),
            village: titleCase(village),
            rw: rw.replace(/^0+/, "") || "0",
            geometry: feature.geometry,
          }];
        }).sort((a, b) => a.district.localeCompare(b.district, "id-ID")
          || a.village.localeCompare(b.village, "id-ID")
          || Number(a.rw) - Number(b.rw));
        setAreas(options);
        if (initialPackage?.presisi_peta === "RW" && initialPackage.desa_resmi && initialPackage.kecamatan_resmi && initialPackage.rw) {
          const packageArea = options.find((area) => (
            area.district.toLocaleLowerCase("id-ID") === initialPackage.kecamatan_resmi?.toLocaleLowerCase("id-ID")
            && area.village.toLocaleLowerCase("id-ID") === initialPackage.desa_resmi?.toLocaleLowerCase("id-ID")
            && area.rw.replace(/^0+/, "") === initialPackage.rw?.replace(/^0+/, "")
          ));
          if (packageArea) setAreaId(packageArea.id);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") setLocationMessage(error.message);
      });
    return () => controller.abort();
  }, [initialPackage]);

  useEffect(() => {
    if (!selectedArea) return;

    const controller = new AbortController();
    fetchRoadPackages({ district: selectedArea.district }, controller.signal)
      .then((data) => {
        setCandidates(data.items);
        setCandidateAreaId(selectedArea.id);
        setCandidateError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setCandidateError({ areaId: selectedArea.id, message: error.message });
        }
      });
    return () => controller.abort();
  }, [selectedArea]);

  useEffect(() => {
    return () => {
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo?.previewUrl]);

  function choosePhoto(file?: File) {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Pilih file gambar seperti JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("Ukuran foto maksimal 10 MB.");
      return;
    }
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Peramban ini tidak menyediakan akses lokasi.");
      return;
    }
    setLocating(true);
    setLocationMessage("Mencari RW dari lokasi perangkat…");
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      const match = areas.find((area) => containsPoint(area.geometry, longitude, latitude));
      if (match) {
        if (selectedPackage && !packageMatchesArea(selectedPackage, match)) {
          setSelectedPackage(null);
          setLocationMessage("Paket rujukan dilepas karena wilayahnya berbeda dari lokasi perangkat.");
        } else {
          setLocationMessage(`Lokasi berada di ${match.village}, RW ${match.rw}, Kecamatan ${match.district}.`);
        }
        setAreaId(match.id);
      } else {
        setAreaId("");
        setSelectedPackage(null);
        setLocationMessage("Lokasi berada di luar batas RW pada data peta. Pilih desa/RW secara manual.");
      }
      setLocating(false);
    }, (error) => {
      setLocationMessage(error.code === error.PERMISSION_DENIED
        ? "Izin lokasi tidak diberikan. Anda tetap dapat memilih desa/RW secara manual."
        : "Lokasi belum dapat dibaca. Coba lagi atau pilih desa/RW secara manual.");
      setLocating(false);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-background">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
              <div className="max-w-2xl">
                <h1 className="font-heading text-3xl font-bold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
                  Laporkan kerusakan jalan
                </h1>
                <p className="mt-3 max-w-[62ch] text-sm leading-6 text-muted-foreground sm:text-base">
                  Tambahkan bukti kerusakan dan, jika dapat dipastikan, tautkan ke paket pekerjaan terkait.
                </p>
              </div>
              <Link href="/project" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <FiArrowLeft aria-hidden="true" />
                Kembali ke peta
              </Link>
            </div>

            <nav aria-label="Tahap laporan" className="mt-8 border-b border-border py-4">
              <ol className="grid grid-cols-4 gap-2 sm:gap-6">
                {STEPS.map((label, index) => {
                  const complete = index < step;
                  const active = index === step;
                  return (
                    <li key={label} aria-current={active ? "step" : undefined} className="flex min-h-11 items-center gap-2.5">
                        <span className={`flex size-7 shrink-0 items-center justify-center border text-xs font-bold tabular-nums transition-colors ${active ? "border-primary bg-primary text-white" : complete ? "border-primary bg-white text-primary" : "border-border bg-white text-muted-foreground"}`}>
                          {complete ? <FiCheck aria-hidden="true" /> : `0${index + 1}`}
                        </span>
                        <span className={`text-xs font-semibold leading-4 sm:text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>
                          {label}
                        </span>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="group relative inline-flex" tabIndex={step === 3 ? 0 : undefined} aria-describedby={step === 3 ? "back-locked-tip" : undefined}>
                <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || step === 3} className="inline-flex min-h-11 items-center justify-center gap-1 px-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-3">
                  <FiArrowLeft aria-hidden="true" />
                  Kembali
                </button>
                {step === 3 && <span id="back-locked-tip" role="tooltip" className="pointer-events-none invisible absolute bottom-full left-0 z-20 mb-2 w-64 bg-foreground px-3 py-2 text-xs leading-5 text-white opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100">Laporan sudah disiapkan. Mockup ini belum disubmit.</span>}
              </span>
              <div className="flex items-center justify-end gap-2 sm:gap-4">
                <span className="whitespace-nowrap text-xs text-muted-foreground">Langkah {step + 1} dari {STEPS.length}</span>
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} aria-describedby="advance-requirement" disabled={!canAdvance} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-primary px-3 text-sm font-bold text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground sm:gap-3 sm:px-5">
                    Lanjut <FiArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <Link href="/project" className="inline-flex min-h-11 items-center justify-center gap-3 bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    Kembali ke peta <FiArrowRight aria-hidden="true" />
                  </Link>
                )}
              </div>
              <span id="advance-requirement" className="sr-only">
                {step === 0 ? "Pilih foto untuk membuka langkah berikutnya." : step === 1 ? "Pilih jenis kerusakan untuk membuka langkah berikutnya." : selectedArea || selectedPackage ? "Lanjut ke konfirmasi." : "Pilih desa/RW, gunakan lokasi saya, atau buka laporan dari paket rujukan untuk melanjutkan."}
              </span>
            </div>

            <section aria-labelledby="step-heading" className="pt-7 sm:pt-8">
              {step === 0 && (
                <>
                  <h2 id="step-heading" className="font-heading text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">Foto kerusakan</h2>
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground">JPG, PNG, atau WebP · maksimal 10 MB</p>

                  {photo ? (
                    <div className="mt-5 grid gap-4 border border-border p-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:p-4">
                      {/* Local object URL preview; no file is uploaded or persisted. */}
                      <Image src={photo.previewUrl} alt="Pratinjau foto kerusakan yang dipilih" width={360} height={144} unoptimized className="h-36 w-full bg-muted object-cover sm:h-32" />
                      <div className="flex min-w-0 items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{photo.file.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{(photo.file.size / (1024 * 1024)).toFixed(1)} MB · hanya dipratinjau di halaman ini</p>
                        </div>
                        <button type="button" onClick={() => setPhoto(null)} aria-label="Hapus foto pilihan" className="flex size-11 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                          <FiX aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="report-photo" className="group mt-5 flex min-h-[220px] cursor-pointer flex-col items-center justify-center border border-dashed border-primary/45 bg-muted/25 px-5 py-8 text-center transition-colors hover:bg-muted/60 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary sm:min-h-[260px]">
                      <span className="flex size-12 items-center justify-center border border-border bg-white text-primary">
                        <FiCamera className="size-5" aria-hidden="true" />
                      </span>
                      <span className="mt-4 font-heading text-base font-bold text-foreground">Ambil atau pilih foto</span>
                      <span className="mt-1.5 max-w-md text-sm leading-5 text-muted-foreground">Pratinjau foto muncul di sini. File tidak diunggah atau disimpan dalam simulasi ini.</span>
                      <span className="mt-4 inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-sm font-bold text-white transition-colors group-hover:bg-[#004682]">
                        <FiImage aria-hidden="true" />
                        Pilih foto
                      </span>
                      <input
                        id="report-photo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="sr-only"
                        onChange={(event) => choosePhoto(event.currentTarget.files?.[0])}
                        aria-describedby="photo-help photo-error"
                      />
                    </label>
                  )}
                  <p id="photo-help" className="mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
                    Pastikan wajah dan pelat nomor tidak terlihat sebelum memilih foto.
                  </p>
                  {photoError && <p id="photo-error" role="alert" className="mt-1 text-sm font-semibold text-destructive">{photoError}</p>}
                </>
              )}

              {step === 1 && (
                <>
                  <h2 id="step-heading" className="font-heading text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">Jenis kerusakan</h2>
                  <p className="mt-1.5 text-sm leading-5 text-muted-foreground">Pilih kondisi yang paling mendekati.</p>
                  <fieldset className="mt-5">
                    <legend className="sr-only">Pilih jenis kerusakan</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {DAMAGE_TYPES.map((type) => (
                        <label key={type.label} className={`flex min-h-[76px] cursor-pointer items-start gap-3 border px-3 py-3 transition-colors focus-within:outline-2 focus-within:outline-primary ${damageType === type.label ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground hover:bg-muted/45"}`}>
                          <input type="radio" name="damage-type" value={type.label} checked={damageType === type.label} onChange={() => setDamageType(type.label)} className="mt-0.5 size-4 shrink-0 accent-[#0058A3]" />
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
                              onChange={() => setObservedCauses((current) => checked ? current.filter((item) => item !== cause) : [...current, cause])}
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
                          <input type="radio" name="coarse-size" value={size} checked={coarseSize === size} onChange={() => setCoarseSize(size)} className="size-3.5 accent-[#0058A3]" />
                          {size}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label htmlFor="report-description" className="mt-6 block text-sm font-semibold text-foreground">Keterangan tambahan <span className="font-normal text-muted-foreground">(opsional)</span></label>
                  <textarea id="report-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={500} placeholder="Contoh: kerusakan berada di dekat persimpangan…" className="mt-2 w-full resize-y border border-input bg-white px-3 py-2.5 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
                  <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{description.length}/500</p>
                </>
              )}

              {step === 2 && (
                <>
                  <h2 id="step-heading" className="font-heading text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">Lokasi dan paket terkait</h2>
                  <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">Pilih wilayah laporan untuk melihat paket yang tercatat di kecamatan tersebut.</p>

                  {initialPackage && selectedPackage && (
                    <div className="mt-4 flex items-start justify-between gap-4 border-l-4 border-secondary bg-secondary/20 px-3 py-2.5">
                      <p className="min-w-0 text-xs leading-5 text-foreground">
                        <span className="block font-bold">Paket rujukan dari peta · RUP {selectedPackage.kode_rup}</span>
                        <span className="mt-0.5 block">{selectedPackage.nama}</span>
                      </p>
                      <button type="button" onClick={() => setSelectedPackage(null)} className="min-h-8 shrink-0 px-2 text-xs font-semibold text-primary transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-primary">Hapus tautan</button>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <label htmlFor="report-area" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Desa / kelurahan / RW</label>
                      <select id="report-area" value={areaId} onChange={(event) => {
                        const nextArea = areas.find((area) => area.id === event.target.value) ?? null;
                        setAreaId(event.target.value);
                        if (selectedPackage && nextArea && !packageMatchesArea(selectedPackage, nextArea)) {
                          setSelectedPackage(null);
                          setLocationMessage("Paket rujukan dilepas karena wilayahnya berbeda dari lokasi laporan.");
                        } else {
                          setLocationMessage("");
                        }
                      }} className="mt-1.5 min-h-10 w-full border border-input bg-white px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
                        <option value="">Pilih kelurahan/RW…</option>
                        {areas.map((area) => <option key={area.id} value={area.id}>{area.village} RW {area.rw} — {area.district}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={useMyLocation} disabled={locating || areas.length === 0} className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 border border-input bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                      <FiMapPin aria-hidden="true" />
                      {locating ? "Mencari lokasi…" : "Gunakan lokasi saya"}
                    </button>
                  </div>
                  <label htmlFor="report-landmark" className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Patokan lokasi (opsional) — nama jalan, kampung, RT/RW</label>
                  <input id="report-landmark" value={landmark} onChange={(event) => setLandmark(event.target.value)} maxLength={180} placeholder="Contoh: Jl. Arjuna III, Bumi Asri RT 04/16" className="mt-1.5 min-h-10 w-full border border-input bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Dipakai untuk membandingkan nama lokasi paket; tidak diunggah.</p>

                  {locationMessage && <p role="status" className="mt-3 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">{locationMessage}</p>}
                  {!selectedArea && !locationMessage && <p className="mt-4 bg-muted/70 px-3 py-2.5 text-xs leading-5 text-foreground">{selectedPackage ? "Belum ada area laporan. Paket rujukan tetap dapat digunakan; pilih wilayah untuk melihat kandidat paket." : "Pilih kelurahan/RW atau gunakan lokasi saya untuk melihat kandidat paket."}</p>}

                  {selectedArea && (
                    <div className="mt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3 className="font-heading text-base font-bold text-foreground">Kandidat paket di kecamatan</h3>
                        {!candidatesLoading && !currentCandidateError && <span className="text-xs font-medium text-muted-foreground">{visibleCandidates.length} paket ditemukan</span>}
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Lokasi laporan memakai batas RW {selectedArea.rw} di {selectedArea.village}; titik paket yang lebih umum tidak dianggap sebagai titik kerusakan.</p>

                      {!candidatesLoading && !currentCandidateError && rankedCandidates.length > 0 && (
                        <label className="relative mt-3 block max-w-sm">
                          <span className="sr-only">Cari nama paket atau nomor RUP</span>
                          <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Cari nama paket atau RUP" className="min-h-9 w-full border border-input bg-white pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary" />
                        </label>
                      )}

                      {candidatesLoading && <p className="mt-4 text-sm text-muted-foreground">Memuat paket wilayah…</p>}
                      {currentCandidateError && <p role="alert" className="mt-4 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{currentCandidateError}</p>}
                      {!candidatesLoading && !currentCandidateError && rankedCandidates.length > 0 && !rankedCandidates.some((item) => candidateOrder(item, selectedArea, landmark) === 0) && (
                        <p className="mt-3 border border-[#E6A49D] bg-[#FCEBE8] px-3 py-2.5 text-xs leading-5 text-foreground"><strong className="block">Belum ada paket yang menyebut RW ini</strong>Paket di bawah berasal dari wilayah yang lebih luas atau nama lokasi yang mirip. Periksa detailnya sebelum memilih; laporan tetap dapat dibuat tanpa tautan paket.</p>
                      )}
                      {!candidatesLoading && !currentCandidateError && rankedCandidates.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Belum ada paket jalan tercatat untuk kecamatan ini. Laporan tetap dapat dibuat tanpa tautan paket.</p>}
                      {!candidatesLoading && !currentCandidateError && rankedCandidates.length > 0 && visibleCandidates.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Tidak ada paket yang cocok dengan pencarian.</p>}
                      {!candidatesLoading && !currentCandidateError && visibleCandidates.length > 0 && (
                        <div aria-label="Daftar kandidat paket" role="region" tabIndex={0} className="mt-3 max-h-[24rem] overflow-y-auto overscroll-contain pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                          <ul className="grid gap-2.5">
                          {visibleCandidates.map((item) => {
                            const matchOrder = candidateOrder(item, selectedArea, landmark);
                            const active = selectedPackage?.kode_rup === item.kode_rup;
                            return (
                              <li key={item.kode_rup} className={`border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
                                <div className="flex items-start gap-3">
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold leading-5 text-foreground">{item.nama}</span>
                                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{formatBudget(item.pagu)} · {item.bulan} · {item.presisi_peta}</span>
                                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">RUP {item.kode_rup}</span>
                                  </span>
                                  <button type="button" onClick={() => setSelectedPackage(active ? null : item)} aria-pressed={active} className={`min-h-9 shrink-0 px-2.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-primary text-white hover:bg-[#004682]" : "text-primary hover:bg-primary/10"}`}>
                                    {active ? "Dipilih" : "Pilih"}
                                  </button>
                                </div>
                                {matchOrder >= 2 && <span className="mt-2 block text-[10px] text-muted-foreground">Wilayah paket lebih luas; periksa detail sebelum ditautkan.</span>}
                              </li>
                            );
                          })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <div className="flex min-h-[360px] flex-col items-center justify-center bg-muted/35 px-5 py-12 text-center sm:min-h-[420px]">
                  <span className="flex size-16 items-center justify-center bg-primary text-white">
                    <FiCheckCircle aria-hidden="true" className="size-8" />
                  </span>
                  <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">04 · Sukses</p>
                  <h2 id="step-heading" className="mt-2 font-heading text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-3xl">Laporan berhasil disiapkan</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    {selectedArea
                      ? "Wilayah dan rincian kerusakan yang dipilih sudah tercantum dalam ringkasan. Anda masih dapat memeriksanya sebelum keluar."
                      : `RUP ${selectedPackage?.kode_rup} menjadi rujukan, tetapi lokasi kerusakan belum dipilih. Tidak ada RW tertentu yang ditandai.`}
                  </p>
                  <p className="mt-6 border-l-4 border-secondary bg-white px-4 py-3 text-left text-sm font-semibold leading-5 text-foreground">
                    masih mockup &amp; belum disubmit
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
              <SummaryRow label="Foto" value={photo?.file.name ?? "Belum dipilih"} pending={!photo} />
              <SummaryRow label="Kerusakan" value={damageType || "Belum dipilih"} pending={!damageType} />
              <SummaryRow label="Penyebab" value={observedCauses.length ? observedCauses.join(", ") : "Belum dipilih"} pending={observedCauses.length === 0} />
              <SummaryRow label="Ukuran" value={coarseSize || "Belum dipilih"} pending={!coarseSize} />
              <SummaryRow label="Wilayah" value={selectedArea ? `${selectedArea.village} RW ${selectedArea.rw}, ${selectedArea.district}` : "Belum dipilih"} pending={!selectedArea} />
              <SummaryRow label="Patokan" value={landmark || "Tidak diisi"} />
              <SummaryRow label="Paket" value={selectedPackage ? `RUP ${selectedPackage.kode_rup}` : "Belum ditautkan"} />
            </dl>
            <div className="mt-4 bg-muted/50 p-3">
              <p className="text-sm font-semibold leading-5 text-foreground">masih mockup &amp; belum disubmit</p>
            </div>
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
