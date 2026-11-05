# Multi-stage Dockerfile optimized for Coolify and production deployment
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies with legacy-peer-deps to prevent peer resolution conflicts
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code and build client SPA
COPY . .
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies and local tsx runtime
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm install tsx --legacy-peer-deps

# Copy built frontend assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
