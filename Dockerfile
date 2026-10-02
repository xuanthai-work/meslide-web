# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS nextjs-builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . /app
RUN npm run build \
    && rm -rf .next-build/cache


FROM node:20-bookworm-slim
ARG CI_PROJECT_URL
LABEL org.opencontainers.image.source=$CI_PROJECT_URL
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=nextjs-builder /app/.next-build/standalone/ /app/
COPY --from=nextjs-builder /app/public /app/public
COPY --from=nextjs-builder /app/.next-build/static /app/.next-build/static

# Tạo sẵn thư mục cache cho Next.js Image Optimization và cấp quyền ghi
RUN mkdir -p /app/.next-build/cache && chmod -R 777 /app/.next-build/cache

EXPOSE 3000
CMD ["node", "server.js"]