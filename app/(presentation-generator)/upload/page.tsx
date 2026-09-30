import UploadPage from "./components/UploadPage";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "GSlide | Trình tạo bài thuyết trình AI",
  description: "Biến lời nhắc hoặc tài liệu thành bài thuyết trình bằng AI.",
  alternates: {
    canonical: "/create",
  },
  keywords: [
    "presentation generator",
    "AI presentations",
    "data visualization",
    "automatic presentation maker",
    "professional slides",
    "data-driven presentations",
    "document to presentation",
    "presentation automation",
    "AI presentation tool",
    "business presentations",
  ],
  openGraph: {
    title: "Tạo bài thuyết trình dữ liệu | GSlide",
    description: "Biến lời nhắc hoặc tài liệu thành bài thuyết trình bằng AI.",
    type: "website",
    url: "/create",
    siteName: "GSlide",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tạo bài thuyết trình dữ liệu | GSlide",
    description: "Biến lời nhắc hoặc tài liệu thành bài thuyết trình bằng AI.",
  },
};

const page = () => {
  return (
    <div className="relative min-h-dvh">
      <Header />
      <UploadPage />
    </div>
  );
};

export default page;
