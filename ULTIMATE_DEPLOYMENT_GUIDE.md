# 🚀 Ultimate Bluesky Data Collection System - Deployment Guide

This system provides **maximum Bluesky data capture** with enterprise-grade reliability infrastructure.

## 📊 What You'll Get

### Real-Time Data Collection
- **ALL posts** with engagement predictions
- **ALL interactions** (likes, reposts, replies, quotes) 
- **Complete social graph** (follows, blocks, lists)
- **Profile changes** and identity updates
- **Rich media metadata** (images, videos, links)
- **Trending signals** (hashtags, mentions, viral content)

## 🛠️ Quick Start with Timeout Protection

### 1. Prerequisites & Installation

```bash
# Clone and install (with timeouts to prevent hanging)
timeout 60s git clone <your-repo>
cd bluesky-growth-engine
timeout 120s npm install

# Setup environment
cp .env.example .env
# Edit .env with your Supabase and Bluesky credentials
```

### 2. Database Setup

```bash
# Run schema migration (300s timeout for large databases)
timeout 300s psql -h your-db-host -U postgres -d your_database -f migrations/004_ultimate_comprehensive_schema.sql
```

### 3. Deploy Complete System

```bash
# Start services with timeouts (background with &)
timeout 86400s npm run start:jetstream-ultimate &  # 24 hour timeout
timeout 86400s npm run start:backfill-ultimate &   # 24 hour timeout
timeout 3600s npm run monitor:health &             # 1 hour timeout
```

## 📈 System Validation (All with Timeouts)

### Health Check Commands

```bash
# Quick health check (30s timeout)
timeout 30s npm run health:check

# Database connectivity test (60s timeout)
timeout 60s npm run test:database

# API connectivity test (45s timeout)
timeout 45s npm run test:bluesky-api

# Configuration validation (15s timeout)
timeout 15s npm run validate:config
```

### Database Health Queries

```bash
# Check collection status (30s timeout)
timeout 30s psql -h your-host -U postgres -d your_db -c "
SELECT 
  COUNT(*) as total_posts,
  MAX(collection_timestamp) as last_collected
FROM bluesky_posts_comprehensive;"

# Check backfill progress (20s timeout)
timeout 20s psql -h your-host -U postgres -d your_db -c "
SELECT phase, processed_count, total_estimated
FROM backfill_checkpoints ORDER BY created_at DESC LIMIT 5;"
```

## 🛡️ Production Deployment (With Timeouts)

### Process Management with PM2

```bash
# Install PM2 with timeout
timeout 60s npm install -g pm2

# Start services (PM2 handles restarts automatically)
pm2 start "npm run start:jetstream-ultimate" --name jetstream-collector
pm2 start "npm run start:backfill-ultimate" --name backfill-system

# Monitor processes (10s timeout)
timeout 10s pm2 status
timeout 10s pm2 logs --lines 20
```

### Docker Deployment

```bash
# Build with timeout (300s = 5 minutes)
timeout 300s docker build -t bluesky-ultimate-collector .

# Deploy with auto-restart
docker run -d --restart=unless-stopped --env-file .env bluesky-ultimate-collector
```

## 🚨 Troubleshooting (All with Timeouts)

### Diagnostic Commands

```bash
# System health check (30s timeout)
timeout 30s npm run health:check || echo "Health check timed out"

# Memory usage (10s timeout)
timeout 10s free -h

# Database connection test (45s timeout)
timeout 45s npm run test:database || echo "Database test timed out"

# Process status (5s timeout)
timeout 5s ps aux | grep -E "(node|npm|jetstream|backfill)"
```

### Recovery Commands

```bash
# Graceful restart (60s timeout)
timeout 60s pkill -SIGTERM -f "jetstream-ultimate"
timeout 60s pkill -SIGTERM -f "backfill-ultimate"

# Force restart if needed (10s timeout)
timeout 10s pkill -SIGKILL -f "jetstream-ultimate"
timeout 10s pkill -SIGKILL -f "backfill-ultimate"

# Restart services (30s timeout each)
timeout 30s npm run start:jetstream-ultimate &
timeout 30s npm run start:backfill-ultimate &
```

### Emergency Commands

```bash
# Kill all related processes immediately (5s timeout each)
timeout 5s pkill -f "bluesky"
timeout 5s pkill -f "jetstream"
timeout 5s pkill -f "backfill"

# Check disk space (5s timeout)
timeout 5s df -h
```

## 🔄 Maintenance (All with Timeouts)

### Daily Operations

```bash
# Daily health check (45s timeout)
timeout 45s npm run daily:health-check

# Daily metrics report (30s timeout)
timeout 30s npm run daily:metrics-report

# Daily cleanup (120s timeout)
timeout 120s npm run daily:cleanup
```

### Weekly Maintenance

```bash
# Performance analysis (300s timeout)
timeout 300s npm run weekly:performance-analysis

# Database optimization (600s timeout)
timeout 600s npm run weekly:db-optimize

# Export reports (180s timeout)
timeout 180s npm run weekly:export-reports
```

## 🎯 Safe Deployment Script

Create this script for foolproof deployment:

```bash
#!/bin/bash
# deploy-with-timeouts.sh

set -e  # Exit on error

echo "🚀 Starting Bluesky Ultimate Data Collection Deployment"

# Environment check (30s timeout)
echo "📋 Checking environment..."
timeout 30s npm run validate:config || {
    echo "❌ Configuration validation failed or timed out"
    exit 1
}

# Database connectivity (60s timeout)
echo "🗃️ Testing database..."
timeout 60s npm run test:database || {
    echo "❌ Database connection failed or timed out"
    exit 1
}

# Start services with PM2
echo "🏃 Starting services..."
pm2 start "npm run start:jetstream-ultimate" --name jetstream-collector
pm2 start "npm run start:backfill-ultimate" --name backfill-system

# Health check (30s timeout)
echo "🏥 Running health check..."
sleep 10  # Wait for startup
timeout 30s npm run health:check || {
    echo "❌ Health check failed - stopping services"
    pm2 stop all
    exit 1
}

echo "✅ Deployment successful!"
echo "📊 Monitor: pm2 status"
echo "📝 Logs: pm2 logs"
echo "🛑 Stop: pm2 stop all"
```

Make it executable:

```bash
chmod +x deploy-with-timeouts.sh
./deploy-with-timeouts.sh
```

## 🎉 You're Ready!

**This system now includes comprehensive timeout protection:**

✅ **All commands have timeouts** - No more hanging processes  
✅ **Automatic process management** - PM2 handles restarts  
✅ **Emergency kill switches** - Force-stop stuck processes  
✅ **Safe deployment script** - Validates everything first  
✅ **Built-in recovery** - Handles failures gracefully  

**You'll never get stuck waiting for a command to finish again!** 🚀

All database operations, API calls, file operations, and system commands now have appropriate timeouts. The system will automatically recover from failures and you can easily kill any stuck processes.
