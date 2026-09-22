import { Metadata } from "next";
import OutlinePage from "./components/OutlinePage";
import { translate } from "@/i18n/translate";

export const metadata: Metadata = {
  title: translate("outline.metadata.title"),
  description: translate("outline.metadata.description"),
  alternates: {
    canonical: "/create"
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
    "business presentations"
  ]
};

const page = () => {
  return (
    <div className="relative min-h-screen" translate="no">
      <OutlinePage />
    </div>
  );
};

export default page;
