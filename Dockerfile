# Bluesky Growth Engine - Collector & Backfill
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Default command (can be overridden in docker-compose)
CMD ["npx", "tsx", "src/jetstream-ultimate-collector.ts"]
