#!/bin/bash

# Database Performance Monitoring Script
# Usage: ./scripts/db_monitoring.sh [command]
#
# Commands:
#   slow-queries    - Show queries averaging over 100ms
#   index-usage     - Show index usage statistics
#   unused-indexes  - Show indexes that are never used
#   table-stats     - Show table access patterns
#   bloat          - Show table bloat estimates
#   reset-stats    - Reset query statistics
#   all            - Show all monitoring info

CONTAINER="supabase-db"
DB_USER="postgres"
DB_NAME="postgres"

function run_query() {
    docker exec $CONTAINER psql -U $DB_USER $DB_NAME -c "$1"
}

function show_slow_queries() {
    echo "=== Slow Queries (avg > 100ms) ==="
    run_query "SELECT * FROM slow_queries LIMIT 10;"
}

function show_index_usage() {
    echo "=== Index Usage Statistics ==="
    run_query "SELECT * FROM index_usage_stats WHERE table_name LIKE 'bluesky_%' LIMIT 20;"
}

function show_unused_indexes() {
    echo "=== Unused Indexes ==="
    run_query "SELECT * FROM unused_indexes;"
}

function show_table_stats() {
    echo "=== Table Access Patterns ==="
    run_query "SELECT * FROM table_access_patterns WHERE table_name LIKE 'bluesky_%';"
}

function show_bloat() {
    echo "=== Table Bloat Estimates ==="
    run_query "SELECT * FROM table_bloat_estimate LIMIT 10;"
}

function reset_stats() {
    echo "Resetting query statistics..."
    run_query "SELECT pg_stat_statements_reset();"
    run_query "SELECT pg_stat_reset();"
    echo "Statistics reset complete."
}

function show_query_performance() {
    echo "=== Top Queries by Execution Time ==="
    run_query "SELECT * FROM query_performance_summary LIMIT 10;"
}

function show_cache_hit_ratio() {
    echo "=== Database Cache Hit Ratio ==="
    run_query "
    SELECT 
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit)  as heap_hit,
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
    FROM pg_statio_user_tables;
    "
}

case "${1:-all}" in
    slow-queries)
        show_slow_queries
        ;;
    index-usage)
        show_index_usage
        ;;
    unused-indexes)
        show_unused_indexes
        ;;
    table-stats)
        show_table_stats
        ;;
    bloat)
        show_bloat
        ;;
    reset-stats)
        reset_stats
        ;;
    queries)
        show_query_performance
        ;;
    cache)
        show_cache_hit_ratio
        ;;
    all)
        show_query_performance
        echo ""
        show_slow_queries
        echo ""
        show_index_usage
        echo ""
        show_table_stats
        echo ""
        show_cache_hit_ratio
        ;;
    *)
        echo "Unknown command: $1"
        echo "Usage: $0 [slow-queries|index-usage|unused-indexes|table-stats|bloat|reset-stats|queries|cache|all]"
        exit 1
        ;;
esac
