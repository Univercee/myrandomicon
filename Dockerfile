FROM node:24-slim AS base
WORKDIR /app
# toolchain only as a fallback if a native module has no prebuilt binary
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.ts ./
COPY server ./server
COPY web ./web
RUN npm run build

FROM node:24-slim
ENV NODE_ENV=production DATA_DIR=/app/data
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web-dist ./web-dist
COPY package.json ./
# pre-create so a named volume inherits node ownership
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
