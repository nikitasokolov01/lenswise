import { LoaderCircle } from "lucide-react";

export function FrameCatalogLoading() {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-teal-200 bg-teal-50/40 px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm ring-1 ring-teal-100">
        <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" />
      </div>
      <p className="mt-4 font-semibold text-navy-900">Loading the frame catalog…</p>
      <p className="mt-1 max-w-md text-sm text-navy-500">
        Your office inventory is ready to use while the licensed frame choices finish loading.
      </p>
      <span className="sr-only">Loading catalog frames</span>
    </div>
  );
}
