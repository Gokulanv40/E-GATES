# ==========================================
# Stage 1: Build Frontend (Vite + React)
# ==========================================
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy package manifests and install frontend dependencies
COPY client/package*.json ./
RUN npm install

# Copy frontend source code and build production bundle
COPY client/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Server & Unified Runner
# ==========================================
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (e.g., bcrypt)
RUN apk add --no-cache python3 make g++

# Set environment
ENV NODE_ENV=production
ENV PORT=5002

# Copy backend package manifests and install production dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --only=production

# Copy backend source code
COPY server/ ./

# Copy built frontend from Stage 1 into client/dist
COPY --from=client-builder /app/client/dist /app/client/dist

# Ensure uploads and attachments directories exist
RUN mkdir -p /app/server/uploads /app/data/attachments

# Expose supported server ports
EXPOSE 3000 3001 5002

# Internal healthcheck to keep container active and report status to Easypanel / Docker Swarm
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || wget -qO- http://127.0.0.1:3000/health || exit 1

# Start server
CMD ["node", "src/index.js"]
