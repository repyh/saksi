"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { LineString, MultiLineString } from "geojson";
import { FiCheck, FiFileText, FiRefreshCw, FiX } from "react-icons/fi";
import type { RegionSummary } from "@/contracts/regions/region.contract";
import ReportLocationMap from "@/features/reports/components/report-location-map";
import type { ApiResult } from "@/contracts/shared/api.contract";
import {
  reportReviewDetailSchema,
  reportReviewQueueResponseSchema,
  type ReportReviewDetail,
  type ReportReviewQueueItem,
} from "@/contracts/reports/report-review-queue.contract";

const damageLabels: Record<ReportReviewQueueItem["damageType"], string> = {
  POTHOLE: "Lubang",
  CRACK: "Retak",
  SUBSIDENCE: "Amblas",
  STANDING_WATER: "Genangan",
  BLOCKED_DRAINAGE: "Drainase mampet",
  DAMAGED_BRIDGE: "Jembatan rusak",
  OTHER: "Lainnya",
};

const statusLabels: Record<ReportReviewQueueItem["status"], string> = {
  SUBMITTED: "Menunggu peninjauan",
  UNDER_REVIEW: "Sedang ditinjau",
  NEEDS_MORE_INFO: "Perlu informasi tambahan",
  PUBLISHED: "Disetujui untuk ditampilkan",
  REJECTED: "Tidak disetujui",
  WITHDRAWN: "Ditarik",
  ARCHIVED: "Diarsipkan",
};

const EDITABLE_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "NEEDS_MORE_INFO"]);

type ReportAction = {
  report: ReportReviewQueueItem;
  status: "PUBLISHED" | "REJECTED";
  anchor: HTMLButtonElement;
};

const statusOptions = [
  { value: "active", label: "Perlu ditinjau" },
  { value: "all", label: "Semua status" },
  { value: "SUBMITTED", label: "Menunggu peninjauan" },
  { value: "UNDER_REVIEW", label: "Sedang ditinjau" },
  { value: "NEEDS_MORE_INFO", label: "Perlu informasi tambahan" },
  { value: "PUBLISHED", label: "Disetujui untuk ditampilkan" },
  { value: "REJECTED", label: "Tidak disetujui" },
  { value: "WITHDRAWN", label: "Ditarik" },
  { value: "ARCHIVED", label: "Diarsipkan" },
] as const;

const causeLabels: Record<ReportReviewDetail["observedCauses"][number], string> = {
  HEAVY_VEHICLE: "Dilalui kendaraan berat",
  NO_DRAINAGE: "Tidak ada drainase",
  RECURRING_FLOODING: "Genangan berulang",
  HEAVY_TRAFFIC: "Lalu lintas padat",
  UNSUITABLE_MATERIAL: "Bahan tidak sesuai",
  UNKNOWN: "Tidak tahu",
};

const sizeLabels: Record<NonNullable<ReportReviewDetail["coarseSize"]>, string> = {
  PALM: "Setelapak tangan",
  TIRE: "Sebesar ban",
  OVER_1M2: "Lebih dari 1 m²",
};

const orderOptions = [
  { value: "submittedAt_desc", label: "Terbaru" },
  { value: "submittedAt_asc", label: "Terlama" },
] as const;

type StatusFilter = (typeof statusOptions)[number]["value"];
type SubmissionOrder = (typeof orderOptions)[number]["value"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function statusClass(status: ReportReviewQueueItem["status"]) {
  if (status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "NEEDS_MORE_INFO") {
    return "bg-amber-50 text-amber-900";
  }
  if (status === "PUBLISHED") return "bg-emerald-50 text-emerald-900";
  if (status === "REJECTED") return "bg-red-50 text-red-900";
  return "bg-muted text-muted-foreground";
}

async function fetchQueue(status: StatusFilter, order: SubmissionOrder, cursor?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ status, order });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/reports/review?${params}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const result = await response.json() as ApiResult<unknown>;
  if (!response.ok || result.error) {
    throw new Error(result.error?.message ?? "Antrean laporan belum dapat dimuat.");
  }
  const parsed = reportReviewQueueResponseSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("Format antrean laporan tidak dikenali.");
  return parsed.data;
}

async function fetchReviewDetail(reportId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/reports/review/${encodeURIComponent(reportId)}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const result = await response.json() as ApiResult<unknown>;
  if (!response.ok || result.error) throw new Error(result.error?.message ?? "Detail laporan belum dapat dimuat.");
  const parsed = reportReviewDetailSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("Format detail laporan tidak dikenali.");
  return parsed.data;
}

export function ReportReviewQueue({ region, active, canViewDetails, canViewEvidence, canChangeStatus }: {
  region: RegionSummary;
  active: boolean;
  canViewDetails: boolean;
  canViewEvidence: boolean;
  canChangeStatus: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionPopoverRef = useRef<HTMLFormElement>(null);
  const lastActionAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [order, setOrder] = useState<SubmissionOrder>("submittedAt_desc");
  const [reports, setReports] = useState<ReportReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ReportAction | null>(null);
  const [actionPosition, setActionPosition] = useState<{ top: number; left: number } | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportReviewQueueItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ReportReviewDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [evidenceLoadFailed, setEvidenceLoadFailed] = useState(false);
  const requestKey = `${status}:${order}:${refreshKey}`;
  const isLoading = active && loadedRequestKey !== requestKey && !error;

  useLayoutEffect(() => {
    if (!action) return;

    const updatePosition = () => {
      if (!action.anchor.isConnected) {
        setAction(null);
        return;
      }

      const anchorRect = action.anchor.getBoundingClientRect();
      const popoverRect = actionPopoverRef.current?.getBoundingClientRect();
      const popoverWidth = popoverRect?.width ?? 320;
      const popoverHeight = popoverRect?.height ?? 240;
      const gap = 8;
      const edge = 12;
      const maxLeft = Math.max(edge, window.innerWidth - popoverWidth - edge);
      const left = Math.min(maxLeft, Math.max(edge, anchorRect.right - popoverWidth));
      const below = anchorRect.bottom + gap;
      const top = below + popoverHeight <= window.innerHeight - edge
        ? below
        : Math.max(edge, anchorRect.top - popoverHeight - gap);

      setActionPosition({ top, left });
    };

    const frame = window.requestAnimationFrame(updatePosition);
    // Tinggi popover berubah saat pesan galat muncul; hitung ulang agar tetap di layar.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    if (observer && actionPopoverRef.current) observer.observe(actionPopoverRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [action]);

  useEffect(() => {
    if (action) {
      lastActionAnchorRef.current = action.anchor;
      return;
    }
    const anchor = lastActionAnchorRef.current;
    lastActionAnchorRef.current = null;
    if (anchor?.isConnected) anchor.focus();
  }, [action]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!selectedReport || !dialog || dialog.open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [selectedReport]);

  function closeReview() {
    dialogRef.current?.close();
    setSelectedReport(null);
    setSelectedDetail(null);
    setDetailError("");
    setEvidenceLoadFailed(false);
  }

  function openReview(report: ReportReviewQueueItem) {
    setSelectedDetail(null);
    setDetailError("");
    setEvidenceLoadFailed(false);
    setIsDetailLoading(true);
    setSelectedReport(report);
  }

  useEffect(() => {
    if (!selectedReport || !canViewDetails) return;
    const controller = new AbortController();

    void fetchReviewDetail(selectedReport.id, controller.signal)
      .then(setSelectedDetail)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setDetailError(cause instanceof Error ? cause.message : "Detail laporan belum dapat dimuat.");
      })
      .finally(() => { if (!controller.signal.aborted) setIsDetailLoading(false); });

    return () => controller.abort();
  }, [canViewDetails, selectedReport]);

  useEffect(() => {
    if (!active || loadedRequestKey === requestKey) return;
    const controller = new AbortController();

    void fetchQueue(status, order, undefined, controller.signal)
      .then((result) => {
        setReports(result.reports);
        setTotal(result.total);
        setNextCursor(result.nextCursor);
        setError("");
        setLoadedRequestKey(requestKey);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Antrean laporan belum dapat dimuat.");
        setLoadedRequestKey(requestKey);
      });

    return () => controller.abort();
  }, [active, loadedRequestKey, order, requestKey, status]);

  function refresh() {
    setAction(null);
    setReports([]);
    setNextCursor(null);
    setError("");
    setRefreshKey((current) => current + 1);
  }

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError("");
    try {
      const result = await fetchQueue(status, order, nextCursor);
      setReports((current) => [...current, ...result.reports]);
      setTotal(result.total);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Laporan berikutnya belum dapat dimuat.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function submitAction() {
    if (!action || reason.trim().length < 3) return;
    setIsActing(true);
    setActionError("");
    try {
      const response = await fetch(`/api/reports/review/${encodeURIComponent(action.report.publicCode)}`, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ status: action.status, reason: reason.trim() }),
      });
      const result = await response.json() as ApiResult<unknown>;
      if (!response.ok || result.error) {
        throw new Error(result.error?.message ?? "Status laporan belum dapat diubah.");
      }
      setAction(null);
      setReason("");
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Status laporan belum dapat diubah.");
    } finally {
      setIsActing(false);
    }
  }

  function openAction(event: MouseEvent<HTMLButtonElement>, report: ReportReviewQueueItem, nextStatus: ReportAction["status"]) {
    setAction({ report, status: nextStatus, anchor: event.currentTarget });
    setActionPosition(null);
    setReason("");
    setActionError("");
  }

  return (
    <section className="mt-4" aria-label="Antrean review laporan">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <p className="text-sm text-muted-foreground">{total} laporan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Antrean menampilkan ringkasan tanpa identitas pelapor, deskripsi, petunjuk lokasi, atau foto.
            {canViewDetails ? " Detail laporan tersedia sesuai hak akses." : ""}
            {canChangeStatus ? " Status dapat diubah dengan alasan moderasi." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="report-review-status">Filter status laporan</label>
          <select
            id="report-review-status"
            value={status}
            onChange={(event) => {
              setReports([]);
              setNextCursor(null);
              setError("");
              setStatus(event.target.value as StatusFilter);
            }}
            className="h-10 min-w-44 cursor-pointer border border-input bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="report-review-order">Urutkan laporan</label>
          <select
            id="report-review-order"
            value={order}
            onChange={(event) => {
              setReports([]);
              setNextCursor(null);
              setError("");
              setOrder(event.target.value as SubmissionOrder);
            }}
            className="h-10 min-w-36 cursor-pointer border border-input bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          >
            {orderOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading || isLoadingMore}
            aria-label="Muat ulang antrean laporan"
            title="Muat ulang antrean"
            className="inline-flex size-10 cursor-pointer items-center justify-center border border-border text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
          >
            <FiRefreshCw aria-hidden="true" className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="cursor-pointer font-bold text-red-900 underline underline-offset-4 hover:text-red-700"
          >
            Coba lagi
          </button>
        </div>
      )}

      {isLoading ? (
        <div role="status" className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Memuat antrean laporan…</div>
      ) : reports.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
          <span className="flex size-12 items-center justify-center bg-orange-50 text-orange-800">
            <FiFileText aria-hidden="true" className="size-5" />
          </span>
          <h3 className="mt-4 font-heading text-base font-bold">Tidak ada laporan pada filter ini</h3>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Pilih status lain untuk melihat laporan yang sudah diproses.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-muted/45 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3">Laporan</th>
                  <th scope="col" className="px-4 py-3">Wilayah</th>
                  <th scope="col" className="px-4 py-3">Paket rujukan</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  {(canViewDetails || canChangeStatus) && <th scope="col" className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
            {reports.map((report) => {
              const area = [report.areaName, report.districtName].filter(Boolean).join(" · ");
              return (
                <tr key={report.id} className="border-t border-border bg-white align-middle transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold">{damageLabels[report.damageType]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(report.submittedAt)}</p>
                  </td>
                  <td className="max-w-64 px-4 py-3.5 text-muted-foreground">{area || "Lokasi belum dicantumkan"}</td>
                  <td className="max-w-sm px-4 py-3.5">
                    {report.package ? (
                      <>
                        <p className="font-semibold">RUP {report.package.rup}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={report.package.name}>{report.package.name}</p>
                      </>
                    ) : <span className="text-muted-foreground">Tidak ditautkan</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className={`inline-flex min-h-7 items-center px-2.5 text-xs font-semibold ${statusClass(report.status)}`}>
                      {statusLabels[report.status]}
                    </span>
                  </td>
                  {(canViewDetails || canChangeStatus) && <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-2">
                      {canViewDetails && <button
                        type="button"
                        onClick={() => openReview(report)}
                        aria-label={`Review laporan ${damageLabels[report.damageType]}`}
                        className="inline-flex h-9 min-w-9 cursor-pointer items-center justify-center border border-primary px-3 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Detail
                      </button>}
                      {canChangeStatus && EDITABLE_STATUSES.has(report.status) && (
                        <>
                          {report.status !== "PUBLISHED" && <button
                            type="button"
                            onClick={(event) => openAction(event, report, "PUBLISHED")}
                            aria-label={`Publikasikan laporan ${damageLabels[report.damageType]}`}
                            title="Publikasikan"
                            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          ><FiCheck aria-hidden="true" className="size-3.5" /></button>}
                          <button
                            type="button"
                            onClick={(event) => openAction(event, report, "REJECTED")}
                            aria-label={`${report.status === "PUBLISHED" ? "Tarik publikasi" : "Tolak laporan"} ${damageLabels[report.damageType]}`}
                            title={report.status === "PUBLISHED" ? "Tarik publikasi" : "Tolak"}
                            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-destructive text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                          ><FiX aria-hidden="true" className="size-3.5" /></button>
                        </>
                      )}
                    </div>
                  </td>}
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 border border-border px-4 text-sm font-bold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
              >
                {isLoadingMore && <FiRefreshCw aria-hidden="true" className="size-4 animate-spin" />}
                {isLoadingMore ? "Memuat…" : "Muat laporan berikutnya"}
              </button>
            </div>
          )}
        </>
      )}

      {action && typeof document !== "undefined" && createPortal(
        <div
          role="presentation"
          onClick={() => setAction(null)}
          onKeyDown={(event) => { if (event.key === "Escape") setAction(null); }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 sm:bg-transparent sm:p-0"
        >
          <form
            ref={actionPopoverRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-action-title"
            onSubmit={(event) => { event.preventDefault(); void submitAction(); }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = actionPopoverRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea, input[type=email], a[href]");
              if (!focusable?.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            onClick={(event) => event.stopPropagation()}
            style={{
              "--action-top": `${actionPosition?.top ?? -10000}px`,
              "--action-left": `${actionPosition?.left ?? 0}px`,
              visibility: actionPosition ? "visible" : "hidden",
            } as CSSProperties}
            className="w-full max-w-sm border border-border bg-white p-4 shadow-xl sm:fixed sm:top-[var(--action-top)] sm:left-[var(--action-left)] sm:w-80 sm:max-w-[calc(100vw-1.5rem)] sm:p-3 sm:shadow-lg"
          >
            <p id="report-action-title" className="text-sm font-semibold text-foreground">{action.status === "PUBLISHED" ? "Publikasikan laporan ini" : "Tolak laporan ini"}</p>
            <label className="mt-2 block text-xs font-semibold text-muted-foreground">
              Alasan moderasi (wajib, minimal 3 karakter)
              <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={1000} className="mt-1 w-full border border-input bg-white px-2 py-1.5 text-sm font-normal text-foreground" />
            </label>
            {actionError ? <p role="alert" className="mt-2 text-xs font-semibold text-destructive">{actionError}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="submit" disabled={reason.trim().length < 3 || isActing} className="inline-flex min-h-9 items-center bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{isActing ? "Menyimpan…" : "Simpan keputusan"}</button>
              <button type="button" onClick={() => setAction(null)} className="inline-flex min-h-9 items-center border border-border px-3 text-xs font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Batal</button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {selectedReport && (
        <dialog
          ref={dialogRef}
          aria-labelledby="report-review-title"
          onClose={() => setSelectedReport(null)}
          onCancel={(event) => { event.preventDefault(); closeReview(); }}
          onClick={(event) => { if (event.target === dialogRef.current) closeReview(); }}
          className="m-auto max-h-[min(90dvh,52rem)] w-[min(100%-2rem,70rem)] max-w-none overflow-hidden border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-slate-950/55"
        >
          <div className="flex max-h-[min(90dvh,52rem)] flex-col">
            <header className="flex items-start justify-between gap-5 px-5 py-5 sm:px-7">
              <div className="min-w-0">
                <h3 id="report-review-title" className="font-heading text-xl font-bold">{damageLabels[selectedReport.damageType]}</h3>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{selectedReport.id}</p>
              </div>
              <button type="button" onClick={closeReview} aria-label="Tutup review laporan" className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <FiX aria-hidden="true" className="size-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 pb-5 pt-3 sm:px-7 sm:pb-6">
              {isDetailLoading ? (
                <p role="status" className="py-10 text-center text-sm text-muted-foreground">Memuat detail laporan…</p>
              ) : detailError ? (
                <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-900">{detailError}</p>
              ) : selectedDetail ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
                  <div className="grid content-start gap-6">
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</dt><dd className="mt-1 text-sm font-semibold">{statusLabels[selectedDetail.status]}</dd></div>
                      <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Dikirim</dt><dd className="mt-1 text-sm">{formatDate(selectedDetail.submittedAt)}</dd></div>
                      <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Wilayah</dt><dd className="mt-1 text-sm">{[selectedDetail.areaName, selectedDetail.districtName].filter(Boolean).join(" · ") || "Tidak dicantumkan"}</dd></div>
                      <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Paket rujukan</dt><dd className="mt-1 text-sm">{selectedDetail.package ? `RUP ${selectedDetail.package.rup} · ${selectedDetail.package.name}` : "Tidak ditautkan"}</dd></div>
                      <div><dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Titik publik</dt><dd className="mt-1 text-sm">{selectedDetail.publicLocationConsent ? "Pelapor mengizinkan" : "Pelapor menyembunyikan"}</dd></div>
                    </dl>
                    <section aria-labelledby="report-review-location" className="grid gap-2 lg:col-span-2">
                      <h4 id="report-review-location" className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Lokasi presisi</h4>
                      {selectedDetail.preciseLocationAccess ? (
                        selectedDetail.location || selectedDetail.road ? (
                          <ReportLocationMap
                            region={region}
                            point={selectedDetail.location ? { ...selectedDetail.location, accuracyM: selectedDetail.location.accuracyM } : null}
                            readOnly
                            selectedRoad={selectedDetail.road?.geometry ? {
                              id: selectedDetail.road.id,
                              name: selectedDetail.road.name,
                              geometry: selectedDetail.road.geometry as LineString | MultiLineString,
                            } : null}
                            label="Titik presisi laporan; hanya terlihat oleh staf berizin."
                            className="h-[300px]"
                          />
                        ) : (
                          <p className="bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">Laporan ini tidak memiliki titik koordinat atau ruas.</p>
                        )
                      ) : (
                        <p className="bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                          Lokasi presisi tidak tersedia untuk akun ini. Minta izin <span className="font-mono">reports.read_precise_location</span> bila memang diperlukan.
                        </p>
                      )}
                    </section>
                    <section aria-labelledby="report-review-observations" className="grid gap-2">
                      <h4 id="report-review-observations" className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Rincian laporan</h4>
                      <p className="text-sm leading-6"><span className="font-semibold">Ukuran kasar:</span> {selectedDetail.coarseSize ? sizeLabels[selectedDetail.coarseSize] : "Tidak dipilih"}</p>
                      <p className="text-sm leading-6"><span className="font-semibold">Penyebab yang terlihat:</span> {selectedDetail.observedCauses.length ? selectedDetail.observedCauses.map((cause) => causeLabels[cause]).join(", ") : "Tidak dipilih"}</p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedDetail.description || "Tidak ada keterangan tambahan."}</p>
                    </section>
                    <p className="bg-muted/55 px-4 py-3 text-xs leading-5 text-muted-foreground">Informasi ini merupakan masukan pelapor dan belum diverifikasi. Paket rujukan menunjukkan pilihan pelapor, bukan bukti penyebab kerusakan.</p>
                  </div>
                  {canViewEvidence && (
                    <section aria-labelledby="report-review-evidence-title" className="grid content-start gap-2">
                      <h4 id="report-review-evidence-title" className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Foto bukti</h4>
                      {selectedDetail.hasEvidence && !evidenceLoadFailed ? (
                        <div className="relative h-[min(55dvh,34rem)] w-full border border-border bg-muted/30">
                          <Image
                          src={`/api/reports/review/${encodeURIComponent(selectedDetail.id)}/evidence`}
                          alt={`Foto bukti laporan ${damageLabels[selectedDetail.damageType].toLowerCase()}`}
                            fill
                            sizes="(max-width: 1024px) 100vw, 40vw"
                            unoptimized
                          onError={() => setEvidenceLoadFailed(true)}
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex min-h-48 items-center justify-center border border-border bg-muted/25 px-5 text-center text-sm text-muted-foreground">
                          {selectedDetail.hasEvidence ? "Foto belum dapat dimuat." : "Foto tidak tersedia."}
                        </div>
                      )}
                      <p className="text-xs leading-5 text-muted-foreground">Bukti hanya ditampilkan kepada petugas dengan izin akses bukti.</p>
                    </section>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </dialog>
      )}
    </section>
  );
}
