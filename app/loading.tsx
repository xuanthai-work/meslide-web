import { GSlideSplashLoader } from "@/components/gslide";
import { translate } from "@/i18n/translate";

export default function Loading() {
  return <GSlideSplashLoader message={translate("loading.splash")} />;
}