import "server-only";
import Busboy from "busboy";
import { Readable } from "node:stream";
import { ApiError } from "@/server/api/shared/api-error";

export const MAX_REPORT_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_REPORT_INPUT_BYTES + 64 * 1024;
const SINGLE_VALUE_FIELDS = new Set([
  "damageType",
  "coarseSize",
  "description",
  "areaKey",
  "locationSource",
  "locationHint",
  "latitude",
  "longitude",
  "accuracyM",
  "publicLocationConsent",
  "roadSegmentId",
  "packageRup",
  "packageSelectionSource",
]);

export type ParsedReportMultipart = {
  fields: Record<string, string | string[]>;
  photo: Buffer;
};

export async function parseReportMultipart(request: Request): Promise<ParsedReportMultipart> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new ApiError(415, "INVALID_CONTENT_TYPE", "Permintaan harus menggunakan multipart/form-data.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "Ukuran permintaan melebihi batas.");
  }
  if (!request.body) throw new ApiError(400, "EMPTY_REQUEST", "Isi laporan tidak ditemukan.");

  const fields: Record<string, string | string[]> = {};
  const chunks: Buffer[] = [];
  let fileBytes = 0;
  let fileCount = 0;
  let parseError: ApiError | null = null;

  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({
      headers: Object.fromEntries(request.headers.entries()),
      limits: {
        fieldNameSize: 64,
        fieldSize: 4096,
        fields: 18,
        fileSize: MAX_REPORT_INPUT_BYTES,
        files: 1,
        parts: 19,
      },
    });
  } catch {
    throw new ApiError(400, "INVALID_MULTIPART", "Isi laporan tidak dapat dibaca.");
  }

  const fail = (error: ApiError) => {
    parseError ??= error;
  };

  parser.on("field", (name, value, info) => {
    if (info.nameTruncated || info.valueTruncated) {
      fail(new ApiError(400, "INVALID_FIELD", "Salah satu isian terlalu panjang."));
      return;
    }
    if (name !== "observedCauses" && !SINGLE_VALUE_FIELDS.has(name)) {
      fail(new ApiError(400, "UNKNOWN_FIELD", "Permintaan berisi isian yang tidak dikenal."));
      return;
    }
    if (name === "observedCauses") {
      const current = fields[name];
      fields[name] = current ? [...(Array.isArray(current) ? current : [current]), value] : [value];
      return;
    }
    if (fields[name] !== undefined) {
      fail(new ApiError(400, "DUPLICATE_FIELD", "Permintaan berisi isian ganda."));
      return;
    }
    fields[name] = value;
  });

  parser.on("file", (name, stream) => {
    fileCount += 1;
    if (name !== "photo" || fileCount > 1) {
      fail(new ApiError(400, "INVALID_FILE_FIELD", "Kirim satu foto pada isian photo."));
      stream.resume();
      return;
    }
    stream.on("data", (chunk: Buffer) => {
      fileBytes += chunk.length;
      chunks.push(chunk);
    });
    stream.on("limit", () => fail(new ApiError(413, "UPLOAD_TOO_LARGE", "Ukuran foto maksimal 10 MB.")));
  });

  parser.on("filesLimit", () => fail(new ApiError(400, "TOO_MANY_FILES", "Satu laporan hanya menerima satu foto.")));
  parser.on("fieldsLimit", () => fail(new ApiError(400, "TOO_MANY_FIELDS", "Jumlah isian melebihi batas.")));
  parser.on("partsLimit", () => fail(new ApiError(400, "TOO_MANY_PARTS", "Jumlah bagian permintaan melebihi batas.")));

  try {
    await new Promise<void>((resolve, reject) => {
      parser.once("close", resolve);
      parser.once("error", reject);
      const source = Readable.fromWeb(request.body as import("node:stream/web").ReadableStream);
      source.once("error", reject);
      source.pipe(parser);
    });
  } catch {
    throw new ApiError(400, "INVALID_MULTIPART", "Isi laporan tidak dapat dibaca.");
  }

  if (parseError) throw parseError;
  if (fileCount !== 1 || fileBytes === 0) {
    throw new ApiError(400, "PHOTO_REQUIRED", "Pilih satu foto kerusakan sebelum mengirim laporan.");
  }

  return { fields, photo: Buffer.concat(chunks, fileBytes) };
}
