"use client";
export default function PrintAutoPrint({ label, code }: { label: string; code: string }) {
  return (
    <div className="no-print mx-auto mb-4 max-w-md">
      <button onClick={() => window.print()} className="btn-primary w-full">🖨 Imprimir {label} — {code}</button>
    </div>
  );
}
