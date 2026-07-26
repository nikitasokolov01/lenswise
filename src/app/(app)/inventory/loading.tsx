import { LoaderCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function FrameInventoryLoading() {
  return (
    <main
      className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">
        Office catalog
      </p>
      <h1 className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">
        Frame inventory
      </h1>
      <p className="mt-1 text-sm text-navy-500">Opening this location’s inventory…</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-navy-100 bg-white shadow-sm"
          />
        ))}
      </div>

      <Card className="mt-6 overflow-hidden border-teal-200">
        <CardHeader className="bg-teal-50/60">
          <CardTitle>Add a frame</CardTitle>
          <CardDescription>
            Preparing the licensed catalog for this office.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-teal-700" aria-hidden="true" />
            <p className="mt-3 font-semibold text-navy-900">Loading frame catalog…</p>
          </div>
        </CardContent>
      </Card>

      <span className="sr-only">Loading frame inventory</span>
    </main>
  );
}
