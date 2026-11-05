import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/server/api/shared/api-error";

let client: SupabaseClient | null = null;

function getClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new ApiError(503, "REPORT_STORAGE_UNAVAILABLE", "Penyimpanan foto laporan belum dikonfigurasi.");
  }
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export function getReportBucketName() {
  return process.env.SUPABASE_REPORTS_BUCKET || "report-evidence";
}

export async function assertPrivateReportBucketReady() {
  const { data, error } = await getClient().storage.getBucket(getReportBucketName());
  if (error || !data) throw new ApiError(503, "REPORT_BUCKET_UNAVAILABLE", "Bucket foto laporan belum tersedia.");
  if (data.public) throw new ApiError(503, "REPORT_BUCKET_MUST_BE_PRIVATE", "Bucket foto laporan harus bersifat privat.");
}

export async function uploadPrivateReportImage(path: string, bytes: Buffer) {
  const { error } = await getClient().storage.from(getReportBucketName()).upload(path, bytes, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new ApiError(503, "REPORT_STORAGE_FAILED", "Foto laporan belum dapat disimpan.");
}

export async function removePrivateReportImage(path: string) {
  const { error } = await getClient().storage.from(getReportBucketName()).remove([path]);
  if (error) throw new ApiError(503, "REPORT_STORAGE_CLEANUP_FAILED", "Pembersihan foto sementara belum berhasil.");
}

export async function ensurePrivateReportBucket() {
  const storage = getClient().storage;
  const bucket = getReportBucketName();
  const existing = await storage.getBucket(bucket);
  if (existing.error && !/not found|does not exist/i.test(existing.error.message)) {
    throw new ApiError(503, "REPORT_BUCKET_CHECK_FAILED", "Bucket foto laporan belum dapat diperiksa.");
  }
  if (existing.data) {
    if (existing.data.public) {
      throw new ApiError(500, "REPORT_BUCKET_MUST_BE_PRIVATE", "Bucket foto laporan harus bersifat privat.");
    }
    const updated = await storage.updateBucket(bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/webp"],
    });
    if (updated.error) throw new ApiError(503, "REPORT_BUCKET_UPDATE_FAILED", "Batas bucket foto laporan belum dapat diterapkan.");
    return;
  }
  const created = await storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"],
  });
  if (created.error) throw new ApiError(503, "REPORT_BUCKET_CREATE_FAILED", "Bucket foto laporan belum dapat dibuat.");
}
