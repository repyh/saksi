import { FiMapPin } from "react-icons/fi";
import MapView from "@/features/map/map-view";
import PwaControls from "@/features/pwa/components/pwa-controls";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-5 py-8 text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-700 text-white">
            <FiMapPin aria-hidden="true" size={21} />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
              Lomba Mia
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Map workspace
            </h1>
          </div>
          <PwaControls />
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-2 py-1 sm:px-3">
            <div>
              <h2 className="font-medium">OpenStreetMap</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pan and zoom to explore. Map tiles are provided by OpenStreetMap contributors.
              </p>
            </div>
          </div>
          <MapView />
        </section>
      </div>
    </main>
  );
}
