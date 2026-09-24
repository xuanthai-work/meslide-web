import { resolveBackendAssetUrl } from "./api";

/**
 * Normalizes DOM image URLs through the shared backend asset resolver.
 * Keeps web on same-origin proxy paths so NextJS image optimization works.
 */
function convertImageElement(img: HTMLImageElement) {
  if (!img.src) return;
  img.src = resolveBackendAssetUrl(img.src);
}

export function convertImageUrlsForEnvironment(root?: ParentNode) {
  if (typeof document === "undefined") return;
  const scope = root ?? document;

  if (scope instanceof HTMLImageElement) convertImageElement(scope);
  scope.querySelectorAll("img[src]").forEach((img) => {
    convertImageElement(img as HTMLImageElement);
  });
}

/**
 * Setup a MutationObserver to automatically convert any dynamically added images
 */
export function setupImageUrlConverter() {
  convertImageUrlsForEnvironment();
  
  // Watch for dynamically added images
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          convertImageUrlsForEnvironment(element);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  return observer;
}
