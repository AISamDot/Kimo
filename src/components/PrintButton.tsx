"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2">
      Print / save PDF
    </button>
  );
}
