import "server-only";

import { resolveFeatureFlags } from "./feature-flags";

/**
 * Owner: GSlide presentation maintainers.
 * Review by: 2026-12-31. Retention is intentional; the review decides whether
 * to enable a CI/product lane more broadly, not whether to delete legacy reads.
 */
export const getServerFeatureFlags = () => resolveFeatureFlags(process.env);
