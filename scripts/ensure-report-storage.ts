import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: [".env.local", ".env"] });

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_REPORTS_BUCKET || "report-evidence";

if (!url || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a trusted server environment.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const existing = await supabase.storage.getBucket(bucketName);
if (existing.data?.public) {
  throw new Error(`Bucket ${bucketName} is public. Make a dedicated private report bucket before continuing.`);
}

if (existing.data) {
  const updated = await supabase.storage.updateBucket(bucketName, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"],
  });
  if (updated.error) throw updated.error;
  console.log(`Private bucket ${bucketName} verified and limits applied.`);
} else {
  if (existing.error && !/not found|does not exist/i.test(existing.error.message)) throw existing.error;
  const created = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"],
  });
  if (created.error) throw created.error;
  console.log(`Private bucket ${bucketName} created with WebP-only, 5 MiB limit.`);
}
