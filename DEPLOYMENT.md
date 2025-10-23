# Bluesky Growth Engine - Deployment Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Supabase instance
- 4GB+ RAM

### Deploy
1. Clone repo and copy .env.example to .env
2. Edit .env with credentials
3. Run: docker compose up -d collector backfill

## Monitor
- Health: docker logs -f collector | grep HEALTH
- Progress: docker logs -f backfill | grep Stats

## Components
- Collector: Live firehose, 0% data loss
- Backfill: Historical enrichment, 600-1200 users/min

## Backup
docker exec supabase-db pg_dump -U postgres postgres > backup.sql
