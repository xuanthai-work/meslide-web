import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { connection } from "next/server";
import localFont from "next/font/local";
import { Manrope, Unbounded } from "next/font/google";
import { getServerFeatureFlags } from "@/lib/server-feature-flags";
import "./globals.css";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

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

  const metaTitle = "GSlide - Tạo bài thuyết trình thông minh với AI";
  const metaDescription =
    "Tạo bài thuyết trình nhanh chóng, chuyên nghiệp và đẹp mắt với trợ lý AI";
  const metaKeywords = "trình tạo bài thuyết trình bằng AI, kể chuyện dữ liệu, công cụ trực quan hóa dữ liệu, thuyết trình dữ liệu bằng AI, trình tạo bài thuyết trình, từ dữ liệu đến bài thuyết trình, bài thuyết trình tương tác, slide chuyên nghiệp".split(", ");
  const metaSiteName = "GSlide";
  const metaLogoAlt = "Logo GSlide";

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
      locale: "vi_VN",
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
      className={cn(manrope.variable, unbounded.variable, "font-sans", inter.variable)}
    >
      <body className="antialiased">
        <ClientRoot featureFlags={featureFlags}>{children}</ClientRoot>
      </body>
    </html>
  );
}
