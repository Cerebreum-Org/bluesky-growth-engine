# Docker Deployment Guide

## Overview

This project provides two Docker setups:

1. **Development** (`docker-compose.yml`): Volume-mounted source, runs with `tsx` for hot-reload
2. **Production** (`docker-compose.prod.yml`): Multi-stage build, optimized images, compiled JavaScript

## Production Deployment

### Prerequisites

- Docker and Docker Compose installed
- External `supabase_default` network (from Supabase setup)
- `.env` file configured (see `.env.example`)

### Build and Run

```bash
# Build the production image
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Monitor resources
docker stats bluesky-collector-prod bluesky-backfill-prod

# Stop services
docker compose -f docker-compose.prod.yml down
```

### Image Details

- **Base**: `node:20-slim`
- **Build**: Multi-stage (builder + production runtime)
- **Size**: ~200-300MB (estimated)
- **Security**: Runs as non-root user (`appuser`)
- **Health checks**: Process monitoring with automatic restarts

### Resource Limits

**Collector**:
- CPU: 2.0 cores (limit), 0.5 cores (reservation)
- Memory: 2GB (limit), 512MB (reservation)

**Backfill**:
- CPU: 1.5 cores (limit), 0.25 cores (reservation)
- Memory: 1GB (limit), 256MB (reservation)

### Environment Variables

Key variables (set in `.env`):

```bash
# Supabase
SUPABASE_URL=http://kong:8000  # Internal Docker network
SUPABASE_SERVICE_ROLE_KEY=your-key

# Memory Management
NODE_OPTIONS="--max-old-space-size=1536 --expose-gc"
MAX_QUEUE_SIZE=10000
MEMORY_SOFT_LIMIT_MB=1500
MEMORY_HARD_LIMIT_MB=1800

# Backfill Sharding
BACKFILL_SHARD=0
BACKFILL_TOTAL_SHARDS=1
```

## Development Setup

For local development with hot-reload:

```bash
# Start development services
docker compose up -d

# View logs
docker compose logs -f collector
```

## Troubleshooting

### Check container health
```bash
docker ps
docker inspect bluesky-collector-prod --format='{{.State.Health.Status}}'
```

### View resource usage
```bash
docker stats --no-stream
```

### Access container shell
```bash
docker exec -it bluesky-collector-prod sh
```

### Rebuild after code changes
```bash
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

## Files

- `Dockerfile` - Development dockerfile (simple, tsx-based)
- `Dockerfile.prod` - Production multi-stage dockerfile
- `docker-compose.yml` - Development compose configuration
- `docker-compose.prod.yml` - Production compose configuration
- `.dockerignore` - Files excluded from Docker build context
