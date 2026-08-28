import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { connection } from "next/server";
import localFont from "next/font/local";
import { Manrope, Syne, Unbounded } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const ClientRoot = dynamic(() => import("./ClientRoot"));
const inter = localFont({
  src: [
    {
      path: "./fonts/Inter.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  preload: false,
  variable: "--font-inter",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  preload: false,
  variable: "--font-manrope",
});

const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  preload: false,
  variable: "--font-unbounded",
});

export async function generateMetadata(): Promise<Metadata> {
  // Evaluate the public origin at request time so the same container image can
  // be promoted across environments without rebuilding its metadata URLs.
  await connection();
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  return {
    metadataBase: new URL(siteUrl),
    title: "GSlide - AI presentation generator",
    description:
      "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, OpenAI-compatible), and PDF/PPTX export. A free Gamma alternative.",
    keywords: [
      "AI presentation generator",
      "data storytelling",
      "data visualization tool",
      "AI data presentation",
      "presentation generator",
      "data to presentation",
      "interactive presentations",
      "professional slides",
    ],
    openGraph: {
      title: "GSlide - AI presentation generator",
      description:
        "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, OpenAI-compatible), and PDF/PPTX export. A free Gamma alternative.",
      url: siteUrl,
      siteName: "GSlide",
      images: [
        {
          url: "/apple-icon.png",
          width: 1200,
          height: 630,
          alt: "GSlide Logo",
        },
      ],
      type: "website",
      locale: "en_US",
    },
    alternates: {
      canonical: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: "GSlide - AI presentation generator",
      description:
        "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, OpenAI-compatible), and PDF/PPTX export. A free Gamma alternative.",
      images: ["/apple-icon.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${syne.variable} ${manrope.variable} ${unbounded.variable} antialiased`}
      >
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
