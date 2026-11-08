# Trident Admin — standalone image. Build context: this directory (the
# assembled distribution, with the SDK vendored in ./sdk).
#
#   docker build -t trident-admin .
#   docker build -t trident-admin --build-arg NEXT_PUBLIC_BASE_PATH=/trident-admin .

FROM node:22-alpine AS deps
WORKDIR /app
COPY sdk/package.json sdk/package-lock.json sdk/tsconfig.json ./sdk/
COPY sdk/src ./sdk/src
RUN cd sdk && npm ci && npm run build
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
# basePath is baked in at build time by Next.js.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app ./
COPY next.config.js postcss.config.js tsconfig.json ./
COPY src ./src
RUN if [ -n "$NEXT_PUBLIC_BASE_PATH" ]; then \
      node -e "const fs=require('fs');const c=fs.readFileSync('next.config.js','utf8');fs.writeFileSync('next.config.js',c.replace(\"output: 'standalone'\",\"basePath: '\"+process.env.NEXT_PUBLIC_BASE_PATH+\"',\\n  output: 'standalone'\"));"; \
    fi
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4001 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# The admin and its bundled SDK are MIT; ship the notices with the image.
COPY --chown=nextjs:nodejs LICENSE ./LICENSE
COPY --chown=nextjs:nodejs sdk/LICENSE ./LICENSE.sdk

USER nextjs
EXPOSE 4001
CMD ["node", "server.js"]
