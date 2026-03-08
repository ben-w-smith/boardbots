# Dockerfile for Boardbots Full Stack

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy monorepo configuration
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/engine/package.json ./packages/engine/
COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/engine ./packages/engine
COPY packages/client ./packages/client
COPY packages/server ./packages/server

# Build packages in correct order (engine first, then server/client)
RUN npm run build --workspace=packages/engine && \
    npm run build --workspace=packages/server && \
    npm run build --workspace=packages/client

# Stage 2: Runtime
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/boardbots.db
ENV PORT=3000

# Copy all built packages to maintain monorepo structure
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/engine/package.json ./packages/engine/
COPY --from=builder /app/packages/engine/dist ./packages/engine/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Install production dependencies for server (including engine workspace)
RUN npm install --omit=dev --workspace=packages/server

# Ensure data directory exists
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "packages/server/dist/index.js"]
