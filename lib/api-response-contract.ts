/** Body of a successful API response. 204 and unparseable JSON stay as they are today. */
export async function readOkResponseBody(
  status: number,
  readJson: () => Promise<unknown>,
): Promise<unknown> {
  if (status === 204) return true;
  try {
    return await readJson();
  } catch {
    return {};
  }
}

export function statusFallbackMessage(status: number, defaultMessage: string): string {
  switch (status) {
    case 400:
      return "Bad request. Please check your input and try again.";
    case 401:
      return "Unauthorized. Please log in and try again.";
    case 403:
      return "Access forbidden. You don't have permission to perform this action.";
    case 404:
      return "Resource not found. The requested item may have been deleted or moved.";
    case 409:
      return "Conflict. The resource already exists or there's a conflict with the current state.";
    case 422:
      return "Validation error. Please check your input and try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "Internal server error. Please try again later.";
    case 502:
      return "Bad gateway. The server is temporarily unavailable.";
    case 503:
      return "Service unavailable. Please try again later.";
    case 504:
      return "Gateway timeout. The request took too long to process.";
    default:
      return defaultMessage;
  }
}
