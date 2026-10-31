import { FiSearch, FiX } from "react-icons/fi";
import { Input } from "@/components/ui/input";

interface MapIntroSectionProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export function MapIntroSection({ searchQuery, onSearchChange }: MapIntroSectionProps) {
  return (
    <section id="jelajahi" aria-labelledby="map-intro-title" className="scroll-mt-16 border-t-4 border-secondary bg-primary text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-7 sm:px-6 sm:py-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12 lg:px-8">
        <div>
          <h2 id="map-intro-title" className="max-w-xl font-heading text-2xl leading-tight font-extrabold tracking-[-0.025em] sm:text-3xl">
            Temukan paket yang terkait dengan ruas Anda.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
            Pencarian menyaring daftar paket dan titik peta secara bersamaan.
          </p>
        </div>
        <div className="relative min-w-0">
          <FiSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Cari paket berdasarkan desa, jalan, kecamatan, atau nomor RUP"
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nama desa, jalan, kecamatan, atau nomor RUP"
            className="h-12 border-white bg-white pl-12 pr-12 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/50 sm:h-14 sm:text-base"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Hapus pencarian"
              className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <FiX className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
