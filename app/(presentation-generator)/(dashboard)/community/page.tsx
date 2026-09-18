import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import CommunityPage from "./components/CommunityPage";
import { translate } from "@/i18n/translate";
import { getServerFeatureFlags } from "@/lib/server-feature-flags";

export const metadata: Metadata = {
  title: translate("community.metadata.title"),
  description: translate("community.metadata.description"),
};

export default async function Page() {
  await connection();
  if (!getServerFeatureFlags().communityEnabled) {
    redirect("/dashboard");
  }
  return <CommunityPage />;
}
