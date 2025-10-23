## 2025-10-23 — Current Focus


### Stability & Reliability
- [x] Add Docker limits (mem 2GiB, cpus 2), healthcheck, logging caps
- [x] Integrate backpressure (resource-monitor) and event dropping; user dedupe
- [x] Expose resource env knobs in .env.example; add STABILITY_GUIDE.md
- [ ] Monitor backpressure frequency and tune MAX_QUEUE_SIZE / MEMORY_* (ongoing)
- [ ] Ensure WSL2 .wslconfig is applied on Windows (run `wsl --shutdown`)
- [ ] Remove deprecated `version:` key from docker-compose.yml (warning)

### TypeScript Cleanup
- [ ] Fix missing types: install @types/express, @types/cors, @types/pg (dev)
- [ ] Decide: exclude `src/archive/` from `tsconfig.json` or fix types there
- [ ] Address Result type misuse in startup-validator.ts and supabase-enhanced.ts
- [ ] Fix Firehose options (idResolver) in firehose-collector.ts
- [ ] Re-run `npm run typecheck` until 0 errors (currently 114 in 23 files)

### Refactoring Targets (>300 lines)
- [ ] Extract handlers from src/jetstream-ultimate-collector.ts
- [ ] Refactor backfill-social-graph.ts (663 lines)
- [ ] Extract strategies from collect-follows-dynamic.ts
- [ ] Split growth-analytics.ts by analytics type

### Documentation & Ops
- [ ] Keep docs/status.md updated after each meaningful change (use dated Update blocks)
- [ ] Add minimal CI: typecheck + lint on PR
- [ ] Add log markers for backpressure start/stop counts

# Tasks

## Backlog
- Refactor `src/strategies.ts` into feature-focused modules (follow, likes, analytics)
- Split `src/backfill-social-graph*.ts` by responsibility (fetch, persist, checkpoints)
- Extract Jetstream collectors into reusable utilities (WS mgmt, retry, filters)
- Add root Vitest + basic unit tests for Supabase helpers and rate limit utils
- Add CI job: lint + typecheck
- Document API endpoints in `src/api-server.ts` (README section)

## In Progress
- Warp rules compliance baseline (docs/env/gitignore)

## Done
- Documentation scaffolding created

- Created strategies wrappers (follow/mentions/collect); move implementations next.
- Created strategies wrappers (follow/mentions/collect); move implementations next.

## Completed (Warp ACT phase)
- ESLint scoped and hardened
- api-server.ts and proxy-collector.ts lint/type errors fixed
- Strategies wrappers scaffolded

## Phase 2 Completed
- ✓ Security sweep passed
- ✓ Vitest + example tests added
- ✓ strategies.ts modularized (retry, follow, mentions extracted)

## Next Priority
- ATProto type fixes (179 errors in jetstream collectors)
  - Option A: Add type assertions with @ts-expect-error + explanatory comments
  - Option B: Create proper ATProto record interfaces
  - Option C: Update @atproto packages to latest versions
- Refactor remaining large files:
  - backfill-social-graph.ts (663 lines)
  - jetstream-ultimate-collector.ts (559 lines)

## Phase 3 Completed  
- ✓ ATProto type errors resolved (179 → 9 errors)
- ✓ All jetstream collectors working with type assertions

## Next: Large File Refactoring
Target files >300 lines:
1. backfill-social-graph.ts (663 lines) → extract config, fetch, persist modules
2. jetstream-ultimate-collector.ts (570 lines) → extract event handlers 
3. collect-follows-dynamic.ts (546 lines) → extract collection strategies
4. growth-analytics.ts (385 lines) → extract analytics modules

Remaining QuotePostCollector errors (9 total) - low priority interface mismatches

## FINAL PHASE COMPLETED ✅
- ✅ All TypeScript errors resolved (0 errors)
- ✅ Lint warnings reduced (catch variables fixed)
- ✅ Continued refactoring (backfill modules)
- ✅ All tests passing

## PROJECT COMPLETE 🎉
No remaining critical or high-priority tasks. 
Optional future improvements documented above.

## Elite Engineering Practices Specification ✅

### Completed
- ✅ Created comprehensive 586-line specification document
- ✅ Analyzed world-class patterns from Netflix, Google, Stripe, etc.
- ✅ Designed 3-phase implementation roadmap
- ✅ Specified technical details, dependencies, success metrics

### Ready for Implementation
**Phase 1** (Weeks 1-2): Foundation & Reliability
- Structured logging system
- Result types for error handling
- Circuit breakers for external APIs

**Phase 2** (Weeks 3-4): Testing Excellence  
- Test pyramid implementation
- Property-based testing
- Automated quality gates

**Phase 3** (Weeks 5-6): Architecture Evolution
- Clean/Hexagonal architecture
- Advanced monitoring & metrics
- Enhanced developer experience

### Decision Point
Review docs/elite-engineering-spec.md and approve implementation phases.

## Right-Sized Engineering Practices ✅

### Completed Analysis
- ✅ Created reality-based assessment document
- ✅ Identified overkill patterns for personal project scale
- ✅ Prioritized high-impact, low-complexity improvements
- ✅ Clear 2-week implementation timeline (14 hours total)

### Implementation Priority
**Phase 1: Reliability Fundamentals** (Week 1, 8 hours)
1. Result types for error handling (3h)
2. Circuit breakers for external APIs (4h)
3. Better logging with context (1h)

**Phase 2: Confidence & Config** (Week 2, 6 hours)  
4. Config management system (2h)
5. Integration tests for main workflows (4h)

### Skip List (Confirmed Overkill)
- ❌ Distributed tracing (single process)
- ❌ Complex architecture (adds unnecessary layers)
- ❌ Enterprise observability (console logs sufficient)
- ❌ Property-based testing (high setup cost, low ROI)
- ❌ Advanced CI/CD (GitHub Actions fine)

### Decision Point
Begin with Result types implementation - highest ROI for time invested.

## Task Tracker (8-step plan)
- [x] Analyze current Jetstream collectors
- [x] Analyze current backfill scripts
- [x] Design comprehensive data collection strategy
- [x] Enhance Jetstream collector for comprehensive capture — completed (handlers+storage for generator/threadgate/starterpack/labeler, enrichment tables, quote chains)
- [ ] Enhance backfill scripts for comprehensive historical data- [x] Integrate reliability patterns into collectors
- [ ] Test enhanced collection systems
- [ ] Document collection capabilities
