import Image from "next/image";

// Kimo mark: his caricature; small copy of the app icon (src/app/icon.png).
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return <Image src="/kimo-logo.png" alt="Kimo" width={64} height={64} unoptimized priority className={`rounded-[24%] ${className}`} />;
}
