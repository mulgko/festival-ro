create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.contents (
  content_id text primary key,
  content_type_id smallint not null,
  title text not null,
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
  overview text,
  source text not null default 'tourapi',
  raw jsonb not null default '{}'::jsonb,
  created_time timestamptz,
  modified_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location extensions.geography(Point, 4326) generated always as (
    case
      when map_x is not null and map_y is not null
        then extensions.ST_SetSRID(extensions.ST_MakePoint(map_x, map_y), 4326)::extensions.geography
      else null
    end
  ) stored,
  constraint contents_content_type_id_check
    check (content_type_id in (12, 14, 15, 25, 28, 32, 38, 39))
);

create index contents_content_type_id_idx on public.contents (content_type_id);
create index contents_area_idx on public.contents (area_code, sigungu_code);
create index contents_title_idx on public.contents using gin (to_tsvector('simple', coalesce(title, '')));
create index contents_location_gist_idx on public.contents using gist (location) where location is not null;

create trigger contents_set_updated_at
before update on public.contents
for each row execute function public.set_updated_at();

create table public.festival_meta (
  content_id text primary key references public.contents(content_id) on delete cascade,
  event_start_date date,
  event_end_date date,
  progress_type text,
  festival_type text,
  play_time text,
  event_place text,
  sponsor1 text,
  sponsor1_tel text,
  use_time_festival text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index festival_meta_event_dates_idx on public.festival_meta (event_start_date, event_end_date);

create trigger festival_meta_set_updated_at
before update on public.festival_meta
for each row execute function public.set_updated_at();

create table public.nearby_places (
  festival_id text not null references public.contents(content_id) on delete cascade,
  place_id text not null references public.contents(content_id) on delete cascade,
  distance_m integer not null,
  rank_score numeric(8, 3) not null default 0,
  source text not null default 'tourapi_location_based',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (festival_id, place_id),
  constraint nearby_places_not_self_check check (festival_id <> place_id),
  constraint nearby_places_distance_m_check check (distance_m >= 0)
);

create index nearby_places_festival_score_idx on public.nearby_places (festival_id, rank_score desc, distance_m asc);
create index nearby_places_place_idx on public.nearby_places (place_id);

create trigger nearby_places_set_updated_at
before update on public.nearby_places
for each row execute function public.set_updated_at();

create table public.courses (
  id uuid primary key default extensions.gen_random_uuid(),
  festival_id text not null references public.contents(content_id) on delete restrict,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  days smallint not null default 2,
  is_public boolean not null default false,
  share_token text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  generation_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_days_check check (days between 1 and 7),
  constraint courses_share_token_unique unique (share_token)
);

create index courses_festival_idx on public.courses (festival_id);
create index courses_user_created_idx on public.courses (user_id, created_at desc);
create index courses_public_share_idx on public.courses (share_token) where is_public;

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create table public.course_items (
  id uuid primary key default extensions.gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  content_id text not null references public.contents(content_id) on delete restrict,
  day smallint not null,
  item_order smallint not null,
  starts_at time,
  stay_minutes integer,
  transit_minutes integer,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_items_day_check check (day between 1 and 7),
  constraint course_items_item_order_check check (item_order > 0),
  constraint course_items_stay_minutes_check check (stay_minutes is null or stay_minutes > 0),
  constraint course_items_transit_minutes_check check (transit_minutes is null or transit_minutes >= 0),
  constraint course_items_course_day_order_unique unique (course_id, day, item_order)
);

create index course_items_course_idx on public.course_items (course_id, day, item_order);
create index course_items_content_idx on public.course_items (content_id);

create trigger course_items_set_updated_at
before update on public.course_items
for each row execute function public.set_updated_at();

create table public.sync_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint sync_runs_status_check check (status in ('running', 'success', 'failed'))
);

create index sync_runs_job_started_idx on public.sync_runs (job_name, started_at desc);

alter table public.contents enable row level security;
alter table public.festival_meta enable row level security;
alter table public.nearby_places enable row level security;
alter table public.courses enable row level security;
alter table public.course_items enable row level security;
alter table public.sync_runs enable row level security;

create policy "contents are publicly readable"
on public.contents for select
using (true);

create policy "festival metadata is publicly readable"
on public.festival_meta for select
using (true);

create policy "nearby places are publicly readable"
on public.nearby_places for select
using (true);

create policy "public or own courses are readable"
on public.courses for select
using (is_public or auth.uid() = user_id);

create policy "authenticated users can create own courses"
on public.courses for insert
with check (auth.uid() = user_id);

create policy "users can update own courses"
on public.courses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own courses"
on public.courses for delete
using (auth.uid() = user_id);

create policy "course items follow course visibility"
on public.course_items for select
using (
  exists (
    select 1
    from public.courses
    where courses.id = course_items.course_id
      and (courses.is_public or courses.user_id = auth.uid())
  )
);

create policy "users can create items for own courses"
on public.course_items for insert
with check (
  exists (
    select 1
    from public.courses
    where courses.id = course_items.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "users can update items for own courses"
on public.course_items for update
using (
  exists (
    select 1
    from public.courses
    where courses.id = course_items.course_id
      and courses.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses
    where courses.id = course_items.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "users can delete items for own courses"
on public.course_items for delete
using (
  exists (
    select 1
    from public.courses
    where courses.id = course_items.course_id
      and courses.user_id = auth.uid()
  )
);
