# System Architecture

## Overview

The Bluesky Growth Engine is a Node.js/TypeScript application that automates social media growth strategies for Bluesky accounts. It uses the AT Protocol to interact with the Bluesky network and stores collected data in a Supabase PostgreSQL database.

## High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bluesky API   │    │  Growth Engine   │    │   Supabase DB   │
│  (AT Protocol)  │◄──►│   (Node.js)      │◄──►│  (PostgreSQL)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Frontend UI    │
                    │ (React/Next.js)  │
                    └──────────────────┘
```

## Core Components

### 1. Authentication & Agent Management
- **File**: `src/agent.ts`
- **Purpose**: Creates and manages authenticated BskyAgent instances
- **Key Functions**: Login, session management, rate limiting

### 2. Data Collection Strategies
- **Files**: `src/strategies.ts`, `src/collect-*.ts`, `src/backfill-*.ts`
- **Purpose**: Various approaches to collect user data from Bluesky
- **Strategies**:
  - **User Collection**: Crawls followers/following networks
  - **Engagement Collection**: Gathers likes, reposts, replies data
  - **Backfill Operations**: Historical data collection and migration
  - **Real-time Collection**: Jetstream WebSocket for live data

### 3. Database Layer
- **Files**: `src/supabase.ts`, `src/types/supabase.ts`
- **Purpose**: Database operations and schema management
- **Features**:
  - Standard client (30s timeout)
  - Bulk operations client (5min timeout)
  - TypeScript interfaces for all tables
  - Upsert logic for data deduplication

### 4. Growth Analytics
- **Files**: `src/analytics.ts`, `src/growth-analytics.ts`
- **Purpose**: Analyze collected data and growth metrics
- **Capabilities**: User growth tracking, engagement analysis, network analysis

### 5. API Server
- **File**: `src/api-server.ts`
- **Purpose**: REST API for frontend communication
- **Endpoints**: User data, analytics, configuration

## Data Flow

### Primary Collection Flow
```
1. Environment Config → 2. BskyAgent Auth → 3. Strategy Selection → 4. Data Collection → 5. Supabase Storage
```

### Real-time Flow (Jetstream)
```
1. WebSocket Connection → 2. Event Filtering → 3. Data Processing → 4. Database Upsert → 5. Analytics Update
```

### Frontend Flow
```
1. API Request → 2. Database Query → 3. Data Aggregation → 4. JSON Response → 5. UI Rendering
```

## Module Boundaries

### Core Engine (`src/`)
- **Responsibilities**: Data collection, processing, storage
- **Dependencies**: AT Protocol, Supabase
- **Interface**: Environment variables, CLI

### Frontend (`frontend/`, `frontend-nextjs/`)
- **Responsibilities**: User interface, visualization, controls
- **Dependencies**: React, API server
- **Interface**: REST API

### Database Schema (`supabase/`)
- **Responsibilities**: Data persistence, relationships, security
- **Dependencies**: PostgreSQL, RLS policies
- **Interface**: SQL, Supabase client

## Key Dependencies

### External APIs
- **AT Protocol (`@atproto/api`)**: Bluesky network access
- **Supabase (`@supabase/supabase-js`)**: Database operations
- **Jetstream WebSocket**: Real-time Bluesky events

### Internal Modules
- **Types System**: Centralized TypeScript definitions
- **Configuration**: Environment-based config management
- **Logging**: Structured logging for operations tracking

## Scalability Considerations

### Rate Limiting
- Bluesky API limits: Respected through agent management
- Database connections: Connection pooling via Supabase
- Bulk operations: Chunked processing with timeouts

### Data Volume
- Pagination: All collection strategies support pagination
- Incremental updates: Delta processing for large datasets
- Storage optimization: Efficient database schema design

## Security Architecture

### Authentication
- Bluesky credentials via environment variables
- No credential storage in codebase or database
- Session management through AT Protocol

### Database Security
- Row Level Security (RLS) policies
- Service role for backend operations
- Read-only access for frontend queries

### Environment Isolation
- Development/production environment separation
- Secret management through environment variables
- No hardcoded credentials or sensitive data
