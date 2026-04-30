"use client";

import { useEffect, useMemo, useState } from "react";

const themes = {
  spring: {
    label: "봄",
    accent: "#E85D8F",
    accentSoft: "#FFF0F5",
    accentMid: "#F6BDD5",
    surface: "#FFF9FB",
    hero: "linear-gradient(135deg, rgba(232,93,143,.94), rgba(128,36,83,.92))",
    copy: "벚꽃길 따라 주말 코스를 만들어요",
    emoji: "꽃잎",
    particle: "petal",
  },
  summer: {
    label: "여름",
    accent: "#FF5A3D",
    accentSoft: "#FFF1ED",
    accentMid: "#FFC8BA",
    surface: "#F8F7F2",
    hero: "linear-gradient(135deg, rgba(20,74,112,.94), rgba(255,90,61,.86))",
    copy: "바다와 축제를 한 번에 묶어요",
    emoji: "물결",
    particle: null,
  },
  autumn: {
    label: "가을",
    accent: "#D56D1F",
    accentSoft: "#FFF3EA",
    accentMid: "#F5C08A",
    surface: "#FBF8F4",
    hero: "linear-gradient(135deg, rgba(93,45,11,.94), rgba(213,109,31,.88))",
    copy: "단풍길과 로컬 맛집을 이어요",
    emoji: "낙엽",
    particle: "leaf",
  },
  winter: {
    label: "겨울",
    accent: "#365FCC",
    accentSoft: "#EEF3FF",
    accentMid: "#AEC4FF",
    surface: "#F5F7FF",
    hero: "linear-gradient(135deg, rgba(19,38,92,.95), rgba(54,95,204,.9))",
    copy: "눈 내리는 축제 코스를 준비해요",
    emoji: "눈",
    particle: "snow",
  },
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const areaByCode = {
  "1": "서울·경기",
  "2": "서울·경기",
  "31": "서울·경기",
  "3": "충청도",
  "8": "충청도",
  "33": "충청도",
  "34": "충청도",
  "32": "강원도",
  "4": "경상도",
  "6": "경상도",
  "7": "경상도",
  "35": "경상도",
  "36": "경상도",
  "5": "전라도",
  "37": "전라도",
  "38": "전라도",
  "39": "제주도",
};

const placeTypeByContentType = {
  12: "spot",
  32: "stay",
  39: "food",
};

const transits = ["차로 12분", "도보 8분", "차로 22분", "차로 38분", "차로 25분"];

const categories = [
  { id: "전체", label: "전체", icon: IconSpark },
  { id: "체험", label: "체험", icon: IconTicket },
  { id: "자연", label: "자연", icon: IconLeaf },
  { id: "음악", label: "음악", icon: IconMusic },
  { id: "레포츠", label: "레포츠", icon: IconWave },
  { id: "역사", label: "역사", icon: IconLandmark },
  { id: "푸드", label: "푸드", icon: IconFork },
];

const typeMeta = {
  festival: { label: "축제", icon: IconTicket, color: "#FF5A3D", bg: "#FFF1ED" },
  food: { label: "맛집", icon: IconFork, color: "#E77817", bg: "#FFF5E8" },
  spot: { label: "관광지", icon: IconPin, color: "#2B78D4", bg: "#EDF5FF" },
  stay: { label: "숙박", icon: IconBed, color: "#6B62D8", bg: "#F1F0FF" },
};

const recentSearches = ["보령 머드축제", "강릉 커피", "이번 주말 강원도"];
const areas = ["전체", "서울·경기", "강원도", "충청도", "경상도", "전라도", "제주도"];
const seasons = ["전체", "봄", "여름", "가을", "겨울"];
const courseIntents = [
  {
    id: "recommended",
    label: "추천",
    kicker: "2026 추천",
    hero: ["축제 하나만 고르면", "주말 코스가 완성돼요"],
    description: "맛집, 숙박, 이동까지 자동으로 묶어드려요.",
    highlightTitle: "이번 주 추천",
    highlightText: "보령 머드축제 · 해변 코스 6곳",
    toolbarText: "한국관광공사 TourAPI · 주소 기준 위치",
  },
  {
    id: "nearby",
    label: "내 주변",
    kicker: "가까운 코스",
    hero: ["가까운 축제부터", "가볍게 다녀와요"],
    description: "이동 부담이 낮은 후보를 먼저 보여드려요.",
    highlightTitle: "가까운 후보",
    highlightText: "자라섬 · 화천 · 충청권 코스",
    toolbarText: "가까운 이동 후보 · 주소 기준 위치",
  },
  {
    id: "date",
    label: "데이트",
    kicker: "데이트 코스",
    hero: ["산책과 카페까지", "분위기 있게 이어요"],
    description: "사진 명소, 공연, 카페 동선을 함께 보기 좋게 모았어요.",
    highlightTitle: "데이트 추천",
    highlightText: "진해 군항제 · 강릉 커피축제",
    toolbarText: "산책, 공연, 카페를 잇기 좋은 축제",
  },
  {
    id: "kids",
    label: "아이와",
    kicker: "가족 코스",
    hero: ["아이와 함께", "체험 중심으로 골라요"],
    description: "체험, 휴식, 이동 시간을 함께 고려한 후보를 모았어요.",
    highlightTitle: "가족 추천",
    highlightText: "보령 머드 · 화천 산천어",
    toolbarText: "체험과 휴식을 함께 잡기 좋은 축제",
  },
  {
    id: "oneDay",
    label: "당일치기",
    kicker: "하루 일정",
    hero: ["아침에 출발해", "밤에 돌아오는 코스"],
    description: "축제와 식사, 산책을 하루 동선으로 묶어드려요.",
    highlightTitle: "당일 추천",
    highlightText: "강릉 커피축제 · 바다 산책",
    toolbarText: "하루 일정으로 묶기 좋은 축제",
  },
];

async function loadFestivalData() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  const festivalRows = await readSupabase("contents", {
    select: "content_id,content_type_id,title,addr1,addr2,tel,map_x,map_y,area_code,sigungu_code,lcls_systm1,lcls_systm2,lcls_systm3,first_image,first_image2,overview,raw,created_time,modified_time",
    content_type_id: "eq.15",
    map_x: "not.is.null",
    map_y: "not.is.null",
    order: "modified_time.desc.nullslast,title.asc",
    limit: "100",
  });

  if (!festivalRows.length) return [];

  const festivalIds = festivalRows.map((item) => item.content_id);
  const [metaRows, linkRows] = await Promise.all([
    readSupabase("festival_meta", {
      select: "content_id,event_start_date,event_end_date,progress_type,festival_type,event_place,play_time",
      content_id: `in.(${festivalIds.join(",")})`,
    }),
    readSupabase("nearby_places", {
      select: "festival_id,place_id,distance_m,rank_score",
      festival_id: `in.(${festivalIds.join(",")})`,
      order: "festival_id.asc,rank_score.desc,distance_m.asc",
      limit: "600",
    }),
  ]);

  const placeIds = [...new Set(linkRows.map((item) => item.place_id))];
  const placeRows = placeIds.length
    ? await readSupabase("contents", {
        select: "content_id,content_type_id,title,addr1,addr2,tel,map_x,map_y,area_code,sigungu_code,first_image,first_image2,overview,raw,modified_time",
        content_id: `in.(${placeIds.join(",")})`,
      })
    : [];

  const metaById = new Map(metaRows.map((item) => [item.content_id, item]));
  const placeById = new Map(placeRows.map((item) => [item.content_id, item]));
  const linksByFestival = new Map();

  linkRows.forEach((link) => {
    if (!linksByFestival.has(link.festival_id)) linksByFestival.set(link.festival_id, []);
    linksByFestival.get(link.festival_id).push(link);
  });

  return festivalRows.map((row) => {
    const meta = metaById.get(row.content_id) || {};
    const nearbyPlaces = (linksByFestival.get(row.content_id) || [])
      .map((link) => {
        const place = placeById.get(link.place_id);
        return place ? normalizePlace(place, link) : null;
      })
      .filter(Boolean);

    const festival = normalizeFestival(row, meta, nearbyPlaces);
    festival.coursePlaces = buildCoursePlaces(festival, nearbyPlaces);
    return festival;
  });
}

async function readSupabase(table, params) {
  const url = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      ...(isJwt(SUPABASE_KEY) ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${table} request failed: ${response.status} ${detail}`);
  }

  return response.json();
}

function isJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
}

function normalizeFestival(row, meta, nearbyPlaces) {
  const month = monthFromDate(meta.event_start_date) || monthFromTourRaw(row.raw?.eventstartdate) || 7;
  const day = dayFromDate(meta.event_start_date) || dayFromTourRaw(row.raw?.eventstartdate) || 1;
  const season = seasonFromMonth(month);
  const category = inferCategory(row, meta);
  const address = [row.addr1, row.addr2].filter(Boolean).join(" ") || meta.event_place || "주소 정보 없음";
  const area = areaByCode[String(row.area_code)] || "전국";
  const region = formatRegion(row, area);
  const date = formatDateRange(meta.event_start_date, meta.event_end_date);
  const image = row.first_image || row.first_image2 || "";
  const tags = buildTags({ category, season, area, nearbyPlaces });

  return {
    id: row.content_id,
    name: row.title,
    subtitle: `${region}에서 열리는 ${themes[season].label} 축제 코스`,
    region,
    area,
    date,
    month,
    day,
    season,
    category,
    intents: inferIntents(category, nearbyPlaces),
    distance: nearbyPlaces.length ? `주변 후보 ${nearbyPlaces.length}곳` : "주변 후보 준비 중",
    address,
    image,
    imageLabel: image ? "TourAPI 이미지" : "이미지 없음",
    tags,
    overview: row.overview || row.raw?.overview || `${address} 기준으로 주변 관광지, 맛집, 숙박 후보를 함께 확인할 수 있어요.`,
    lat: row.map_y,
    lng: row.map_x,
    photo: Boolean(image),
    nearbyPlaces,
    coursePlaces: [],
  };
}

function normalizePlace(row, link) {
  const type = placeTypeByContentType[Number(row.content_type_id)] || "spot";
  const address = [row.addr1, row.addr2].filter(Boolean).join(" ");

  return {
    id: row.content_id,
    type,
    name: row.title,
    stay: type === "stay" ? "숙박" : type === "food" ? "1시간" : "1시간 30분",
    note: [address, link?.distance_m ? `${link.distance_m.toLocaleString("ko-KR")}m` : null].filter(Boolean).join(" · "),
    lat: row.map_y,
    lng: row.map_x,
    distanceM: link?.distance_m || 0,
    rankScore: Number(link?.rank_score || 0),
    photo: Boolean(row.first_image || row.first_image2),
  };
}

function buildCoursePlaces(festival, nearbyPlaces) {
  const selected = [];
  const used = new Set();
  const festivalStop = {
    id: `${festival.id}-festival`,
    day: 1,
    type: "festival",
    name: festival.name,
    time: "10:00",
    stay: "3시간",
    note: "축제 관람",
    lat: festival.lat,
    lng: festival.lng,
  };

  selected.push(festivalStop);
  addPlace(selected, used, nearbyPlaces, "food", 1, "13:30");
  addPlace(selected, used, nearbyPlaces, "spot", 1, "15:00");
  addPlace(selected, used, nearbyPlaces, "stay", 1, "18:00");
  addPlace(selected, used, nearbyPlaces, "spot", 2, "10:00");
  addPlace(selected, used, nearbyPlaces, "food", 2, "12:30");

  nearbyPlaces.forEach((place) => {
    if (selected.length >= 6 || used.has(place.id)) return;
    selected.push({ ...place, day: selected.length < 4 ? 1 : 2, time: selected.length < 4 ? "16:30" : "14:00" });
    used.add(place.id);
  });

  return selected;
}

function addPlace(selected, used, places, type, day, time) {
  const place = places.find((item) => item.type === type && !used.has(item.id));
  if (!place) return;
  selected.push({ ...place, day, time });
  used.add(place.id);
}

function formatDateRange(start, end) {
  if (!start && !end) return "일정 확인 중";
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (!endText || startText === endText) return startText;
  return `${startText} - ${endText.replace(/^\d{4}\./, "")}`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function monthFromDate(value) {
  if (!value) return null;
  const month = Number(String(value).slice(5, 7));
  return Number.isFinite(month) ? month : null;
}

function dayFromDate(value) {
  if (!value) return null;
  const day = Number(String(value).slice(8, 10));
  return Number.isFinite(day) ? day : null;
}

function monthFromTourRaw(value) {
  const next = String(value || "");
  if (next.length < 6) return null;
  const month = Number(next.slice(4, 6));
  return Number.isFinite(month) ? month : null;
}

function dayFromTourRaw(value) {
  const next = String(value || "");
  if (next.length < 8) return null;
  const day = Number(next.slice(6, 8));
  return Number.isFinite(day) ? day : null;
}

function seasonFromMonth(month) {
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  if ([9, 10, 11].includes(month)) return "autumn";
  return "winter";
}

function formatRegion(row, area) {
  const raw = row.raw || {};
  const regionName = raw.addr1 ? String(raw.addr1).split(" ").slice(0, 2).join(" ") : "";
  return regionName || area;
}

function inferCategory(row, meta) {
  const text = `${row.title} ${meta.festival_type || ""} ${row.lcls_systm1 || ""} ${row.lcls_systm2 || ""} ${row.lcls_systm3 || ""}`;
  if (/재즈|음악|뮤직|공연|콘서트/i.test(text)) return "음악";
  if (/커피|음식|푸드|먹거리|봄나물|맛/i.test(text)) return "푸드";
  if (/국가유산|문화재|역사|미디어아트|전통/i.test(text)) return "역사";
  if (/산천어|레포츠|스포츠|마라톤|낚시/i.test(text)) return "레포츠";
  if (/꽃|벚꽃|단풍|낙화|오름|자연|정원/i.test(text)) return "자연";
  return "체험";
}

function inferIntents(category, nearbyPlaces) {
  const intents = ["recommended", "oneDay"];
  if (nearbyPlaces.length) intents.push("nearby");
  if (["음악", "자연", "푸드"].includes(category)) intents.push("date");
  if (["체험", "레포츠", "역사"].includes(category)) intents.push("kids");
  return intents;
}

function buildTags({ category, season, area, nearbyPlaces }) {
  const tags = [themes[season].label, category, area];
  if (nearbyPlaces.some((item) => item.type === "food")) tags.push("맛집");
  if (nearbyPlaces.some((item) => item.type === "stay")) tags.push("숙박");
  return [...new Set(tags)].slice(0, 5);
}

export default function Home() {
  const [screen, setScreen] = useState("explore");
  const [season, setSeason] = useState("summer");
  const [courseIntent, setCourseIntent] = useState("recommended");
  const [festivalsData, setFestivalsData] = useState([]);
  const [dataStatus, setDataStatus] = useState("loading");
  const [dataError, setDataError] = useState("");
  const [selectedFestival, setSelectedFestival] = useState(null);
  const theme = themes[season];

  useEffect(() => {
    let alive = true;

    loadFestivalData()
      .then((items) => {
        if (!alive) return;
        setFestivalsData(items);
        setSelectedFestival(items[0] || null);
        if (items[0]) setSeason(items[0].season);
        setDataStatus("success");
      })
      .catch((error) => {
        if (!alive) return;
        setDataError(error.message);
        setDataStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  function navigate(next, festival) {
    if (festival) {
      setSelectedFestival(festival);
      setSeason(festival.season);
    }
    if (!festival && (next === "builder" || next === "result") && !selectedFestival) return;
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app" style={{ "--accent": theme.accent, "--accent-soft": theme.accentSoft, "--accent-mid": theme.accentMid, "--season-surface": theme.surface, "--hero": theme.hero }}>
      <SeasonParticles kind={theme.particle} />
      <TopNav screen={screen} courseIntent={courseIntent} onCourseIntent={setCourseIntent} onNavigate={navigate} festivals={festivalsData} />
      {screen === "explore" && <ExploreScreen festivals={festivalsData} dataStatus={dataStatus} dataError={dataError} courseIntent={courseIntent} onCourseIntent={setCourseIntent} onFestival={(festival) => navigate("detail", festival)} />}
      {screen === "detail" && selectedFestival && <DetailScreen festival={selectedFestival} onBack={() => navigate("explore")} onBuild={() => navigate("builder", selectedFestival)} />}
      {screen === "builder" && selectedFestival && <BuilderScreen festival={selectedFestival} onBack={() => navigate("detail")} onDone={() => navigate("result")} />}
      {screen === "result" && selectedFestival && <ResultScreen festival={selectedFestival} onBack={() => navigate("builder")} />}
      <MobileTabs screen={screen} onNavigate={navigate} />
    </main>
  );
}

function TopNav({ screen, courseIntent, onCourseIntent, onNavigate, festivals }) {
  const [openSearch, setOpenSearch] = useState(false);
  const active = (id) => screen === id || (screen === "detail" && id === "explore") || (screen === "result" && id === "builder");

  return (
    <header className="top-nav">
      <div className="brand" onClick={() => onNavigate("explore")} role="button" tabIndex={0}>
        <div className="brand-mark">
          <IconRoute size={19} />
        </div>
        <div>
          <strong>축제로</strong>
          <span>축제로 시작하는 1박 2일 코스</span>
        </div>
      </div>
      <nav className="desktop-nav" aria-label="주요 화면">
        <button className={active("explore") ? "active" : ""} onClick={() => onNavigate("explore")}><IconMap />축제 탐색</button>
        <button className={active("builder") ? "active" : ""} onClick={() => onNavigate("builder")}><IconRoute />코스 만들기</button>
        <button className={active("saved") ? "active" : ""} onClick={() => onNavigate("result")}><IconBookmark />공유 결과</button>
      </nav>
      {screen === "explore" && <CourseIntentTabs value={courseIntent} onChange={onCourseIntent} className="intent-switch" />}
      <button className="nav-search" onClick={() => setOpenSearch(true)}>
        <IconSearch />
        <span>어디로 떠나볼까요?</span>
      </button>
      <button className="icon-button" aria-label="알림"><IconBell /></button>
      <button className="mobile-search-button" onClick={() => setOpenSearch(true)} aria-label="검색"><IconSearch /></button>
      {openSearch && <SearchOverlay festivals={festivals} onClose={() => setOpenSearch(false)} />}
    </header>
  );
}

function CourseIntentTabs({ value, onChange, className }) {
  return (
    <div className={className} aria-label="코스 유형">
      {courseIntents.map((item) => (
        <button key={item.id} className={value === item.id ? "active" : ""} aria-pressed={value === item.id} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ExploreScreen({ festivals: items, dataStatus, dataError, courseIntent, onCourseIntent, onFestival }) {
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("전체");
  const [category, setCategory] = useState("전체");
  const [filterSeason, setFilterSeason] = useState("전체");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(18);
  const activeCourseIntent = courseIntents.find((item) => item.id === courseIntent) || courseIntents[0];

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((festival) => {
      const seasonLabel = themes[festival.season].label;
      const haystack = `${festival.name} ${festival.region} ${festival.category} ${festival.tags.join(" ")}`.toLowerCase();
      if (courseIntent !== "recommended" && !festival.intents?.includes(courseIntent)) return false;
      if (text && !haystack.includes(text)) return false;
      if (area !== "전체" && festival.area !== area) return false;
      if (category !== "전체" && festival.category !== category) return false;
      if (filterSeason !== "전체" && seasonLabel !== filterSeason) return false;
      return true;
    });
  }, [items, query, area, category, filterSeason, courseIntent]);

  const clearFilters = () => {
    setArea("전체");
    setCategory("전체");
    setFilterSeason("전체");
    setQuery("");
  };

  return (
    <section className="explore-shell">
      <aside className="filter-rail">
        <FilterPanel area={area} setArea={setArea} category={category} setCategory={setCategory} filterSeason={filterSeason} setFilterSeason={setFilterSeason} onClear={clearFilters} />
      </aside>
      <div className="explore-main">
        <HeroPanel intent={activeCourseIntent} />
        <CourseIntentTabs value={courseIntent} onChange={onCourseIntent} className="intent-strip" />
        <div className="mobile-action-row">
          <button onClick={() => setSheetOpen(true)}><IconSliders />필터</button>
          <button onClick={() => setView("calendar")}><IconCalendar />이번 달</button>
        </div>
        <div className="search-strip">
          <label>
            <IconSearch />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="축제명·지역·카테고리로 찾아보기" />
          </label>
          <div className="quick-suggestions">
            {["강릉", "꽃축제", "이번 주말"].map((item) => (
              <button key={item} onClick={() => setQuery(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div className="view-toolbar">
          <div>
            <strong>{activeCourseIntent.label} 코스 {filtered.length}곳</strong>
            <span>{activeCourseIntent.toolbarText}</span>
          </div>
          <div className="view-tabs" role="tablist">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><IconList />리스트</button>
            <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><IconMap />지도</button>
            <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}><IconCalendar />캘린더</button>
          </div>
        </div>
        {dataStatus === "loading" && <DataState type="loading" />}
        {dataStatus === "error" && <DataState type="error" message={dataError} />}
        {dataStatus === "success" && view === "list" && <FestivalList festivals={filtered} onFestival={onFestival} />}
        {dataStatus === "success" && view === "calendar" && <CalendarView festivals={filtered} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onFestival={onFestival} />}
        {dataStatus === "success" && view === "map" && <MapView festivals={filtered} onFestival={onFestival} />}
      </div>
      {sheetOpen && (
        <BottomSheet title="필터" onClose={() => setSheetOpen(false)}>
          <FilterPanel area={area} setArea={setArea} category={category} setCategory={setCategory} filterSeason={filterSeason} setFilterSeason={setFilterSeason} onClear={clearFilters} />
        </BottomSheet>
      )}
    </section>
  );
}

function HeroPanel({ intent }) {
  return (
    <section className="hero-panel">
      <div className="hero-photo" />
      <div className="hero-copy">
        <p>{intent.kicker}</p>
        <h1><span>{intent.hero[0]}</span><span>{intent.hero[1]}</span></h1>
        <span>{intent.description}</span>
      </div>
      <div className="hero-mini">
        <strong>{intent.highlightTitle}</strong>
        <span>{intent.highlightText}</span>
      </div>
    </section>
  );
}

function FilterPanel({ area, setArea, category, setCategory, filterSeason, setFilterSeason, onClear }) {
  return (
    <div className="filter-panel">
      <div className="filter-head">
        <div>
          <strong>필터</strong>
          <span>지역 · 시즌 · 관심사</span>
        </div>
        <button onClick={onClear}>초기화</button>
      </div>
      <div className="filter-group">
        <h3>카테고리</h3>
        <div className="category-grid">
          {categories.map(({ id, label, icon: Icon }) => (
            <button key={id} className={category === id ? "selected" : ""} onClick={() => setCategory(id)}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <FilterGroup title="지역" items={areas} value={area} onChange={setArea} collapsible />
      <FilterGroup title="시즌" items={seasons} value={filterSeason} onChange={setFilterSeason} collapsible />
      <div className="data-note">
        <IconInfo />
        <span>출처: 한국관광공사 TourAPI<br />주소 기준 위치 · GPS 오차가 있을 수 있어요</span>
      </div>
    </div>
  );
}

function FilterGroup({ title, items, value, onChange, collapsible = false }) {
  const [open, setOpen] = useState(false);
  if (!collapsible) {
    return (
      <div className="filter-group">
        <h3>{title}</h3>
        <div className="filter-list">
          {items.map((item) => (
            <button key={item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}>
              <span>{item}</span>
              {value === item && <IconCheck />}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={`filter-group is-collapsible ${open ? "is-open" : ""}`}>
      <button className="filter-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <h3>{title}</h3>
        <span className="filter-toggle-meta">
          {value && value !== "전체" && <em>{value}</em>}
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <div className="filter-list">
          {items.map((item) => (
            <button key={item} className={value === item ? "selected" : ""} onClick={() => onChange(item)}>
              <span>{item}</span>
              {value === item && <IconCheck />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FestivalList({ festivals: items, onFestival }) {
  if (!items.length) return <EmptyState />;
  return (
    <div className="festival-grid">
      {items.map((festival, index) => <FestivalCard key={festival.id} festival={festival} index={index} onFestival={onFestival} />)}
    </div>
  );
}

function FestivalCard({ festival, index, onFestival }) {
  return (
    <article className="festival-card" style={{ animationDelay: `${index * 60}ms` }} onClick={() => onFestival(festival)}>
      <FestivalMedia festival={festival} />
      <div className="festival-body">
        <div className="eyebrow-row">
          <span>{festival.region}</span>
          <TypePill label={festival.category} icon={categoryIcon(festival.category)} />
        </div>
        <h2>{festival.name}</h2>
        <p>{festival.subtitle}</p>
        <div className="tag-row">{festival.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <div className="card-footer">
          <span>{festival.date}</span>
          <button>코스 만들기</button>
        </div>
      </div>
    </article>
  );
}

function FestivalMedia({ festival }) {
  if (festival.photo) {
    return (
      <div className="festival-media">
        <img src={festival.image} alt={`${festival.name} 사진`} />
        <span>{festival.imageLabel}</span>
      </div>
    );
  }
  return (
    <div className={`fallback-media ${festival.season}`}>
      <IconImageOff size={28} />
      <strong>{festival.name}</strong>
      <span>이미지 준비 중 · 계절 fallback</span>
    </div>
  );
}

function CalendarView({ festivals: items, selectedDate, setSelectedDate, onFestival }) {
  const calendarMonth = items[0]?.month || 7;
  const days = Array.from({ length: 35 }, (_, index) => {
    const day = index - 2;
    return day > 0 && day <= 31 ? day : null;
  });
  const selected = items.filter((festival) => festival.month === calendarMonth && (festival.day === selectedDate || Math.abs(festival.day - selectedDate) <= 1)).slice(0, 3);

  return (
    <div className="calendar-layout">
      <div className="calendar-panel">
        <div className="calendar-title">
          <div>
            <strong>2026년 {calendarMonth}월</strong>
            <span>날짜별 주말 후보 한눈에 보기</span>
          </div>
          <button>오늘</button>
        </div>
        <div className="weekdays">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map((day, index) => {
            const dayFestivals = day ? items.filter((festival) => festival.month === calendarMonth && (festival.day === day || (festival.day <= day && festival.day + 5 >= day))) : [];
            return (
              <button key={`${day}-${index}`} className={`${day === selectedDate ? "selected" : ""} ${day === 18 || day === 19 ? "weekend-hot" : ""}`} disabled={!day} onClick={() => day && setSelectedDate(day)}>
                {day && <span>{day}</span>}
                <div>{dayFestivals.slice(0, 2).map((festival) => <i key={festival.id} style={{ background: themes[festival.season].accent }} />)}</div>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="date-agenda">
        <span>{calendarMonth}월 {selectedDate}일 · 선택한 날짜</span>
        <h2>이날 가볼 만한 축제</h2>
        {(selected.length ? selected : items.slice(0, 2)).map((festival) => (
          <button key={festival.id} onClick={() => onFestival(festival)}>
            <strong>{festival.name}</strong>
            <span>{festival.region} · {festival.category}</span>
          </button>
        ))}
      </aside>
    </div>
  );
}

const mapRegions = [
  { id: "all", label: "전체", area: null },
  { id: "sg", label: "서울·경기", area: "서울·경기" },
  { id: "gw", label: "강원도", area: "강원도" },
  { id: "cc", label: "충청도", area: "충청도" },
  { id: "gs", label: "경상도", area: "경상도" },
  { id: "jl", label: "전라도", area: "전라도" },
  { id: "jj", label: "제주도", area: "제주도" },
];

function MapView({ festivals: items, onFestival }) {
  const [region, setRegion] = useState("all");
  const regionItems = useMemo(() => {
    if (region === "all") return items;
    const target = mapRegions.find((entry) => entry.id === region)?.area;
    return items.filter((festival) => festival.area === target);
  }, [region, items]);
  const [selected, setSelected] = useState(regionItems[0] || items[0]);

  const counts = useMemo(() => {
    const map = {};
    items.forEach((festival) => { map[festival.area] = (map[festival.area] || 0) + 1; });
    return map;
  }, [items]);

  const visible = regionItems.length ? regionItems : items;
  const active = visible.find((festival) => festival.id === selected?.id) ? selected : visible[0];

  return (
    <div className="map-branch">
      <aside className="map-rail">
        <div className="map-rail-head">
          <h2>가까이에서 만나는<br />주말 축제 지도</h2>
          <p>지역을 골라 축제를 확인하고,<br />지도 위에서 위치를 한눈에 볼 수 있어요.</p>
        </div>
        <div className="region-tabs">
          {mapRegions.map((entry) => {
            const total = entry.id === "all" ? items.length : counts[entry.area] || 0;
            return (
              <button key={entry.id} className={region === entry.id ? "active" : ""} onClick={() => { setRegion(entry.id); }}>
                {entry.label}<span className="total">{total}</span>
              </button>
            );
          })}
        </div>
        <div className="region-list">
          {visible.map((festival) => (
            <button key={festival.id} className={active?.id === festival.id ? "active" : ""} onClick={() => setSelected(festival)}>
              {festival.name.replace(/축제|페스티벌/g, "").trim()}
            </button>
          ))}
        </div>
        {active && (
          <div className="branch-card">
            <div className="branch-card-top">
              <p className="tit">{active.name}</p>
              <button className="branch-detail" onClick={() => onFestival(active)}>자세히 보기 →</button>
            </div>
            <div className="branch-info">
              <FestivalMedia festival={active} />
              <ul>
                <li><IconPin size={14} /><span>{active.address}</span></li>
                <li><IconCalendar size={14} /><span>{active.date}</span></li>
                <li><IconCar size={14} /><span>{active.distance}</span></li>
              </ul>
            </div>
          </div>
        )}
      </aside>
      <div className="map-stage">
        <KoreaMap festivals={visible} onFestival={(festival) => setSelected(festival)} active={active} />
      </div>
    </div>
  );
}

function KoreaMap({ festivals: items, onFestival, active, route = false, count = items.length }) {
  const points = items.slice(0, count);
  return (
    <div className={`korea-map ${route ? "is-route" : ""}`}>
      <div className="korea-map-inner">
        <img src="/korea-map.svg" alt="대한민국 지도" className="korea-map-img" />
        {route && points.length > 1 && (
          <svg className="korea-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points.map((item) => { const p = geoPoint(item); return `${p.x},${p.y}`; }).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.4 1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          </svg>
        )}
        {points.map((item, index) => {
          const pt = geoPoint(item);
          const isActive = !route && active?.id === item.id;
          return (
            <button
              key={item.id}
              className={`korea-pin ${route ? "is-route" : ""} ${isActive ? "is-active" : ""}`}
              style={{ left: `${pt.x}%`, top: `${pt.y}%`, animationDelay: `${index * 90}ms` }}
              onClick={() => onFestival?.(item)}
            >
              <span className="dot">
                <i /><i /><i />
                {route && <em>{index + 1}</em>}
              </span>
              <strong className="tip">{item.name}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function geoPoint(festival) {
  if (festival.lat && festival.lng) {
    const x = (festival.lng - 124.5) * 15.388 - 0.391;
    const y = (38.9 - festival.lat) * 17.940 - 3.797;
    return { x: clamp(x, 2, 98), y: clamp(y, 2, 98) };
  }
  return festivalPoint(festival);
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

function DetailScreen({ festival, onBack, onBuild }) {
  const nearbyPlaces = festival.nearbyPlaces || [];

  return (
    <section className="detail-layout">
      <div className="detail-hero">
        <FestivalMedia festival={festival} />
        <div className="detail-actions">
          <button onClick={onBack}><IconArrowLeft />축제 탐색</button>
          <div>
            <button aria-label="저장"><IconBookmark /></button>
            <button aria-label="공유"><IconShare /></button>
          </div>
        </div>
        <div className="detail-title">
          <span>{festival.region} · {festival.distance}</span>
          <h1>{festival.name}</h1>
          <p>{festival.subtitle}</p>
        </div>
      </div>
      <div className="detail-panel">
        <div className="info-pills">
          <TypePill label={festival.date} icon={IconCalendar} />
          <TypePill label={festival.category} icon={categoryIcon(festival.category)} />
          <TypePill label={festival.distance} icon={IconCar} />
        </div>
        <section>
          <h2>축제 소개</h2>
          <p>{festival.overview}</p>
        </section>
        <section className="location-box">
          <IconPin />
          <div>
            <strong>{festival.address}</strong>
            <span>주소 기준 위치 · GPS 좌표에 오차가 있을 수 있어요</span>
          </div>
        </section>
        <section>
          <h2>주변 추천</h2>
          {nearbyPlaces.length ? (
            <div className="nearby-grid">
              {nearbyPlaces.slice(0, 4).map((place) => <PlaceMini key={place.id} place={place} />)}
            </div>
          ) : (
            <EmptyState title="주변 후보가 아직 없어요" description="nearby_places 동기화 후 관광지, 맛집, 숙박 후보가 표시돼요." />
          )}
        </section>
        <div className="sticky-cta">
          <div>
            <strong>1박 2일 코스 만들기</strong>
            <span>맛집, 숙박, 관광지를 자동으로 묶어드려요.</span>
          </div>
          <button onClick={onBuild}>자동 생성</button>
        </div>
        <p className="source-note">출처: 한국관광공사 TourAPI</p>
      </div>
    </section>
  );
}

function BuilderScreen({ festival, onBack, onDone }) {
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState(1);
  const routePlaces = festival.coursePlaces || [];

  function generate() {
    if (generating) return;
    setReady(false);
    setGenerating(true);
    setCount(0);
    routePlaces.forEach((_, index) => window.setTimeout(() => setCount(index + 1), 360 + index * 340));
    window.setTimeout(() => {
      setGenerating(false);
      setReady(true);
    }, 360 + routePlaces.length * 340 + 400);
  }

  const visiblePlaces = ready ? routePlaces.filter((place) => place.day === day) : generating ? routePlaces.slice(0, count) : [];

  return (
    <section className="builder-layout">
      <div className="builder-map">
        <KoreaMap festivals={routePlaces} route count={count} />
        <button className="back-map" onClick={onBack}><IconArrowLeft />축제 보기</button>
        {ready && <button className="done-map" onClick={onDone}>결과 보기</button>}
        <div className="generate-dock">
          {!ready ? (
            <button onClick={generate} disabled={generating}>
              {generating ? `최적 경로 계산 중 · ${count}/${routePlaces.length}` : "코스 자동 생성"}
            </button>
          ) : (
            <span>코스 완성 · 총 {routePlaces.length}곳</span>
          )}
        </div>
      </div>
      <aside className="timeline-panel">
        <div className="timeline-head">
          <span>코스 만들기</span>
          <h1>{festival.name} 1박 2일</h1>
          <div className="day-tabs">
            {[1, 2].map((item) => <button key={item} className={day === item ? "active" : ""} onClick={() => setDay(item)}>Day {item}</button>)}
          </div>
        </div>
        <TimelineContent generating={generating} ready={ready} items={visiblePlaces} />
      </aside>
    </section>
  );
}

function TimelineContent({ generating, ready, items }) {
  if (!generating && !ready) {
    return (
      <div className="timeline-empty">
        <IconRoute size={36} />
        <strong>코스 자동 생성을 눌러보세요</strong>
        <span>지도 위에 장소가 순서대로 표시돼요.</span>
      </div>
    );
  }
  return (
    <div className="timeline-list">
      {items.map((place, index) => (
        <div key={place.id} className="timeline-item">
          <div className="timeline-marker">
            <TypeIcon type={place.type} />
            {index < items.length - 1 && <i />}
          </div>
          <div className="timeline-card">
            <div>
              <span>{place.time}</span>
              <TypeLabel type={place.type} />
              <em>{place.stay}</em>
            </div>
            <strong>{place.name}</strong>
            <p>{place.note}</p>
          </div>
          {index < items.length - 1 && <div className="transit"><IconCar />{transits[index]}</div>}
        </div>
      ))}
    </div>
  );
}

function ResultScreen({ festival, onBack }) {
  const [day, setDay] = useState(1);
  const [copied, setCopied] = useState(false);
  const routePlaces = festival.coursePlaces || [];
  const items = routePlaces.filter((place) => place.day === day);

  return (
    <section className="result-layout">
      <aside className="share-panel">
        <button className="soft-back" onClick={onBack}><IconArrowLeft />코스 수정</button>
        <div>
          <span>코스 완성</span>
          <h1>{festival.name}<br />1박 2일 코스</h1>
        </div>
        <div className="stats-grid">
          <Stat icon={IconPin} value={`${routePlaces.length}곳`} label="총 장소" />
          <Stat icon={IconCalendar} value="1박 2일" label="일정" />
          <Stat icon={IconCar} value="주변 기반" label="이동 거리" />
          <Stat icon={IconWallet} value="TourAPI" label="데이터" />
        </div>
        <div className="og-preview">
          <FestivalMedia festival={festival} />
          <div>
            <span>축제로</span>
            <strong>{festival.name} 1박 2일</strong>
            <p>{festival.region} · {routePlaces.length}곳 · 공유 카드 1200×630</p>
          </div>
        </div>
        <button className="primary-wide" onClick={() => setCopied(true)}>{copied ? "링크 복사 완료" : "코스 공유하기"}</button>
        <div className="share-actions">
          <button><IconDownload />이미지로 저장</button>
          <button><IconBookmark />내 코스에 저장</button>
        </div>
        <p className="source-note">출처: 한국관광공사 TourAPI</p>
      </aside>
      <div className="result-timeline">
        <div className="result-head">
          <div>
            <h2>여행 일정</h2>
            <span>{festival.name} 기준으로 자동 생성된 코스예요.</span>
          </div>
          <div className="day-tabs">
            {[1, 2].map((item) => <button key={item} className={day === item ? "active" : ""} onClick={() => setDay(item)}>Day {item}</button>)}
          </div>
        </div>
        <TimelineContent generating={false} ready items={items} />
      </div>
    </section>
  );
}

function SearchOverlay({ festivals: items, onClose }) {
  const [value, setValue] = useState("");
  const suggestions = items.filter((festival) => `${festival.name} ${festival.region} ${festival.category}`.includes(value)).slice(0, 4);

  return (
    <div className="search-overlay">
      <div className="search-dialog">
        <div className="search-input-large">
          <IconSearch />
          <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="어디로 떠날까요?" />
          <button onClick={onClose}><IconX /></button>
        </div>
        {!value && (
          <div className="recent-box">
            <span>최근 검색</span>
            {recentSearches.map((item) => <button key={item} onClick={() => setValue(item)}>{item}</button>)}
          </div>
        )}
        {value && (
          <div className="suggestion-box">
            <span>자동완성</span>
            {suggestions.length ? suggestions.map((festival) => (
              <button key={festival.id}>
                <strong>{festival.name}</strong>
                <em>{festival.region} · {festival.category}</em>
              </button>
            )) : <p>검색 결과가 없어요. 필터 조건을 바꿔보세요.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function BottomSheet({ title, children, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <strong>{title}</strong>
          <button onClick={onClose}><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DataState({ type, message }) {
  if (type === "loading") {
    return (
      <div className="empty-state">
        <IconRoute size={42} />
        <strong>축제 데이터를 불러오는 중이에요</strong>
        <span>local Supabase에서 TourAPI 축제와 주변 장소를 읽고 있어요.</span>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <IconInfo size={42} />
      <strong>데이터를 불러오지 못했어요</strong>
      <span>{message || "Supabase 로컬 스택과 환경 변수를 확인해 주세요."}</span>
    </div>
  );
}

function EmptyState({ title = "조건에 맞는 축제가 없어요", description = "검색어나 필터 조건을 조금 넓혀보세요." }) {
  return (
    <div className="empty-state">
      <IconHome size={42} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function MobileTabs({ screen, onNavigate }) {
  const items = [
    ["explore", "탐색", IconMap],
    ["builder", "코스", IconRoute],
    ["result", "공유", IconShare],
  ];
  return (
    <nav className="mobile-tabs" aria-label="모바일 탭">
      {items.map(([id, label, Icon]) => (
        <button key={id} className={(screen === id || (screen === "detail" && id === "explore")) ? "active" : ""} onClick={() => onNavigate(id)}>
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function SeasonParticles({ kind }) {
  if (!kind) return null;
  const marks = kind === "snow" ? ["*", "·", "✦"] : kind === "leaf" ? ["⌁", "◆", "﹏"] : ["✿", "·", "✧"];
  return <div className={`season-particles ${kind}`}>{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ left: `${(index * 17) % 100}%`, animationDelay: `${(index % 8) * 0.6}s` }}>{marks[index % marks.length]}</span>)}</div>;
}

function PlaceMini({ place }) {
  return (
    <div className="place-mini">
      <TypeIcon type={place.type} />
      <div>
        <strong>{place.name}</strong>
        <TypeLabel type={place.type} />
      </div>
    </div>
  );
}

function TypePill({ label, icon: Icon }) {
  return <span className="type-pill"><Icon size={14} />{label}</span>;
}

function TypeIcon({ type }) {
  const meta = typeMeta[type] || typeMeta.spot;
  const Icon = meta.icon;
  return <span className="type-icon" style={{ "--type-color": meta.color, "--type-bg": meta.bg }}><Icon size={16} /></span>;
}

function TypeLabel({ type }) {
  const meta = typeMeta[type] || typeMeta.spot;
  return <span className="type-label" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>;
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="stat">
      <Icon size={18} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function categoryIcon(category) {
  return categories.find((item) => item.id === category)?.icon || IconSpark;
}

function festivalPoint(festival) {
  const map = {
    boryeong: { x: 45, y: 40 },
    jinhae: { x: 63, y: 67 },
    hwacheon: { x: 60, y: 18 },
    jarasum: { x: 53, y: 25 },
    tongyeong: { x: 58, y: 77 },
    "gangneung-coffee": { x: 70, y: 28 },
    "jeju-fire": { x: 31, y: 90 },
  };
  return map[festival.id] || { x: 55, y: 45 };
}

function IconBase({ size = 18, children, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
function IconSearch(props) { return <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></IconBase>; }
function IconBell(props) { return <IconBase {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></IconBase>; }
function IconMap(props) { return <IconBase {...props}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" /><path d="M9 3v15" /><path d="M15 6v15" /></IconBase>; }
function IconRoute(props) { return <IconBase {...props}><circle cx="6" cy="19" r="3" /><path d="M9 19h8a3 3 0 0 0 0-6H7a3 3 0 0 1 0-6h8" /><circle cx="18" cy="5" r="3" /></IconBase>; }
function IconBookmark(props) { return <IconBase {...props}><path d="M19 21 12 17 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /></IconBase>; }
function IconShare(props) { return <IconBase {...props}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" /></IconBase>; }
function IconCalendar(props) { return <IconBase {...props}><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /></IconBase>; }
function IconList(props) { return <IconBase {...props}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></IconBase>; }
function IconSliders(props) { return <IconBase {...props}><path d="M4 6h10" /><path d="M18 6h2" /><path d="M4 12h3" /><path d="M11 12h9" /><path d="M4 18h12" /><path d="M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></IconBase>; }
function IconCheck(props) { return <IconBase {...props}><path d="m20 6-11 11-5-5" /></IconBase>; }
function IconInfo(props) { return <IconBase {...props}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></IconBase>; }
function IconTicket(props) { return <IconBase {...props}><path d="M2 9a3 3 0 0 0 0 6v3h20v-3a3 3 0 0 0 0-6V6H2Z" /><path d="M13 6v12" /></IconBase>; }
function IconLeaf(props) { return <IconBase {...props}><path d="M11 20A7 7 0 0 1 4 13C4 6 13 4 20 4c0 7-2 16-9 16Z" /><path d="M7 17c3-4 6-7 11-10" /></IconBase>; }
function IconMusic(props) { return <IconBase {...props}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></IconBase>; }
function IconWave(props) { return <IconBase {...props}><path d="M3 15c3 2 6 2 9 0s6-2 9 0" /><path d="M3 9c3 2 6 2 9 0s6-2 9 0" /></IconBase>; }
function IconLandmark(props) { return <IconBase {...props}><path d="M3 21h18" /><path d="M5 21V10" /><path d="M19 21V10" /><path d="M12 3 3 8h18Z" /><path d="M9 21V10" /><path d="M15 21V10" /></IconBase>; }
function IconFork(props) { return <IconBase {...props}><path d="M6 3v7" /><path d="M10 3v7" /><path d="M8 3v18" /><path d="M18 3v18" /><path d="M16 3c3 3 3 6 0 9" /></IconBase>; }
function IconSpark(props) { return <IconBase {...props}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z" /></IconBase>; }
function IconPin(props) { return <IconBase {...props}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></IconBase>; }
function IconBed(props) { return <IconBase {...props}><path d="M3 7v11" /><path d="M21 11v7" /><path d="M3 14h18" /><path d="M7 11h5a2 2 0 0 0 0-4H7Z" /></IconBase>; }
function IconImageOff(props) { return <IconBase {...props}><path d="M10.5 10.5 21 21" /><path d="M21 15V5a2 2 0 0 0-2-2H9" /><path d="M3 3l18 18" /><path d="M3 9v10a2 2 0 0 0 2 2h10" /><path d="m8 14 2-2 2 2 1-1 4 4" /></IconBase>; }
function IconArrowLeft(props) { return <IconBase {...props}><path d="m15 18-6-6 6-6" /></IconBase>; }
function IconChevronDown(props) { return <IconBase {...props}><path d="m6 9 6 6 6-6" /></IconBase>; }
function IconCar(props) { return <IconBase {...props}><path d="M3 13h18l-2-5H5Z" /><path d="M5 13v5" /><path d="M19 13v5" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></IconBase>; }
function IconPlus(props) { return <IconBase {...props}><path d="M12 5v14" /><path d="M5 12h14" /></IconBase>; }
function IconMinus(props) { return <IconBase {...props}><path d="M5 12h14" /></IconBase>; }
function IconLocate(props) { return <IconBase {...props}><path d="M12 2v3" /><path d="M12 19v3" /><path d="M2 12h3" /><path d="M19 12h3" /><circle cx="12" cy="12" r="6" /></IconBase>; }
function IconX(props) { return <IconBase {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></IconBase>; }
function IconHome(props) { return <IconBase {...props}><path d="m3 10 9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></IconBase>; }
function IconDownload(props) { return <IconBase {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></IconBase>; }
function IconWallet(props) { return <IconBase {...props}><path d="M3 7h18v14H3Z" /><path d="M16 12h5" /><path d="M3 7l3-4h12l3 4" /></IconBase>; }
