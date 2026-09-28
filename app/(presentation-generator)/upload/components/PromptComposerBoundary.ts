import { createContext, type RefObject } from "react";

/**
 * Drop target for the attachment control rendered inside the upload composer.
 *
 * `OutlineComposer` owns the visible boxes and provides a ref to its wrapper;
 * `SupportingDoc` reads it so a file dropped anywhere on the composer attaches
 * instead of only landing on the attachment row. A null value means the
 * control is rendered outside a composer and owns its own drop handlers.
 */
export const PromptComposerBoundaryContext =
  createContext<RefObject<HTMLDivElement | null> | null>(null);
