import path from "node:path";
import { fileURLToPath } from "node:url";

const nextjsRoot = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: false,
  distDir: isProd ? ".next-build" : ".next",
  ...(isProd ? { output: "standalone" } : {}),
  // proxy.ts rewrites /api/v1 uploads to FastAPI. Next.js buffers that body
  // and defaults to 10MB, which truncates PPTX/docs the product allows up to
  // 100MB. Leave headroom for multipart boundaries around the file field.
  // Template preview (PPTX→HTML→Chromium screenshots) regularly exceeds the
  // default 30s proxy timeout on a 26-slide deck.
  experimental: {
    proxyClientMaxBodySize: "110mb",
    proxyTimeout: 15 * 60 * 1000,
  },
  turbopack: {
    root: nextjsRoot,
  },
  ...(!isProd
    ? {
        allowedDevOrigins: [
          "127.0.0.1",
          "localhost",
          // Chromium in the api container opens http://web:3000/pdf-maker.
          "web",
        ],
      }
    : {}),

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && config.output) {
      // Dev webpack compiles large layout chunks on first request; Docker bind
      // mounts on Windows can exceed the default 120s chunk load timeout.
      config.output.chunkLoadTimeout = 300_000;
    }
    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7c765f3726084c52bcd5d180d51f1255.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pptgen-public.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "pptgen-public.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "img.icons8.com",
      },
      {
        protocol: "https",
        hostname: "present-for-me.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "yefhrkuqbjcblofdcpnr.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
    ],
  },
  
};

export default nextConfig;
