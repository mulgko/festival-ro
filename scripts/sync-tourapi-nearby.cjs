#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2";
const LOCAL_DB_CONTAINER = "supabase_db_festival-course-app";
const DEFAULT_FESTIVAL_LIMIT = 5;
const DEFAULT_RADIUS = 5000;
const DEFAULT_ROWS = 20;
const DEFAULT_CONTENT_TYPES = [12, 39, 32];
let unexpectedResponseLogged = false;

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
  const festivalLimit = Number(args.festivalLimit || DEFAULT_FESTIVAL_LIMIT);
  const radius = Number(args.radius || DEFAULT_RADIUS);
  const rows = Number(args.rows || DEFAULT_ROWS);
  const contentTypes = parseContentTypes(args.contentTypes);

  requireEnv("GOV_DATA_KEY");
  if (args.debugKey) {
    printKeyDebug(process.env.GOV_DATA_KEY);
    return;
  }

  const festivals = readFestivals({ limit: festivalLimit });
  console.log(`Loaded ${festivals.length} festivals with coordinates from local Supabase.`);

  const allPlaces = new Map();
  const allLinks = new Map();
  const summaries = [];
  const apiCalls = [];

  for (const festival of festivals) {
    const results = await Promise.all(
      contentTypes.map((contentTypeId) =>
        fetchNearbyPlaces({ festival, contentTypeId, radius, rows })
      )
    );
    const places = results.flat();
    const counts = {};

    for (const result of results) {
      apiCalls.push(result.summary);
    }

    for (const item of places.flatMap((result) => result.items)) {
      counts[item.content.content_type_id] = (counts[item.content.content_type_id] || 0) + 1;
      allPlaces.set(item.content.content_id, { ...item.content, raw: item.raw });
      allLinks.set(`${festival.content_id}:${item.content.content_id}`, item.link);
    }

    summaries.push({
      festival_id: festival.content_id,
      title: festival.title,
      total: places.reduce((sum, result) => sum + result.items.length, 0),
      counts,
      api: results.map((result) => result.summary),
      sample: places.flatMap((result) => result.items).slice(0, 3).map((item) => ({
        content_id: item.content.content_id,
        type: item.content.content_type_id,
        title: item.content.title,
        distance_m: item.link.distance_m,
      })),
    });
  }

  const contents = [...allPlaces.values()];
  const links = [...allLinks.values()];
  console.log(`Fetched ${contents.length} unique nearby places and ${links.length} festival-place links.`);

  if (!apply) {
    console.log("Dry run only. Pass --apply to upsert into local Supabase.");
    const zeroTotalCalls = apiCalls.filter((call) => call.total_count === 0).length;
    console.log(`TourAPI calls: ${apiCalls.length}, zero-total calls: ${zeroTotalCalls}.`);
    console.log(JSON.stringify(summaries, null, 2));
    return;
  }

  const sql = buildNearbyUpsertSql({
    syncRunId: crypto.randomUUID(),
    contents,
    links,
    metadata: {
      festivalLimit,
      radius,
      rows,
      contentTypes,
      festivalCount: festivals.length,
    },
  });

  runLocalSql(sql);
  console.log(`Upserted ${contents.length} nearby places and ${links.length} links into local Supabase.`);
}

function readFestivals({ limit }) {
  const sql = `
select coalesce(jsonb_agg(row_to_json(f)), '[]'::jsonb)::text
from (
  select content_id, title, map_x, map_y
  from public.contents
  where content_type_id = 15
    and map_x is not null
    and map_y is not null
  order by modified_time desc nulls last, title asc
  limit ${Number(limit)}
) f;
`;
  return JSON.parse(runLocalSql(sql, { capture: true }) || "[]");
}

async function fetchNearbyPlaces({ festival, contentTypeId, radius, rows }) {
  const params = {
    MobileOS: "ETC",
    MobileApp: "festival-course-app",
    _type: "json",
    arrange: "E",
    mapX: String(festival.map_x),
    mapY: String(festival.map_y),
    radius: String(radius),
    contentTypeId: String(contentTypeId),
    numOfRows: String(rows),
    pageNo: "1",
  };

  const response = await fetchWithServiceKey(`${TOUR_API_BASE}/locationBasedList2`, params);
  if (!response.ok) {
    throw new Error(
      `TourAPI nearby request failed for ${festival.title} (${contentTypeId}): ${response.status} ${response.statusText}\n${await response.text()}`
    );
  }

  const data = await response.json();
  const envelope = tourApiEnvelope(data);
  const header = envelope.header;
  if (header?.resultCode && header.resultCode !== "0000") {
    throw new Error(
      `TourAPI nearby response failed for ${festival.title} (${contentTypeId}): ${header.resultCode} ${header.resultMsg || ""}`.trim()
    );
  }

  if (!envelope.body && !unexpectedResponseLogged) {
    unexpectedResponseLogged = true;
    console.warn("Unexpected TourAPI nearby response shape:");
    console.warn(JSON.stringify(responseShape(data), null, 2));
  }

  const body = envelope.body;
  const rawItems = body?.items?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  const normalized = items
    .map((item) => normalizePlace(item, { festival, fallbackContentTypeId: contentTypeId }))
    .filter(Boolean);

  return {
    items: normalized,
    summary: {
      festival_id: festival.content_id,
      content_type_id: contentTypeId,
      result_code: header?.resultCode || null,
      result_msg: header?.resultMsg || null,
      total_count: number(body?.totalCount) || 0,
      returned_count: normalized.length,
    },
  };
}

function tourApiEnvelope(data) {
  if (data?.response) return data.response;
  if (data?.Response) return data.Response;
  if (data?.resultCode || data?.resultMsg) {
    return {
      header: {
        resultCode: text(data.resultCode),
        resultMsg: text(data.resultMsg),
      },
      body: data?.body || null,
    };
  }
  if (data?.header || data?.body) return data;
  if (data?.cmmMsgHeader) {
    return {
      header: {
        resultCode: text(data.cmmMsgHeader.returnReasonCode),
        resultMsg: text(data.cmmMsgHeader.returnAuthMsg || data.cmmMsgHeader.errMsg),
      },
      body: null,
    };
  }
  if (data?.OpenAPI_ServiceResponse?.cmmMsgHeader) {
    const header = data.OpenAPI_ServiceResponse.cmmMsgHeader;
    return {
      header: {
        resultCode: text(header.returnReasonCode),
        resultMsg: text(header.returnAuthMsg || header.errMsg),
      },
      body: null,
    };
  }
  return { header: null, body: null };
}

function responseShape(value, depth = 0) {
  if (depth >= 3) return typeof value;
  if (Array.isArray(value)) return value.slice(0, 2).map((item) => responseShape(item, depth + 1));
  if (!value || typeof value !== "object") return typeof value;

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 12)
      .map(([key, next]) => [key, responseShape(next, depth + 1)])
  );
}

async function fetchWithServiceKey(endpoint, params) {
  const candidates = serviceKeyCandidates(process.env.GOV_DATA_KEY);

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
  }

  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) {
    candidates.push(encodeURIComponent(trimmed));
  }

  return [...new Set(candidates)];
}

function normalizePlace(item, { festival, fallbackContentTypeId }) {
  const contentId = text(item.contentid);
  const title = text(item.title);
  if (!contentId || !title || contentId === festival.content_id) return null;

  const distance = Math.round(number(item.dist) || 0);
  const contentTypeId = number(item.contenttypeid) || fallbackContentTypeId;
  const hasImage = Boolean(text(item.firstimage) || text(item.firstimage2));

  const content = {
    content_id: contentId,
    content_type_id: contentTypeId,
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

  const link = {
    festival_id: festival.content_id,
    place_id: contentId,
    distance_m: distance,
    rank_score: rankScore({ distance, contentTypeId, hasImage }),
  };

  return { content, link, raw: item };
}

function rankScore({ distance, contentTypeId, hasImage }) {
  const distanceScore = Math.max(0, 100 - distance / 100);
  const typeBonus = contentTypeId === 39 ? 8 : contentTypeId === 32 ? 5 : 6;
  const imageBonus = hasImage ? 4 : 0;
  return Number((distanceScore + typeBonus + imageBonus).toFixed(3));
}

function buildNearbyUpsertSql({ syncRunId, contents, links, metadata }) {
  return `
begin;

insert into public.sync_runs (id, job_name, status, metadata, fetched_count)
values (${sqlString(syncRunId)}::uuid, 'tourapi_nearby', 'running', ${sqlJson(metadata)}::jsonb, ${contents.length});

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
  from jsonb_to_recordset(${sqlJson(links)}::jsonb) as x(
    festival_id text,
    place_id text,
    distance_m integer,
    rank_score numeric
  )
)
insert into public.nearby_places (
  festival_id,
  place_id,
  distance_m,
  rank_score
)
select
  festival_id,
  place_id,
  distance_m,
  rank_score
from payload
on conflict (festival_id, place_id) do update set
  distance_m = excluded.distance_m,
  rank_score = excluded.rank_score;

update public.sync_runs
set
  status = 'success',
  finished_at = now(),
  updated_count = ${links.length}
where id = ${sqlString(syncRunId)}::uuid;

commit;
`;
}

function runLocalSql(sql, { capture = false } = {}) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-q"],
    { input: sql, encoding: "utf8" }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Local Postgres command failed:\n${result.stderr || result.stdout}`);
  }
  return capture ? result.stdout.trim() : result.stdout;
}

function parseArgs(argv) {
  return argv.reduce((acc, arg, index) => {
    if (arg === "--apply") acc.apply = true;
    if (arg.startsWith("--festival-limit=")) acc.festivalLimit = arg.slice("--festival-limit=".length);
    if (arg === "--festival-limit") acc.festivalLimit = argv[index + 1];
    if (arg.startsWith("--radius=")) acc.radius = arg.slice("--radius=".length);
    if (arg === "--radius") acc.radius = argv[index + 1];
    if (arg.startsWith("--rows=")) acc.rows = arg.slice("--rows=".length);
    if (arg === "--rows") acc.rows = argv[index + 1];
    if (arg.startsWith("--content-types=")) acc.contentTypes = arg.slice("--content-types=".length);
    if (arg === "--content-types") acc.contentTypes = argv[index + 1];
    if (arg === "--debug-key") acc.debugKey = true;
    return acc;
  }, {});
}

function parseContentTypes(value) {
  if (!value) return DEFAULT_CONTENT_TYPES;
  return String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
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

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  let tag = "json";
  while (json.includes(`$${tag}$`)) tag = `${tag}_`;
  return `$${tag}$${json}$${tag}$`;
}
