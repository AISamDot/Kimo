import Image from "next/image";

// Kimo mark: a caricature of the user, the same drawing as the favicon (src/app/icon.svg).
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return <Image src="/icon.svg" alt="Kimo" width={64} height={64} unoptimized priority className={`rounded-[24%] ${className}`} />;
}
