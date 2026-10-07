# Production image: one container serves the API and the built frontend on port 3001.
# Used for Docker-based hosts (Render, Railway, Fly, a VPS). Vercel doesn't use this file.

# ---- build the frontend ----
FROM node:22-alpine AS build
WORKDIR /app
# Baked into the frontend at build time: local | dev | prod (shows a LOCAL/DEV badge outside prod)
ARG VITE_APP_STAGE=prod
ENV VITE_APP_STAGE=$VITE_APP_STAGE
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${PORT:-3001}/api/health || exit 1
CMD ["node", "server/index.js"]
