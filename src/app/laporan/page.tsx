import type { Metadata } from "next";
import ReportPrototype from "@/features/reports/components/report-prototype";

export const metadata: Metadata = {
  title: "Laporkan Kerusakan Jalan — SAKSI",
  description: "Simulasi alur laporan kerusakan jalan SAKSI.",
};

export default function LaporanPage() {
  return <ReportPrototype />;
}
