import Image from "next/image";
import { PackageSearchForm } from "./package-search-form";

export function PackageSearchSection({ regionId }: { regionId: string }) {
  return (
    <section aria-labelledby="package-search-title" className="relative isolate scroll-mt-16 min-h-[220px] overflow-hidden border-t-4 border-secondary text-white sm:min-h-[240px] lg:min-h-[260px]">
      <Image
        src="/images/saksi/hero-jakarta-road.jpg"
        alt=""
        fill
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-foreground/80" />
      <div className="relative z-0 mx-auto grid min-h-[216px] w-full max-w-7xl gap-5 px-4 py-10 sm:min-h-[236px] sm:px-6 sm:py-12 lg:min-h-[256px] lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12 lg:px-8 lg:py-14">
        <div>
          <h2 id="package-search-title" className="max-w-xl font-heading text-2xl leading-tight font-extrabold tracking-[-0.025em] sm:text-3xl">
            Cari paket pekerjaan jalan.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
            Gunakan nama kelurahan, jalan, kecamatan, atau nomor RUP.
          </p>
        </div>
        <PackageSearchForm inputId="section-package-search" regionId={regionId} />
      </div>
    </section>
  );
}
