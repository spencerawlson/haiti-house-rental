# Kay Ayiti — production image (Next.js standalone server).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Docker sets HOSTNAME to the container id; the standalone server binds to
# HOSTNAME, so pin it or the in-container health check cannot connect.
ENV HOSTNAME=0.0.0.0
# su-exec: drop from root to `node` after fixing upload-folder ownership.
RUN apk add --no-cache su-exec
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
# Uploaded house photos/videos persist here (mount a volume in compose).
RUN mkdir -p public/uploads && chown node:node public/uploads
EXPOSE 3000
# 200 only when Postgres answers and every migration is applied.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
