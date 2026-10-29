import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({ variable: "--font-sans-face", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-serif-face", subsets: ["latin"], axes: ["opsz", "SOFT"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Kimo · Interview Buddy", template: "%s · Kimo" },
  description: "Practise supply-chain interviews in English and German and find out why offers aren't coming.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
