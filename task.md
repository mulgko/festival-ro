# Festival Course App Tasks

## Goal

Build the app as a real fullstack portfolio project using local Supabase in Docker first, with migrations and scripts that can be pushed to Supabase Cloud later.

## Current Decision

- Use local Supabase via Docker for development.
- Keep schema in `supabase/migrations`.
- Keep repeatable data setup in SQL seeds or scripts.
- Keep secrets in environment files only.
- Treat Supabase Cloud as a later deployment target, not a separate rebuild.

## Phase 1: Local Supabase Foundation

- [x] Initialize local Supabase project files.
- [x] Add schema migration for core public content tables.
- [x] Add schema migration for saved course tables.
- [x] Add RLS policies for public read and authenticated course ownership.
- [x] Add seed or fixture strategy for local development.
- [x] Add `.env.local.example` with local Supabase variables.
- [x] Verify local stack startup with `supabase start`.
  - Verified from local terminal on 2026-04-29. Migration `20260429043000_initial_schema.sql` applied and seed ran.
  - Codex sandbox note: Docker socket access is still blocked here with `operation not permitted`, so Docker commands need to be run from the local terminal.

## Phase 2: TourAPI Data Sync

- [x] Add TourAPI client helper.
- [x] Add festival sync script using `searchFestival2`.
- [x] Normalize TourAPI festival rows into `contents` and `festival_meta`.
- [x] Add sync logging with `sync_runs`.
- [x] Add dry-run mode for safe API testing.
- [x] Document required env vars: `GOV_DATA_KEY`, Supabase URL/key.
  - See `.env.local.example`. The sync script also checks `/Users/dk/projects/.env.shared` when a key is not present in the project env files.
  - Codex sandbox note: outbound DNS to `apis.data.go.kr` fails with `ENOTFOUND`, and localhost Supabase calls fail with `EPERM`; run sync verification from the local terminal.
- [x] Apply and verify direct local DB ingestion.
  - The sync script writes through the Supabase DB Docker container as `postgres`, so it does not need public REST write policies.
  - Verified 2026-04-30: 100 festival rows in `public.contents` (content_type_id=15), all with map_x/map_y populated.

## Phase 3: Nearby Place Precompute

- [x] Add nearby place sync using `locationBasedList2`.
- [x] Fetch content types: `12` tourist spots, `39` restaurants, `32` stays.
- [x] Upsert nearby places into `contents`.
- [x] Insert festival-place links into `nearby_places`.
- [x] Store distance and ranking score.
- [x] Add per-festival limit to avoid API quota burn.
- [x] Run dry-run verification with `npm run sync:nearby -- --festival-limit=5 --radius=5000 --rows=20`.
  - Verified 2026-04-30: 140 unique nearby places and 140 festival-place links from 5 festivals.
  - Removed unsupported `listYN` parameter from `locationBasedList2` request after TourAPI returned `INVALID_REQUEST_PARAMETER_ERROR(listYN)`.
- [x] Apply nearby data with `npm run sync:nearby:apply -- --festival-limit=5 --radius=5000 --rows=20`.
  - Verified 2026-04-30: upserted 140 nearby places and 140 festival-place links into local Supabase.

## Phase 4: App Data Integration

- [ ] Replace hardcoded festival list with Supabase data.
- [ ] Replace hardcoded course places with `nearby_places`.
- [ ] Keep the current UI layout while changing the data source.
- [ ] Add loading, empty, and error states.
- [ ] Preserve the existing SVG map fallback until Kakao Map integration.

## Phase 5: Course Generator V1

- [ ] Implement basic course-generation service.
- [ ] Select Day 1 and Day 2 candidates by category and distance.
- [ ] Score by distance, category diversity, image presence, and address quality.
- [ ] Save generated courses to `courses` and `course_items`.
- [ ] Add public share token support.

## Phase 6: Later Cloud Migration

- [ ] Create Supabase Cloud project.
- [ ] Replace local Docker DB ingestion with production-safe cloud ingestion access.
- [ ] Link project with Supabase CLI.
- [ ] Push migrations to cloud.
- [ ] Run TourAPI sync against cloud.
- [ ] Update Vercel environment variables.
- [ ] Deploy and verify production read/write paths.

## Immediate Next Task

Start Phase 4 app data integration by replacing the hardcoded festival and course-place data with local Supabase reads while preserving the current UI layout.
