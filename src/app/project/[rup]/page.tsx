import type { Metadata } from "next";
import {
  generateRoadPackageDetailMetadata,
  RoadPackageDetailPage,
} from "@/app/_components/road-package-detail-page";

interface ProjectDetailPageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[]; returnTo?: string | string[] }>;
}

export async function generateMetadata(props: ProjectDetailPageProps): Promise<Metadata> {
  return generateRoadPackageDetailMetadata({ ...props, directoryPath: "/project" });
}

export default function ProjectDetailPage(props: ProjectDetailPageProps) {
  return <RoadPackageDetailPage {...props} directoryPath="/project" />;
}
