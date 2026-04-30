#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2";
const DEFAULT_START_DATE = "20260501";
const DEFAULT_ROWS = 100;
const LOCAL_DB_CONTAINER = "supabase_db_festival-course-app";

loadEnv(".env.local");
loadEnv(".env");
loadEnv("../../../.env.shared");

main().catch((error) => {
  console.error(error.message);
  if (error.cause?.code) console.error(`Cause: ${error.cause.code}`);
  if (error.cause?.message) console.error(`Detail: ${error.cause.message}`);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const eventStartDate = String(args.start || DEFAULT_START_DATE);
  const rows = Number(args.rows || DEFAULT_ROWS);
  const pages = Number(args.pages || 1);

  requireEnv("GOV_DATA_KEY");
  if (args.debugKey) {
    printKeyDebug(process.env.GOV_DATA_KEY);
    return;
  }
  const items = [];
  for (let page = 1; page <= pages; page += 1) {
    const pageItems = await fetchFestivalPage({ eventStartDate, rows, page });
    items.push(...pageItems);
    if (pageItems.length < rows) break;
  }

  const normalized = items.map(normalizeFestival).filter(Boolean);
  console.log(`Fetched ${items.length} rows, normalized ${normalized.length} festivals.`);

  if (!apply) {
    console.log("Dry run only. Pass --apply to upsert into local Supabase.");
    console.log(JSON.stringify(normalized.slice(0, 3), null, 2));
    return;
  }

  const contents = normalized.map(({ content, raw }) => ({ ...content, raw }));
  const metas = normalized.map(({ meta, raw }) => ({ ...meta, raw }));
  const sql = buildFestivalUpsertSql({
    syncRunId: crypto.randomUUID(),
    contents,
    metas,
    fetchedCount: items.length,
    metadata: { eventStartDate, rows, pages },
  });

  runLocalSql(sql);
  console.log(`Upserted ${normalized.length} festivals into local Supabase.`);
}

async function fetchFestivalPage({ eventStartDate, rows, page }) {
  const params = {
    MobileOS: "ETC",
    MobileApp: "festival-course-app",
    _type: "json",
    eventStartDate,
    numOfRows: String(rows),
    pageNo: String(page),
  };

  const response = await fetchWithServiceKey(`${TOUR_API_BASE}/searchFestival2`, params);
  if (!response.ok) {
    throw new Error(`TourAPI request failed: ${response.status} ${response.statusText}\n${await response.text()}`);
  }

  const data = await response.json();
  const body = data?.response?.body;
  const rawItems = body?.items?.item || [];
  return Array.isArray(rawItems) ? rawItems : [rawItems];
}

async function fetchWithServiceKey(endpoint, params) {
  const serviceKey = process.env.GOV_DATA_KEY;
  const candidates = serviceKeyCandidates(serviceKey);

  let lastResponse = null;
  for (const candidate of candidates) {
    const query = new URLSearchParams(params);
    const url = `${endpoint}?serviceKey=${candidate}&${query.toString()}`;
    const response = await fetch(url);
    if (response.ok || response.status !== 401) return response;
    lastResponse = response;
  }

  return lastResponse;
}

function serviceKeyCandidates(serviceKey) {
  const trimmed = serviceKey.trim();
  const candidates = [trimmed];

  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded !== trimmed) candidates.push(encodeURIComponent(decoded));
  } catch {
    // Keep the original key if it is not valid percent-encoded text.
  }

  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    candidates.push(encodeURIComponent(trimmed));
  }

  return [...new Set(candidates)];
}

function normalizeFestival(item) {
  const contentId = text(item.contentid);
  const title = text(item.title);
  if (!contentId || !title) return null;

  const content = {
    content_id: contentId,
    content_type_id: number(item.contenttypeid) || 15,
    title,
    addr1: text(item.addr1),
    addr2: text(item.addr2),
    zipcode: text(item.zipcode),
    tel: text(item.tel),
    map_x: number(item.mapx),
    map_y: number(item.mapy),
    area_code: text(item.areacode),
    sigungu_code: text(item.sigungucode),
    l_dong_regn_cd: text(item.lDongRegnCd),
    l_dong_signgu_cd: text(item.lDongSignguCd),
    lcls_systm1: text(item.lclsSystm1),
    lcls_systm2: text(item.lclsSystm2),
    lcls_systm3: text(item.lclsSystm3),
    first_image: text(item.firstimage),
    first_image2: text(item.firstimage2),
    cpyrht_div_cd: text(item.cpyrhtDivCd),
    created_time: tourDateTime(item.createdtime),
    modified_time: tourDateTime(item.modifiedtime),
  };

  const meta = {
    content_id: contentId,
    event_start_date: tourDate(item.eventstartdate),
    event_end_date: tourDate(item.eventenddate),
    progress_type: text(item.progresstype),
    festival_type: text(item.festivaltype),
  };

  return { content, meta, raw: item };
}

function parseArgs(argv) {
  return argv.reduce((acc, arg, index) => {
    if (arg === "--apply") acc.apply = true;
    if (arg.startsWith("--start=")) acc.start = arg.slice("--start=".length);
    if (arg === "--start") acc.start = argv[index + 1];
    if (arg.startsWith("--rows=")) acc.rows = arg.slice("--rows=".length);
    if (arg === "--rows") acc.rows = argv[index + 1];
    if (arg.startsWith("--pages=")) acc.pages = arg.slice("--pages=".length);
    if (arg === "--pages") acc.pages = argv[index + 1];
    if (arg === "--debug-key") acc.debugKey = true;
    return acc;
  }, {});
}

function buildFestivalUpsertSql({ syncRunId, contents, metas, fetchedCount, metadata }) {
  return `
begin;

insert into public.sync_runs (id, job_name, status, metadata, fetched_count)
values (${sqlString(syncRunId)}::uuid, 'tourapi_festivals', 'running', ${sqlJson(metadata)}::jsonb, ${fetchedCount});

with payload as (
  select *
  from jsonb_to_recordset(${sqlJson(contents)}::jsonb) as x(
    content_id text,
    content_type_id smallint,
    title text,
    addr1 text,
    addr2 text,
    zipcode text,
    tel text,
    map_x double precision,
    map_y double precision,
    area_code text,
    sigungu_code text,
    l_dong_regn_cd text,
    l_dong_signgu_cd text,
    lcls_systm1 text,
    lcls_systm2 text,
    lcls_systm3 text,
    first_image text,
    first_image2 text,
    cpyrht_div_cd text,
    created_time timestamptz,
    modified_time timestamptz,
    raw jsonb
  )
)
insert into public.contents (
  content_id,
  content_type_id,
  title,
  addr1,
  addr2,
  zipcode,
  tel,
  map_x,
  map_y,
  area_code,
  sigungu_code,
  l_dong_regn_cd,
  l_dong_signgu_cd,
  lcls_systm1,
  lcls_systm2,
  lcls_systm3,
  first_image,
  first_image2,
  cpyrht_div_cd,
  created_time,
  modified_time,
  raw
)
select
  content_id,
  content_type_id,
  title,
  addr1,
  addr2,
  zipcode,
  tel,
  map_x,
  map_y,
  area_code,
  sigungu_code,
  l_dong_regn_cd,
  l_dong_signgu_cd,
  lcls_systm1,
  lcls_systm2,
  lcls_systm3,
  first_image,
  first_image2,
  cpyrht_div_cd,
  created_time,
  modified_time,
  raw
from payload
on conflict (content_id) do update set
  content_type_id = excluded.content_type_id,
  title = excluded.title,
  addr1 = excluded.addr1,
  addr2 = excluded.addr2,
  zipcode = excluded.zipcode,
  tel = excluded.tel,
  map_x = excluded.map_x,
  map_y = excluded.map_y,
  area_code = excluded.area_code,
  sigungu_code = excluded.sigungu_code,
  l_dong_regn_cd = excluded.l_dong_regn_cd,
  l_dong_signgu_cd = excluded.l_dong_signgu_cd,
  lcls_systm1 = excluded.lcls_systm1,
  lcls_systm2 = excluded.lcls_systm2,
  lcls_systm3 = excluded.lcls_systm3,
  first_image = excluded.first_image,
  first_image2 = excluded.first_image2,
  cpyrht_div_cd = excluded.cpyrht_div_cd,
  created_time = excluded.created_time,
  modified_time = excluded.modified_time,
  raw = excluded.raw;

with payload as (
  select *
  from jsonb_to_recordset(${sqlJson(metas)}::jsonb) as x(
    content_id text,
    event_start_date date,
    event_end_date date,
    progress_type text,
    festival_type text,
    raw jsonb
  )
)
insert into public.festival_meta (
  content_id,
  event_start_date,
  event_end_date,
  progress_type,
  festival_type,
  raw
)
select
  content_id,
  event_start_date,
  event_end_date,
  progress_type,
  festival_type,
  raw
from payload
on conflict (content_id) do update set
  event_start_date = excluded.event_start_date,
  event_end_date = excluded.event_end_date,
  progress_type = excluded.progress_type,
  festival_type = excluded.festival_type,
  raw = excluded.raw;

update public.sync_runs
set
  status = 'success',
  finished_at = now(),
  updated_count = ${contents.length}
where id = ${sqlString(syncRunId)}::uuid;

commit;
`;
}

function runLocalSql(sql) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8" }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Local Postgres write failed:\n${result.stderr || result.stdout}`);
  }
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  let tag = "json";
  while (json.includes(`$${tag}$`)) tag = `${tag}_`;
  return `$${tag}$${json}$${tag}$`;
}

function loadEnv(filename) {
  const file = path.join(process.cwd(), filename);
  if (!fs.existsSync(file)) return;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
  }
}

function requireEnv(key) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function printKeyDebug(serviceKey) {
  const key = serviceKey.trim();
  console.log({
    length: key.length,
    hasPercentEncoding: /%[0-9A-Fa-f]{2}/.test(key),
    hasWhitespace: /\s/.test(serviceKey),
    prefix: key.slice(0, 4),
    suffix: key.slice(-4),
  });
}

function text(value) {
  if (value === undefined || value === null) return null;
  const next = String(value).trim();
  return next || null;
}

function number(value) {
  if (value === undefined || value === null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function tourDate(value) {
  const next = text(value);
  if (!next || next.length !== 8) return null;
  return `${next.slice(0, 4)}-${next.slice(4, 6)}-${next.slice(6, 8)}`;
}

function tourDateTime(value) {
  const next = text(value);
  if (!next || next.length < 8) return null;
  const date = tourDate(next.slice(0, 8));
  if (!date) return null;
  if (next.length < 14) return `${date}T00:00:00+09:00`;
  return `${date}T${next.slice(8, 10)}:${next.slice(10, 12)}:${next.slice(12, 14)}+09:00`;
}
