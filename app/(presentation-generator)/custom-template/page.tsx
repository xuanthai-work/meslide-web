import { redirect } from "next/navigation";
import CustomTemplatePage from "./CustomTemplatePage";

const PERSONAL_TEMPLATES_ENABLED = false;

export default function Page() {
  if (!PERSONAL_TEMPLATES_ENABLED) redirect("/templates");
  return <CustomTemplatePage />;
}
