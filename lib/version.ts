import packageJson from "@/package.json";

export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  (typeof window !== "undefined" ? window.env?.APP_VERSION : undefined) ||
  `v${packageJson.version}`;
