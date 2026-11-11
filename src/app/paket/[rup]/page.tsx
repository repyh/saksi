import type { Metadata } from "next";
import {
  generateRoadPackageDetailMetadata,
  RoadPackageDetailPage,
} from "@/app/_components/road-package-detail-page";

interface PackageDetailPageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[]; returnTo?: string | string[] }>;
}

export async function generateMetadata(props: PackageDetailPageProps): Promise<Metadata> {
  return generateRoadPackageDetailMetadata(props);
}

export default function PackageDetailPage(props: PackageDetailPageProps) {
  return <RoadPackageDetailPage {...props} />;
}
