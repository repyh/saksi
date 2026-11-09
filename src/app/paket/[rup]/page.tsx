import { permanentRedirect } from "next/navigation";

interface RetiredPackagePageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[] }>;
}

/** Rute detail paket lama; halaman bacaan sudah pindah ke `/project/[rup]`. */
export default async function RetiredPackagePage({ params, searchParams }: RetiredPackagePageProps) {
  const [{ rup }, query] = await Promise.all([params, searchParams]);
  const region = Array.isArray(query.region) ? query.region[0] : query.region;
  const search = region ? `?region=${encodeURIComponent(region)}` : "";
  permanentRedirect(`/project/${encodeURIComponent(rup)}${search}`);
}
