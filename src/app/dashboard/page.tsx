import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createPageMetadata } from "@/lib/seo";
import { auth } from "@/lib/auth";
import { accountApi } from "@/server/api/account/account.api";
import { DashboardTabs } from "@/features/dashboard/components/dashboard-tabs";
import { getRegion, regionSummary } from "@/server/regions/region-registry";

export const metadata = createPageMetadata({
  title: "Dashboard akun",
  description: "Kelola akun dan laporan Anda di SAKSI.",
  path: "/dashboard",
  index: false,
});

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login?returnTo=%2Fdashboard");

  const account = await accountApi.getDashboardAccount(session.user.id);
  if (!account) redirect("/login?returnTo=%2Fdashboard");

  return (
    <main className="mx-auto min-h-[560px] w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <h1 className="mb-6 font-heading text-3xl leading-tight font-extrabold tracking-[-0.035em] text-foreground sm:mb-7 sm:text-4xl">
        Dashboard
      </h1>
      <DashboardTabs account={account} region={regionSummary(getRegion())} />
    </main>
  );
}
