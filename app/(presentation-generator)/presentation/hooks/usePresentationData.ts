import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/sonner";
import { setPresentationData } from "@/store/slices/presentationGeneration";
import { clearHistory } from "@/store/slices/undoRedoSlice";
import { applyPresentationThemeToElement } from "../utils/applyPresentationThemeDom";
import { normalizeBackendAssetUrls } from "@/utils/api";
import { loadPresentationFonts } from "../../hooks/useFontLoad";
import { DashboardApi } from "../../services/api/dashboard";
import { useT } from "@/i18n/provider";


export const usePresentationData = (
  presentationId: string,
  setLoading: (loading: boolean) => void,
  setError: (error: boolean) => void
) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const t = useT();

  const fetchUserSlides = useCallback(async (options?: { clearHistory?: boolean }) => {
    try {
      const data = await DashboardApi.getPresentation(presentationId, {
        cache: "no-store",
      });

      if (data?.version === "v1-standard") {
        notify.warning(
          t("presentation.data.unsupportedTitle"),
          t("presentation.data.unsupportedDescription")
        );
        setLoading(false);
        router.replace("/dashboard");
        return undefined;
      }

      const normalizedData = normalizeBackendAssetUrls(data);


      if (normalizedData) {
        dispatch(setPresentationData(normalizedData));
        if (options?.clearHistory ?? true) {
          dispatch(clearHistory());
        }
        setLoading(false);
      }
      if (normalizedData.fonts) {
        loadPresentationFonts(normalizedData.fonts);
      }
      if (normalizedData?.theme) {
        const el = document.getElementById("presentation-slides-wrapper");
        applyPresentationThemeToElement(el, normalizedData.theme);
      }
      return normalizedData;
    } catch (error) {
      setError(true);
      notify.error(
        t("presentation.data.loadFailedTitle"),
        t("presentation.data.loadFailedDescription")
      );
      console.error("Error fetching user slides:", error);
      setLoading(false);
      return undefined;
    }
  }, [presentationId, dispatch, router, setLoading, setError, t]);

  return {
    fetchUserSlides,
  };
};
