"use client";

import { useEffect, useState } from "react";
import { FiFileText, FiRefreshCw } from "react-icons/fi";
import type { ApiResult } from "@/contracts/shared/api.contract";
import {
  reportReviewQueueResponseSchema,
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

type StatusFilter = (typeof statusOptions)[number]["value"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

async function fetchQueue(status: StatusFilter, cursor?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ status });
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

export function ReportReviewQueue({ active }: { active: boolean }) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [reports, setReports] = useState<ReportReviewQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<{ report: ReportReviewQueueItem; status: "PUBLISHED" | "REJECTED" } | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [isActing, setIsActing] = useState(false);
  const requestKey = `${status}:${refreshKey}`;
  const isLoading = active && loadedRequestKey !== requestKey && !error;

  useEffect(() => {
    if (!active || loadedRequestKey === requestKey) return;
    const controller = new AbortController();

    void fetchQueue(status, undefined, controller.signal)
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
  }, [active, loadedRequestKey, requestKey, status]);

  function refresh() {
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
      const result = await fetchQueue(status, nextCursor);
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

  return (
    <section className="mt-4" aria-label="Antrean review laporan">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-sm text-muted-foreground">{total} laporan</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Antrean menampilkan ringkasan laporan tanpa identitas pelapor, deskripsi, petunjuk lokasi, atau foto.
            Moderator dengan izin ubah status dapat mempublikasikan atau menolak laporan beserta alasannya.
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
          <ul className="mt-4 grid gap-3">
            {reports.map((report, index) => {
              const area = [report.areaName, report.districtName].filter(Boolean).join(" · ");
              return (
                <li key={report.publicCode || `${report.submittedAt}-${index}`} className="border border-border bg-white px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading text-base font-bold leading-6">{damageLabels[report.damageType]}</h3>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Dikirim {formatDate(report.submittedAt)}</p>
                    </div>
                    <span className="inline-flex min-h-8 items-center bg-orange-50 px-3 text-xs font-bold text-orange-900">
                      {statusLabels[report.status]}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-border/70 pt-3 text-sm sm:grid-cols-2">
                    <p className="leading-5 text-muted-foreground">{area || "Lokasi belum dicantumkan"}</p>
                    {report.package ? (
                      <p className="min-w-0 leading-5">
                        <span className="font-semibold text-foreground">RUP {report.package.rup}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{report.package.name}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Tidak ditautkan ke paket</p>
                    )}
                  </div>
                  {EDITABLE_STATUSES.has(report.status) ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                      {report.status !== "PUBLISHED" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAction({ report, status: "PUBLISHED" });
                            setReason("");
                            setActionError("");
                          }}
                          className="inline-flex min-h-9 items-center bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Publikasikan
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setAction({ report, status: "REJECTED" });
                          setReason("");
                          setActionError("");
                        }}
                        className="inline-flex min-h-9 items-center border border-destructive px-3 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                      >
                        {report.status === "PUBLISHED" ? "Tarik dari publikasi" : "Tolak"}
                      </button>
                    </div>
                  ) : null}
                  {action?.report.publicCode === report.publicCode ? (
                    <form
                      className="mt-3 border border-border bg-muted/20 p-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitAction();
                      }}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {action.status === "PUBLISHED" ? "Publikasikan laporan ini" : "Tolak laporan ini"}
                      </p>
                      <label className="mt-2 block text-xs font-semibold text-muted-foreground">
                        Alasan moderasi (wajib, minimal 3 karakter)
                        <textarea
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          rows={2}
                          maxLength={1000}
                          className="mt-1 w-full border border-input bg-white px-2 py-1.5 text-sm font-normal text-foreground"
                        />
                      </label>
                      {actionError ? <p role="alert" className="mt-2 text-xs font-semibold text-destructive">{actionError}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={reason.trim().length < 3 || isActing}
                          className="inline-flex min-h-9 items-center bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-[#004682] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                        >
                          {isActing ? "Menyimpan…" : "Simpan keputusan"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAction(null)}
                          className="inline-flex min-h-9 items-center border border-border px-3 text-xs font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
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
    </section>
  );
}
