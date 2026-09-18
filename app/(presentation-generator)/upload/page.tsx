import UploadPage from "./components/UploadPage";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { Metadata } from "next";
import { translate } from "@/i18n/translate";

export const metadata: Metadata = {
  title: translate("upload.metadata.title"),
  description: translate("upload.metadata.description"),
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
    "smart presentation tool",
    "business presentations",
  ],
  openGraph: {
    title: translate("upload.metadata.createTitle"),
    description: translate("upload.metadata.description"),
    type: "website",
    url: "/create",
    siteName: "GSlide",
  },
  twitter: {
    card: "summary_large_image",
    title: translate("upload.metadata.createTitle"),
    description: translate("upload.metadata.description"),
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
