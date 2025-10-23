# Stability & Resource Protection Guide

See docker-compose limits, resource monitor, and .env knobs.

- Recreate: `docker compose up -d --force-recreate collector`
- Monitor: `docker stats bluesky-collector` and `docker logs -f --tail 100 bluesky-collector`
- Env: MAX_QUEUE_SIZE, MEMORY_SOFT_LIMIT_MB, MEMORY_HARD_LIMIT_MB, MEMORY_CHECK_INTERVAL_MS, INGEST_PAUSE_MS
