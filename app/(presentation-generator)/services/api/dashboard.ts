import {
  getHeader,
} from "@/app/(presentation-generator)/services/api/header";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import type { Slide } from "@/app/(presentation-generator)/types/slide";
import { getApiUrl } from "@/utils/api";
import {
  presentationDeletePath,
  presentationDuplicatePath,
  presentationsListPath,
} from "./dashboard-list";

export type PresentationVersion = "v1-standard" | "v2-standard";

export interface PresentationResponse {
  id: string;
  version?: PresentationVersion;
  title: string;
  created_at: string;
  updated_at: string;
  data: unknown | null;
  file: string;
  n_slides: number;
  prompt: string;
  summary: string | null;
  theme: Record<string, unknown> | null;
  titles: string[];
  user_id: string;
  vector_store: unknown;

  thumbnail: string;
  layout?: unknown;
  structure?: unknown;
  components?: unknown;
  fonts?: unknown;
  slides: Slide[];
}

export class DashboardApi {

  static async getPresentations(
    version?: PresentationVersion,
    options?: { includeSlides?: boolean }
  ): Promise<PresentationResponse[]> {
    try {
      const response = await fetch(
        getApiUrl(presentationsListPath(version, options)),
        {
          method: "GET",
        }
      );

      // Handle the special case where 404 means "no presentations found"
      if (response.status === 404) {
        console.log("No presentations found");
        return [];
      }

      return await ApiResponseHandler.handleResponse(response, "Failed to fetch presentations");
    } catch (error) {
      console.error("Error fetching presentations:", error);
      throw error;
    }
  }

  static async getPresentation(
    id: string,
    options?: { cache?: RequestCache }
  ) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/${id}`),
        {
          method: "GET",
          credentials: "include",
          cache: options?.cache,
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Presentation not found");
    } catch (error) {
      console.error("Error fetching presentation:", error);
      throw error;
    }
  }

  static async deletePresentation(presentation_id: string) {
    try {
      const response = await fetch(
        getApiUrl(presentationDeletePath(presentation_id)),
        {
          method: "DELETE",
          headers: getHeader(),
        }
      );

      return await ApiResponseHandler.handleResponseWithResult(response, "Failed to delete presentation");
    } catch (error) {
      console.error("Error deleting presentation:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete presentation",
      };
    }
  }

  static async duplicatePresentation(presentation_id: string) {
    try {
      const response = await fetch(
        getApiUrl(presentationDuplicatePath(presentation_id)),
        {
          method: "POST",
          headers: getHeader(),
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to duplicate presentation");
    } catch (error) {
      console.error("Error duplicating presentation:", error);
      throw error;
    }
  }
}
