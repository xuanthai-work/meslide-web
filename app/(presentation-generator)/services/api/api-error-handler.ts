import { readOkResponseBody, statusFallbackMessage } from "@/lib/api-response-contract";
import {
  extractApiErrorMessage,
  type ApiErrorResponse,
} from "@/utils/apiErrorMessages";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly params?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// API Response Handler Utility
export class ApiResponseHandler {
  static async handleResponse(response: Response, defaultErrorMessage: string): Promise<any> {
    // Handle successful responses
    if (response.ok) {
      return readOkResponseBody(response.status, () => response.json());
    }

    // Handle error responses
    let errorMessage = defaultErrorMessage;
    let errorCode: string | undefined;
    let errorParams: Record<string, unknown> | undefined;

    try {
      const errorData: ApiErrorResponse = await response.json();
      errorCode = typeof errorData.error_code === "string" ? errorData.error_code : undefined;
      errorParams = errorData.error_params;
      errorMessage = extractApiErrorMessage(
        errorData,
        defaultErrorMessage,
        response.status
      );
    } catch {
      // If JSON parsing fails, use status-based messages
      errorMessage = statusFallbackMessage(response.status, defaultErrorMessage);
    }

    // Throw error with appropriate message
    throw new ApiError(errorMessage, errorCode, errorParams);
  }


  static async handleResponseWithResult(response: Response, defaultErrorMessage: string): Promise<{success: boolean, message?: string}> {
    try {
      // Handle successful responses
      if (response.ok) {
        return { success: true };
      }

      // Handle error responses
      let errorMessage = defaultErrorMessage;

      try {
        const errorData: ApiErrorResponse = await response.json();
        errorMessage = extractApiErrorMessage(
          errorData,
          defaultErrorMessage,
          response.status
        );
      } catch {
        // If JSON parsing fails, use status-based messages
        errorMessage = statusFallbackMessage(response.status, defaultErrorMessage);
      }

      return {
        success: false,
        message: errorMessage,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : defaultErrorMessage,
      };
    }
  }
}

export type { ApiErrorResponse };
