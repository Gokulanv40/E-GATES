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

# Expose server port (default 5002 or custom 3001)
EXPOSE 3001 5002

# Start server
CMD ["node", "src/index.js"]
