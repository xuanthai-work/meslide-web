import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { connection } from "next/server";
import localFont from "next/font/local";
import { Manrope, Unbounded } from "next/font/google";
import { translate } from "@/i18n/translate";
import { defaultLocale, ogLocale } from "@/i18n/config";
import { getServerFeatureFlags } from "@/lib/server-feature-flags";
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

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

const unbounded = Unbounded({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  preload: false,
  variable: "--font-unbounded",
});

export async function generateMetadata(): Promise<Metadata> {
  // Evaluate the public origin at request time so the same container image can
  // be promoted across environments without rebuilding its metadata URLs.
  await connection();
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  const metaTitle = translate("metadata.title");
  const metaDescription = translate("metadata.description");
  const metaKeywords = translate("metadata.keywords").split(", ");
  const metaSiteName = translate("metadata.siteName");
  const metaLogoAlt = translate("metadata.logoAlt");

  return {
    metadataBase: new URL(siteUrl),
    title: metaTitle,
    description: metaDescription,
    keywords: metaKeywords,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: siteUrl,
      siteName: metaSiteName,
      images: [
        {
          url: "/apple-icon.png",
          width: 1200,
          height: 630,
          alt: metaLogoAlt,
        },
      ],
      type: "website",
      locale: ogLocale(defaultLocale),
    },
    alternates: {
      canonical: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: ["/apple-icon.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Defer environment reads to request time so one container image can use
  // different feature settings in different deployments.
  await connection();
  const featureFlags = getServerFeatureFlags();

  return (
    <html
      lang="vi"
      className={`${inter.variable} ${manrope.variable} ${unbounded.variable}`}
    >
      <body className="antialiased">
        <ClientRoot featureFlags={featureFlags}>{children}</ClientRoot>
      </body>
    </html>
  );
}
