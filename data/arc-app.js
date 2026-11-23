/* Atlas Indikator Profil Kesehatan Indonesia
   Client-side app. Hash routes: #/  #/telusuri?q=  #/indikator/<id>  #/metode  #/masukan  #/akun
   Static data: data/manifest.json, data/catalog.json.gz, data/availability.json, data/geo/id_prov.topo.json.
   Values: ../api/ind/<id> from the data server (server/pk_api.py), one indicator at a time under a daily limit;
   ../api/me, signup (name, institution, email; an emailed access link), logout. No external scripts or fonts. */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ state and helpers */
  const state = {
    lang: "id", manifest: null, catalog: null, avail: null, topo: null,
    byId: new Map(), topicById: new Map(), bookBySource: new Map(), facts: new Map(), groups: new Map(),
    preview: null, shown: 12
  };
  try { const l = localStorage.getItem("pk-lang"); if (l === "en" || l === "id") state.lang = l; } catch (e) { /* storage blocked */ }
  const L = (id, en) => (state.lang === "en" ? en : id);
  const LOC = () => (state.lang === "en" ? "en-GB" : "id-ID");
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nfInt = () => new Intl.NumberFormat(LOC());
  const fint = (n) => nfInt().format(n);
  const fpct = (x, d) => new Intl.NumberFormat(LOC(), { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }).format(x * 100);
  function fval(v) {
    if (v == null) return "";
    const a = Math.abs(v);
    return new Intl.NumberFormat(LOC(), { maximumFractionDigits: a >= 1 ? 2 : 4 }).format(v);
  }
  function faxis(v, span) {
    const a = Math.max(Math.abs(v), span || 0);
    if (a >= 10000) return new Intl.NumberFormat(LOC(), { notation: "compact", maximumFractionDigits: 1 }).format(v);
    return new Intl.NumberFormat(LOC(), { maximumFractionDigits: 2 }).format(v);
  }
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  /* headings capitalise each word (PI comment 26 Oct), Indonesian style: small connecting words stay lower case unless
     they open the heading; words already in capitals (DBD, JKN) and words with digits stay as they are; headlines
     written as sentences (the insight and profile cards) are left alone */
  const TC_SMALL = new Set("dan di ke dari yang untuk atau pada per dengan menurut terhadap dalam oleh atas sebagai antara serta bagi tentang sejak hingga sampai of and the in by for to on at or vs".split(" "));
  const TC_SEL = "h1, h2, h3, .ft2", TC_SKIP = ".dicard, .ins, .ditext, .instext, .sugg, .pvbody, .art, .artlist, .bcard, .astrack";
  function titleCaseEl(el) {
    if (el.dataset.tc === "1" || el.closest(TC_SKIP)) return;
    el.dataset.tc = "1";
    let first = true;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      n.nodeValue = n.nodeValue.replace(/[A-Za-z\u00C0-\u024F][\w'\u2019\u00C0-\u024F]*/g, (w) => {
        const lw = w.toLowerCase(), was = first; first = false;
        if (/\d/.test(w) || w !== lw) return w;          // capitals or digits as printed
        if (!was && TC_SMALL.has(lw)) return lw;
        return w.charAt(0).toUpperCase() + w.slice(1);
      });
    }
  }
  const titleCaseAll = (root) => (root || document).querySelectorAll(TC_SEL).forEach(titleCaseEl);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const ICON = {
    search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true" class="ic"><circle cx="8.5" cy="8.5" r="5.5"></circle><path d="M13 13l4.5 4.5"></path></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" class="ic"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" class="ic"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"></path></svg>',
    dl: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true" class="ic"><path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 16.5h12"></path></svg>',
    link: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true" class="ic"><path d="M8.5 11.5l3-3M7 9l-2 2a2.5 2.5 0 003.5 3.5l2-2M13 11l2-2A2.5 2.5 0 0011.5 5.5l-2 2"></path></svg>',
    copy: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true" class="ic"><rect x="7" y="7" width="9" height="9"></rect><path d="M4 13V4h9"></path></svg>',
    ext: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true" class="ic"><path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4"></path></svg>',
    up: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" class="ic"><path d="M10 16V4M4.5 9.5L10 4l5.5 5.5"></path></svg>',
    down: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" class="ic"><path d="M10 4v12M4.5 10.5L10 16l5.5-5.5"></path></svg>',
    flat: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" class="ic"><path d="M3 10h14M12 5l5 5-5 5"></path></svg>',
    pin: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" class="ic"><path d="M10 18s-5.5-5.6-5.5-9.5a5.5 5.5 0 0111 0C15.5 12.4 10 18 10 18z"></path><circle cx="10" cy="8.5" r="2"></circle></svg>',
    book: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" class="ic"><path d="M3 4.5h5.5A1.5 1.5 0 0110 6v10a1.5 1.5 0 00-1.5-1.5H3zM17 4.5h-5.5A1.5 1.5 0 0010 6v10a1.5 1.5 0 011.5-1.5H17z"></path></svg>',
    check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" class="ic"><path d="M4 10.5l4 4 8-9"></path></svg>',
    half: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" class="ic"><path d="M3 15l5-5 3 3 6-7"></path><path d="M10 3v14" stroke-dasharray="2 2"></path></svg>',
    cross: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" class="ic"><path d="M5 5l10 10M15 5L5 15"></path></svg>',
    ask: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" class="ic"><path d="M7.5 7.5a2.5 2.5 0 115 .5c0 1.6-2.5 2-2.5 3.5M10 15v.5"></path></svg>',
    full: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" class="ic"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5"></path></svg>',
    alert: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" class="ic"><path d="M10 3l8 14H2z"></path><path d="M10 8.5v4M10 14.5v.5"></path></svg>'
  };
  const TREND_ICON = { yes: "check", within_period: "half", no: "cross", unknown: "ask" };
  const LOGO = '<img class="logo" src="assets/arc-logo.png" alt="ARC Institute" width="512" height="512">';

  const TOPIC_COLOR = {
    "health-workforce-facilities-education": "#4E6680", "maternal-newborn-child-health": "#AF5D43", "other-health-statistics": "#687487",
    "communicable-diseases-surveillance": "#0F766E", "population-demography-mortality": "#1F6E8C", "health-services-coverage": "#4568A8",
    "financing-governance-administration": "#885E34", "emergency-disaster-health-security": "#B14B40", "nutrition": "#8B6F20",
    "medicines-medical-technology": "#9B4B57", "environmental-health-sanitation": "#3E7E62",
    "noncommunicable-diseases-risk-factors": "#7C3D73", "health-promotion-behaviour": "#C07A28"
  };
  const IPOO = {
    input: ["Input", "Input"], process: ["Proses", "Process"], output: ["Output", "Output"], outcome: ["Outcome", "Outcome"],
    context: ["Konteks", "Context"]
  };
  const WHO = {
    health_status: ["Status kesehatan", "Health status"], service_delivery: ["Penyelenggaraan layanan", "Service delivery"],
    health_information: ["Informasi kesehatan", "Health information"], medical_products: ["Produk medis", "Medical products"],
    governance: ["Tata kelola", "Governance"], other: ["Lainnya", "Other"], financing: ["Pembiayaan", "Financing"],
    health_workforce: ["Tenaga kesehatan", "Health workforce"]
  };
  const MEASURE = {
    percent: ["Persen", "Percent"], count: ["Jumlah", "Count"], rate: ["Angka per penduduk", "Rate"], ratio: ["Rasio", "Ratio"],
    currency: ["Rupiah", "Currency"], index: ["Indeks", "Index"], average: ["Rata-rata", "Average"], other: ["Lainnya", "Other"],
    change: ["Perubahan", "Change"], difference: ["Selisih", "Difference"]
  };
  const MEASURE_GROUP = (m) => (m === "change" || m === "difference" ? "other" : m);
  const TREND = {
    yes: { id: "Deret sebanding lintas buku", en: "Comparable series across books", color: "#0d8a9b",
      xid: "Semua buku yang memuat indikator ini menggunakan definisi dan satuan yang sama. Karena itu, titik-titiknya dapat dihubungkan dengan garis.",
      xen: "Every book that includes this indicator uses the same definition and unit. The points can therefore be joined by a line." },
    within_period: { id: "Sebanding di dalam periode definisi", en: "Comparable within a definition period", color: "#b18421",
      xid: "Definisi indikator berbeda antara satu periode dan periode lain. Hubungkan titik hanya dalam periode dengan definisi yang sama, dan jangan tarik garis melintasi perubahan definisi.",
      xen: "The indicator definition differs across periods. Join points only within a period that uses one definition, and do not draw a line across a definition change." },
    no: { id: "Tidak dibaca sebagai deret", en: "Not read as a series", color: "#9aa6b2",
      xid: "Indikator ini hanya tercantum dalam satu buku atau definisinya berbeda antarbuku. Bacalah nilainya untuk setiap tahun secara terpisah, bukan sebagai deret waktu.",
      xen: "The indicator appears in only one book, or its definition differs across books. Read each year's value separately, not as a time series." },
    unknown: { id: "Keterbandingan belum dapat dinilai", en: "Comparability cannot yet be assessed", color: "#697583",
      xid: "Kesamaan definisi indikator ini antarbuku belum dapat dipastikan. Periksa tabel sumber dan baca datanya satu buku demi satu buku sebelum membandingkan.",
      xen: "The available information does not yet show whether the definition is consistent across books. Check the source table and review each book separately before comparing." }
  };
  const trendLabel = (t) => (TREND[t] ? (state.lang === "en" ? TREND[t].en : TREND[t].id) : t);
  const NOTE_LABEL = {
    converted_scale: ["Skala dikonversi", "Scale converted"], converted_currency: ["Mata uang dikonversi", "Currency converted"],
    converted_rate: ["Angka dikonversi", "Rate converted"], unit_mismatch: ["Satuan tidak cocok", "Unit mismatch"],
    chart_series_unknown: ["Seri grafik tidak diketahui", "Chart series unknown"], row_unlabelled: ["Baris tanpa label", "Row without label"],
    row_not_province: ["Baris bukan provinsi", "Row is not a province"],
    year_implausible: ["Tahun tidak masuk akal", "Implausible year"], value_out_of_range: ["Nilai di luar rentang", "Value out of range"],
    distribution_total: ["Total distribusi", "Distribution total"], value_is_year: ["Nilai berupa tahun", "Value is a year"],
    corrected_scale: ["Skala dikoreksi (salah baca pemisah atau satuan)", "Scale corrected (separator or unit misread)"],
    outlier_excluded: ["Dikeluarkan dari grafik (salah baca)", "Left out of the charts (misread)"],
    wrong_indicator: ["Milik indikator lain", "Belongs to another indicator"],
    label_noise: ["Label kelompok tidak terbaca", "Group label unreadable"]
  };
  const PALETTE = ["#002147", "#0d8a9b", "#b18421", "#b85742", "#008c63", "#7c3d73", "#4568a8", "#697583"];
  const RAMP = [["#e9eef3", "#162230"], ["#c9d6e3", "#162230"], ["#8fa9c5", "#162230"], ["#4f739a", "#ffffff"], ["#1f3d63", "#ffffff"]];
  const RAMP_BREAKS = [1, 10, 50, 150, 400];
  const rampOf = (n) => { let k = 0; RAMP_BREAKS.forEach((b, i) => { if (n >= b) k = i; }); return RAMP[k]; };
  // two tones (PI comment 23 Oct: "sepertinya warna perlu 2 tone"): sand and gold for low values, blue to navy for high
  // ones; lightness still falls from one end to the other, so the order reads at a glance
  const MAPRAMP = ["#f6ecd0", "#e3c785", "#a9bcd2", "#4f73a1", "#002147"];
  const DATA = "data/", API = "../api/";
  /* one page per indicator (PI 23 Nov 2026: "harusnya jadi satu saja, tapi ada tab metadatanya"): the indicator lives at
     app/indikator/<id>/, a static page built by pipeline/build_pages.py that carries the metadata for readers and search
     engines and runs this app with <base href> at the app root. There the hash holds only the view (#tab=map&r=P3) or
     "#metadata"; an old #/indikator/<id> link on the app's own page is sent on to the indicator page */
  const PATH_ID = (() => { const m = /\/indikator\/([^/]+)\/(?:index\.html)?$/.exec(location.pathname); return m ? decodeURIComponent(m[1]) : ""; })();
  const APPROOT = location.pathname.replace(/indikator\/[^/]+\/(?:index\.html)?$|[^/]*$/, "");
  const indHref = (id, qs) => APPROOT + "indikator/" + encodeURIComponent(id) + "/" + (qs ? "#" + qs : "");
  // the view part of the address: after "?" on the app's page, the whole hash on the indicator page
  const viewQs = () => (PATH_ID ? (location.hash === "#metadata" ? "" : location.hash.replace(/^#\??/, "")) : (location.hash.split("?")[1] || ""));
  // the static theme, subtheme and indicator pages (pipeline/build_pages.py): links to them only once they are published
  const PAGES = true;   // the static theme pages are live (24 Oct): the nav and every indicator's crumbs link to them (survey
                        // indicators and their subthemes have pages since 24 Oct, pipeline/build_pages.py)
  const topicLabel = (t) => (state.lang === "en" ? t.label_en : t.label_id);
  const indName = (i) => (state.lang === "en" && i.name_en ? i.name_en : i.name_id);
  const indName2 = (i) => (state.lang === "en" ? i.name_id : i.name_en);

  // .gz files are fetched as bytes and inflated here; a server that already decoded them (Content-Encoding) is
  // recognised by the missing gzip magic bytes, whatever headers it sends
  async function getBytes(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(url + " (" + response.status + ")");
    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      if (!("DecompressionStream" in window)) throw new Error("Browser tidak mendukung data terkompresi / browser lacks gzip support");
      return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    }
    return new TextDecoder("utf-8").decode(buf);
  }
  async function getJson(url) { return JSON.parse(await getBytes(url)); }

  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details.fdrop")) return;
    if (d.open) { $$("details.fdrop[open]").forEach((x) => { if (x !== d) x.open = false; }); state._openDrop = d.getAttribute("data-k"); }
    else if (state._openDrop === d.getAttribute("data-k")) state._openDrop = null;
  }, true);
  // the insight row on Home: the previous arrow shows once the row has moved, the next arrow hides at its end
  document.addEventListener("scroll", (e) => {
    const tr = e.target;
    if (!tr || tr.id !== "ditrack") return;
    const pv = $(".dinav.prev"), nx = $(".dinav.next");
    if (pv) pv.hidden = tr.scrollLeft < 10;
    if (nx) nx.hidden = tr.scrollLeft + tr.clientWidth >= tr.scrollWidth - 10;
  }, true);
  document.addEventListener("click", (e) => {
    if (e.target.closest && !e.target.closest(".imgdd")) $$("details.imgdd[open]").forEach((x) => { x.open = false; });
    if (!e.target.closest || e.target.closest(".fdrop")) return;
    $$("details.fdrop[open]").forEach((x) => { x.open = false; });
    state._openDrop = null;
  });
  async function loadCore() {
    const [manifest, catalog, avail, featured, articles] = await Promise.all([
      getJson(DATA + "manifest.json"), getJson(DATA + "catalog.json.gz"), getJson(DATA + "availability.json"),
      getJson(DATA + "featured.json").catch(() => null), PAGES ? getJson("articles/index.json").catch(() => null) : null
    ]);
    state.manifest = manifest; state.catalog = catalog; state.avail = avail; state.featured = featured; state.articles = articles;
    catalog.topics.forEach((t) => state.topicById.set(t.id, t));
    catalog.books.forEach((b) => state.bookBySource.set(b.id, b));
    catalog.indicators.forEach((i) => {
      state.byId.set(i.id, i);
      i._topic = state.topicById.get(i.topic);
      if (!state.subById) { state.subById = new Map(); catalog.topics.forEach((tp) => (tp.subs || []).forEach((sb) => state.subById.set(sb.id, sb))); }
      i._name = norm(i.name_id + " " + i.name_en);
      i._all = i._name + " " + norm([i.id, i.unit, i._topic && i._topic.short_id, i.numerator, i.denominator, i.def_id].join(" "));
      i._nb = i.district_only ? i.district_only.books : (i.books || []).length;
    });
  }
  /* values come from the data server one indicator at a time (PI 22 Oct): without an account one network may open
     50 distinct indicators a day, with a free atlas account 200 and the CSV downloads; ARC staff have no limit */
  async function loadMe() {
    try { const r = await fetch(API + "me", { credentials: "same-origin", cache: "no-store" }); if (r.ok) state.me = await r.json(); } catch (e) { /* the atlas still opens */ }
    paintAcct();
    return state.me;
  }
  function quotaFrom(res) {
    const t = res.headers.get("X-Quota-Tier");
    if (!t) return;
    const lim = +res.headers.get("X-Quota-Limit") || null, used = +res.headers.get("X-Quota-Used") || 0;
    state.me = Object.assign({}, state.me || {}, { tier: t, limit: lim, used: used, remaining: lim ? Math.max(lim - used, 0) : null });
    paintAcct();
  }
  const canDl = () => !!(state.me && (state.me.tier === "user" || state.me.tier === "staff"));
  const limits = () => (state.me && state.me.limits) || { anon: 50, user: 200 };
  function paintAcct() { const el = $("#acct"); if (el) el.outerHTML = acctHtml(); }
  // a person icon at the end of the top bar, next to the language toggle (PI comment 18 Nov: "ini tidak perlu, buat icon
  // orang saja di ujung dekat dengan toggle bahasa"); the name and the quota left today move into its label
  function acctHtml() {
    const m = state.me;
    const who = m && m.tier !== "anon" ? (m.name || L("Akses data", "Data access")) : L("Akses data", "Data access");
    const left = m && m.limit ? " · " + L(fint(m.remaining) + " tersisa hari ini", fint(m.remaining) + " left today") : "";
    return '<a id="acct" class="acct acct-ic' + (m && m.tier !== "anon" ? " on" : "") + '" href="#/akun"' + (m && m.tier !== "anon" ? "" : ' data-a="access"') +
      ' aria-label="' + esc(who + left) + '" title="' + esc(who + left) + '">' + ICON.user + "</a>";
  }
  function limitHtml(x) {
    x = x || {};
    const lim = x.limits || limits();
    if (x.tier === "user") return '<div class="warn lim"><b>' + L("Batas harian tercapai.", "Daily limit reached.") + "</b> " +
      L("Anda sudah membuka " + fint(lim.user) + " indikator hari ini. Indikator yang sudah dibuka hari ini tetap dapat dilihat; batas kembali pukul 00.00 WIB. Untuk kebutuhan data yang lebih besar, hubungi ",
        "You have opened " + fint(lim.user) + " indicators today. Indicators already opened today stay available; the limit resets at 00:00 Jakarta time. For larger data needs, contact ") +
      '<a href="mailto:partnership@arcinstitute.or.id">partnership@arcinstitute.or.id</a>.</div>';
    return '<div class="warn lim"><b>' + L("Batas harian tercapai.", "Daily limit reached.") + "</b> " +
      L("Satu jaringan dapat membuka " + fint(lim.anon) + " indikator per hari. Dengan nama, institusi dan email: " + fint(lim.user) + " indikator per hari dan unduhan CSV, gratis. Atau kembali setelah pukul 00.00 WIB.",
        "One network can open " + fint(lim.anon) + " indicators a day. With your name, institution and email: " + fint(lim.user) + " a day and CSV downloads, free. Or come back after 00:00 Jakarta time.") +
      '<div class="rowbtn"><button type="button" class="btn sm" data-a="access">' + L("Isi nama dan email", "Enter name and email") + "</button></div></div>";
  }
  // the values are open from Indonesia only (PI 22 Oct); ARC staff signed in with the ARC account anywhere
  const countryHtml = () => '<div class="warn lim"><b>' + L("Hanya dari Indonesia.", "From Indonesia only.") + "</b> " +
    L("Nilai indikator atlas ini hanya dapat dibuka dari jaringan di Indonesia. Definisi, sumber dan katalog indikator tetap dapat dibaca. Untuk kerja sama data dari luar Indonesia, hubungi ",
      "The values of this atlas can only be opened from a network in Indonesia. The definitions, sources and the indicator catalogue stay readable. For data collaboration from outside Indonesia, contact ") +
    '<a href="mailto:partnership@arcinstitute.or.id">partnership@arcinstitute.or.id</a>.</div>';
  const loadErr = (e, fallback) => (e.limit ? limitHtml(e.limit) : e.country ? countryHtml() : fallback);
  // where an anonymous visitor would see a CSV button: the short form first, then the download it was clicked for
  const dlGate = (id, w) => '<button type="button" class="btn sm ol" data-a="access"' + (id ? ' data-dlid="' + esc(id) + '" data-dlw="' + (w || "all") + '"' : "") + ">" + ICON.dl + L("Unduh CSV", "Download CSV") + "</button>";
  function loadTopo() {
    if (!state.topo) state.topo = getJson(DATA + "geo/id_prov.topo.json").then(decodeTopo);
    return state.topo;
  }
  /* decoded rows of one indicator, cached */
  async function indicatorRows(ind) {
    if (state.groups.has(ind.id)) return state.groups.get(ind.id);
    const res = await fetch(API + "ind/" + encodeURIComponent(ind.id), { credentials: "same-origin" });
    quotaFrom(res);
    if (res.status === 429) { const e = new Error("limit"); e.limit = await res.json().catch(() => ({})); throw e; }
    if (res.status === 403) { await res.text().catch(() => ""); const e = new Error("country"); e.country = true; throw e; }
    if (!res.ok) { await res.text().catch(() => ""); throw new Error(L("server data menjawab ", "the data server answered ") + res.status); }
    const F = await res.json();
    // a measure set (count, percent, rate of one thing) arrives in one response: every member is kept, so the
    // measure switch needs no further request and costs nothing of the daily limit
    const per = F.indicators.map(() => []);
    for (const r of F.rows) per[r[0]].push({ y: r[1], geo: r[2], prov: r[3], cat: r[4], bd: r[5], v: r[6], tab: r[7], row: r[8], col: r[9], ver: r[10], note: r[11], per: r[12] });
    F.indicators.forEach((id, k) => { if (!state.groups.has(id)) state.groups.set(id, { F, rows: per[k] }); });
    return state.groups.get(ind.id) || { F, rows: [] };
  }

  /* ------------------------------------------------------------------ topology and map */
  function decodeTopo(t) {
    const sc = t.transform.scale, tr = t.transform.translate;
    const arcs = t.arcs.map((a) => { let x = 0, y = 0; return a.map((p) => { x += p[0]; y += p[1]; return [x * sc[0] + tr[0], y * sc[1] + tr[1]]; }); });
    const K = 21.65, X0 = 94.9, Y0 = 6.3;
    const proj = (p) => [(p[0] - X0) * K, (Y0 - p[1]) * K];
    const ring = (idxs) => {
      const pts = [];
      idxs.forEach((i) => { let a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; if (pts.length) a = a.slice(1); a.forEach((p) => pts.push(p)); });
      return pts.map(proj);
    };
    const out = {};
    t.objects.provinces.geometries.forEach((g) => {
      const polys = g.type === "Polygon" ? [g.arcs] : g.arcs;
      let d = "";
      polys.forEach((poly) => poly.forEach((r) => { d += "M" + ring(r).map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z"; }));
      out[g.properties.name] = d;
    });
    return out;
  }

  /* ------------------------------------------------------------------ routing */
  function parseHash() {
    let h = location.hash.replace(/^#/, "");
    if (PATH_ID && !h.startsWith("/")) return { parts: ["indikator", PATH_ID], q: new URLSearchParams(h === "metadata" ? "" : h.replace(/^\?/, "")), meta: h === "metadata" };
    if (!h.startsWith("/")) h = "/" + h;
    const i = h.indexOf("?");
    const path = i < 0 ? h : h.slice(0, i), qs = i < 0 ? "" : h.slice(i + 1);
    return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs) };
  }
  function hashFor(path, params) {
    const p = new URLSearchParams();
    Object.keys(params || {}).forEach((k) => { if (params[k] !== "" && params[k] != null) p.set(k, params[k]); });
    const s = p.toString();
    const ip = /^\/indikator\/([^/?]+)$/.exec(path);   // the indicator page (23 Nov): its own address, the view after "#"
    if (ip) return APPROOT + "indikator/" + ip[1] + "/" + (s ? "#" + s : "");
    return "#" + path + (s ? "?" + s : "");
  }
  const root = () => $("#root");
  function shell() {
    if (!$("#hdr")) root().innerHTML = '<div id="hdr"></div><main id="main" tabindex="-1"></main><div id="ftr"></div>';
  }
  function setTitle(t) { document.title = (t ? t + " | " : "") + L("Atlas Indikator Profil Kesehatan Indonesia", "Indonesia Health Profile Indicator Atlas") + " | ARC Institute"; }

  let currentRoute = "";
  async function route() {
    const h0 = location.hash, ih = /^#\/indikator\/([^?]+)(?:\?(.*))?$/.exec(h0);
    if (PATH_ID && h0.startsWith("#/")) {   // another view of the atlas: the app's own page; another indicator: its page
      if (ih && decodeURIComponent(ih[1]) === PATH_ID) history.replaceState(null, "", location.pathname + location.search + (ih[2] ? "#" + ih[2] : ""));
      else { location.replace(ih ? indHref(decodeURIComponent(ih[1]), ih[2]) : APPROOT + h0); return; }
    } else if (!PATH_ID && ih) { location.replace(indHref(decodeURIComponent(ih[1]), ih[2])); return; }
    shell();
    const r = parseHash();
    const page = r.parts[0] || "";
    const main = $("#main");
    document.documentElement.lang = state.lang;
    if (!state.catalog) {
      if (!PATH_ID) main.innerHTML = '<div class="wrap"><p class="loading">' + L("Memuat katalog indikator...", "Loading the indicator catalogue...") + "</p></div>";
      renderHeader(page, r);
      try { await loadCore(); loadMe(); } catch (e) {
        main.innerHTML = '<div class="wrap"><div class="warn" style="margin:40px 0"><b>' + L("Data tidak dapat dimuat.", "Data could not be loaded.") + "</b> " + esc(e.message) + ' <a href="" onclick="location.reload();return false">' + L("Muat ulang", "Reload") + "</a></div></div>";
        return;
      }
    }
    renderHeader(page, r);
    renderFooter();
    const key = location.hash;
    currentRoute = key;
    if (page === "telusuri") { state.shown = 12; pageSearch(r); }
    else if (page === "indikator") await pageIndicator(r);
    else if (page === "jelajah") {
      state.hx = { t: r.q.get("t") || "", u: r.q.get("u") || "", i: r.q.get("i") || "", s: r.q.get("s") || "all", q: "", lim: 40 };
      if (state.hx.t) state.hxSeen = true;  // a link that already names a theme opens without the intro
      pageHome(); state._scroll = "pilih";
    }
    else if (page === "akun") pageAccount(r);
    else if (page === "pemantau") await pageUsage();
    else if (page === "metode" && r.parts[1] === "subnasional") await pageSubnational();
    else if (page === "metode" || page === "unduh") { if (page === "unduh") state._scroll = "berkas"; pageMethod(); }
    else if (page === "masukan") { pageHome(); const t = "#fbform"; if (r.q.get("i")) { const f = $("#fb-i"); if (f) f.value = r.q.get("i"); } setTimeout(() => { const el = $(t); if (el) el.scrollIntoView(); }, 30); return; }
    else pageHome();
    window.scrollTo(0, 0);
    // from the step-by-step picker: open the indicator at its series (v=trend) or its province map (v=geo)
    if (page === "indikator" && r.q.get("v")) { const el = document.getElementById(r.q.get("v") === "geo" ? "prov" : "f-series"); if (el) el.scrollIntoView(); }
    if ((page === "metode" || page === "unduh" || page === "jelajah") && state._scroll) { const el = document.getElementById(state._scroll); state._scroll = null; if (el) el.scrollIntoView(); }
  }

  /* ------------------------------------------------------------------ chrome */
  function renderHeader(page, r) {
    const q = page === "telusuri" ? r.q.get("q") || "" : "";
    // top bar (PI 24 Oct: "harusnya di top bar ada Home dan Subnasional"): Beranda, Telusuri, Tema, Subnasional, Metode
    const sub = page === "metode" && r.parts[1] === "subnasional";
    const nav = (href, label, on) => '<a href="' + href + '"' + (on ? ' aria-current="page"' : "") + ">" + label + "</a>";
    $("#hdr").innerHTML =
      '<header class="hd"><div class="wrap">' +
      '<a class="brand" href="#/" aria-label="ARC Institute">' + LOGO + "</a>" +
      '<a class="tool" href="#/" aria-label="' + L("Atlas Profil Kesehatan, beranda alat", "Health Profile Atlas, tool home") + '"><b>Profil Kesehatan</b><span>' + L("Atlas indikator", "Indicator atlas") + "</span></a>" +
      '<nav class="nav" id="nav" aria-label="Atlas Profil Kesehatan">' + nav("#/", L("Beranda", "Home"), page === "") + nav("#/telusuri", L("Telusuri", "Browse"), page === "telusuri") + (PAGES ? '<a href="tema/">' + L("Tema", "Themes") + "</a>" : "") + nav("#/metode/subnasional", L("Subnasional", "Subnational"), sub) + nav("#/metode", L("Metode", "Method"), page === "metode" && !sub) + (PAGES ? '<a href="articles/">' + L("Artikel", "Articles") + "</a>" : "") + nav("#/akun", L("Akses data", "Data access"), page === "akun") + '<a class="xarc" href="/tools/">Explore ARC</a>' + "</nav>" +
      '<div class="right">' +
      '<a class="xarc2" href="/tools/">Explore ARC</a>' +
      '<div class="hsearch"><label class="vh" for="hq">' + L("Cari di Atlas Profil Kesehatan", "Search the Health Profile Atlas") + "</label>" + ICON.search +
      '<input id="hq" type="search" autocomplete="off" placeholder="' + L("Cari indikator", "Search indicators") + '" value="' + esc(q) + '"><kbd>/</kbd><div class="sugg" id="sugg" role="listbox" hidden></div></div>' +
      '<button type="button" class="iconbtn isearch" data-a="stoggle" aria-label="' + L("Cari di Atlas Profil Kesehatan", "Search the Atlas") + '">' + ICON.search + "</button>" +
      '<div class="lang" role="group" aria-label="' + L("Bahasa", "Language") + '"><a href="#" data-a="lang" data-v="id" ' + (state.lang === "id" ? 'aria-current="true"' : "") + ">ID</a><a href=\"#\" data-a=\"lang\" data-v=\"en\" lang=\"en\" " + (state.lang === "en" ? 'aria-current="true"' : "") + ">EN</a></div>" + acctHtml() +
      '<button type="button" class="iconbtn menu" data-a="mtoggle" aria-label="' + L("Buka menu", "Open menu") + '" aria-expanded="false">' + ICON.menu + "</button>" +
      "</div></div></header>";
  }
  function renderFooter() {
    const m = state.manifest, c = m.coverage;
    $("#ftr").innerHTML =
      '<footer class="ft"><div class="wrap"><div class="cols">' +
      "<div><h2>" + L("Atlas Indikator Profil Kesehatan Indonesia", "Indonesia Health Profile Indicator Atlas") + "</h2>" +
      "<p>" + L("Periksa definisi dan tabel sumber sebelum membandingkan angka antarbuku.", "Check the definition and the source table before comparing figures across books.") + "</p></div>" +
      "<div><h2>" + L("Data dan metode", "Data and method") + "</h2><ul>" +
      '<li><a href="#/metode">' + L("Cara angka dibaca dari buku", "How figures are read from the books") + "</a></li>" +
      '<li><a href="#/metode" data-s="status">' + L("Status keterbandingan", "Comparability status") + "</a></li>" +
      '<li><a href="#/akun">' + L("Akses data", "Data access") + "</a></li>" +
      '<li><a href="#/metode/subnasional">' + L("Data subnasional", "Subnational data") + "</a></li>" +
      "</ul></div>" +
      "<div><h2>" + L("Bantuan", "Help") + "</h2><ul>" +
      '<li><a href="#/masukan">' + L("Laporkan angka yang salah baca", "Report a misread figure") + "</a></li>" +
      '<li><a href="#/masukan">' + L("Usulkan indikator", "Suggest an indicator") + "</a></li>" +
      '<li><a href="mailto:partnership@arcinstitute.or.id">' + L("Hubungi ARC Institute", "Contact ARC Institute") + "</a></li></ul></div></div>" +
      '<div class="legal"><a class="bn" href="https://arcinstitute.or.id/">' + LOGO + "<b>ARC Institute</b></a>" +
      "<span>" + L("2026 ARC Institute, Yayasan Transformasi Kesejahteraan Bangsa. Konten berlisensi CC BY 4.0. Data dibangun " + m.version + ".",
        "2026 ARC Institute, Yayasan Transformasi Kesejahteraan Bangsa. Content licensed CC BY 4.0. Data built " + m.version + ".") + "</span>" +
      '<span><a href="https://arcinstitute.or.id/">' + L("Situs ARC Institute", "ARC Institute website") + "</a></span></div></div></footer>";
  }

  /* ------------------------------------------------------------------ search */
  function searchScore(i, toks, phrase) {
    let s = 0;
    for (const t of toks) {
      if (!i._all.includes(t)) return 0;
      if (i._name.startsWith(t) || i._name.includes(" " + t)) s += 10;
      else if (i._name.includes(t)) s += 6;
      else s += 2;
    }
    if (phrase && i._name.includes(phrase)) s += 15;
    return s + Math.min(i.n_years, 30) / 30 + (i.n ? 1 : 0);
  }
  function runSearch(q, limit) {
    const phrase = norm(q), toks = phrase.split(" ").filter(Boolean);
    if (!toks.length) return [];
    const out = [];
    const best = new Map();
    for (const i of state.catalog.indicators) {
      const s = searchScore(i, toks, phrase); if (s <= 0) continue;
      const t = i.set && i.set.primary !== i.id ? state.byId.get(i.set.primary) || i : i;  // a measure set is found once
      if (!best.has(t) || best.get(t) < s) best.set(t, s);
    }
    best.forEach((s, i) => out.push([s, i]));
    // a misspelt word ("indiaktor", PI 26 Oct) still finds its indicators: when nothing matches as typed, a word of the
    // name one letter off (two for long words) counts
    if (!out.length) fuzzySearch(toks).forEach((x) => out.push(x));
    out.sort((a, b) => b[0] - a[0]);
    return (limit ? out.slice(0, limit) : out).map((x) => x[1]);
  }
  function editDist(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let low = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); low = Math.min(low, cur[j]); }
      if (low > cap) return cap + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fuzzySearch(toks) {
    const out = [], best = new Map();
    for (const i of state.catalog.indicators) {
      const words = i._words || (i._words = i._name.split(" "));
      let s = 0;
      for (const t of toks) {
        if (i._name.includes(t)) { s += 6; continue; }
        const cap = t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0;
        if (!cap || !words.some((w) => editDist(t, w, cap) <= cap)) { s = 0; break; }
        s += 4;
      }
      if (s <= 0) continue;
      const t2 = i.set && i.set.primary !== i.id ? state.byId.get(i.set.primary) || i : i;
      s += Math.min(i.n_years, 30) / 30 + (i.n ? 1 : 0);
      if (!best.has(t2) || best.get(t2) < s) best.set(t2, s);
    }
    best.forEach((s, i) => out.push([s, i]));
    return out;
  }
  // Riskesdas indicators come from the national survey reports, counted in reports, not Profil books
  const isRkd = (i) => i && i.src === "rkd";
  // a measure set (msr_apply.py) is one indicator with a switch between its measures: lists show its primary only
  const listed = (i) => !(i.set && i.set.primary !== i.id);
  function msetHtml(i) {
    if (!i.set) return "";
    const q = viewQs().replace(/(^|&)(s|pk)=[^&]*/g, "").replace(/^&/, "");
    return '<div class="mset" role="group" aria-label="' + L("Ukuran", "Measure") + '"><span class="mlab">' + L("Ukuran", "Measure") + "</span>" +
      i.set.members.map((m) => '<a href="' + indHref(m.id, q) + '"' + (m.id === i.id ? ' aria-current="true"' : "") + ">" +
        esc(state.lang === "en" ? m.label_en || m.label_id : m.label_id) + "</a>").join("") + "</div>";
  }
  // Riskesdas taken out for now (PI 22 Oct): every source switch and note shows only while the data carries it
  const hasRkd = () => !!(state.manifest && state.manifest.riskesdas && state.manifest.riskesdas.indicators);
  const subOf = (i) => (i && i.sub && state.subById ? state.subById.get(i.sub) : null);
  // the survey editions shown (PI 22 Oct: SKI 2023 shown, the Riskesdas waves 2007 to 2018 held back for now)
  const SURV = () => { const r = (state.manifest && state.manifest.riskesdas && state.manifest.riskesdas.reports) || []; return r.length && r.every((y) => y >= 2023) ? "SKI" : r.some((y) => y >= 2023) ? "Riskesdas/SKI" : "Riskesdas"; };
  const SURVF = () => (SURV() === "SKI" ? "Survei Kesehatan Indonesia (SKI)" : SURV() === "Riskesdas/SKI" ? "Riskesdas dan SKI" : "Riskesdas");
  // district-only indicators (measures the provincial books or data.go.id print for districts alone, 23 Oct): their
  // books are provincial books
  // a survey indicator names its own reports (24 Oct, Riskesdas 2007-2018 and SKI 2023 merged): an SKI-only one says SKI
  const survOf = (i) => { const b = (i.books || []).map(Number); return !b.length ? SURV() : b.every((y) => y >= 2023) ? "SKI" : b.every((y) => y < 2023) ? "Riskesdas" : "Riskesdas/SKI"; };
  const bookWord = (i, n) => (isRkd(i) ? L("laporan " + survOf(i), n === 1 ? survOf(i) + " report" : survOf(i) + " reports") : i.district_only ? L("buku provinsi", n === 1 ? "provincial book" : "provincial books") : L("buku", n === 1 ? "book" : "books"));
  const srcChip = (i) => (isRkd(i) ? '<span class="tag src">' + survOf(i) + "</span>" : i.district_only ? '<span class="tag src">' + L("Kabupaten/kota", "Districts") + "</span>" : "");
  const geoKey = (i) => (i.district_only ? "kab" : i.n_prov > 0 ? "prov" : "nat");
  const yearsLabel = (i) => (i.first == null ? L("belum ada nilai", "no values yet") : i.first === i.last ? String(i.first) : i.first + " " + L("sampai", "to") + " " + i.last);

  function bindHeaderSearch() { /* delegated in global listeners */ }
  // suggestions while typing (PI 26 Oct: "ketika mengetik harusnya sudah ada suggestion"): the header box and the Home
  // search bar, ranked as the Browse page ranks
  const suggestIn = (inpSel, boxSel) => debounce(() => {
    const inp = $(inpSel), box = $(boxSel);
    if (!inp || !box || !state.catalog) return;
    const q = inp.value.trim();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
    const res = runSearch(q, 7);
    if (!res.length) { box.innerHTML = '<p class="sg-none">' + L("Tidak ada indikator yang cocok.", "No matching indicator.") + "</p>"; box.hidden = false; return; }
    box.innerHTML = res.map((i) => '<a role="option" href="' + indHref(i.id) + '"><b>' + esc(indName(i)) + '</b><span><span class="sq sm" style="background:' + (TOPIC_COLOR[i.topic] || "#687487") + '"></span>' + esc(topicLabel(i._topic)) + " · " + esc(yearsLabel(i)) + "</span></a>").join("") +
      '<a class="sg-all" href="' + hashFor("/telusuri", { q }) + '">' + L("Lihat semua hasil untuk", "See all results for") + " &ldquo;" + esc(q) + "&rdquo;</a>";
    box.hidden = false;
  }, 120);
  const showSuggestions = suggestIn("#hq", "#sugg"), showHeroSuggestions = suggestIn("#hero-q", "#hsugg");
  // arrow keys move from the box into the list and along it; Escape closes it
  function suggKeys(e, box) {
    if (!box || box.hidden) return false;
    const items = Array.from(box.querySelectorAll("a")), at = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); (items[at + 1] || items[0]).focus(); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); if (at > 0) items[at - 1].focus(); else { const inp = box.parentElement.querySelector("input"); if (inp) inp.focus(); } return true; }
    if (e.key === "Escape") { box.hidden = true; const inp = box.parentElement.querySelector("input"); if (inp) inp.focus(); return true; }
    return false;
  }

  /* ------------------------------------------------------------------ HOME */
  function legendRamp(zero) {
    const lab = [L("1 sampai 9", "1 to 9"), L("10 sampai 49", "10 to 49"), L("50 sampai 149", "50 to 149"), L("150 sampai 399", "150 to 399"), L("400 atau lebih", "400 or more")];
    return '<div class="hleg">' + RAMP.map((r, i) => '<span><span class="sq lg" style="background:' + r[0] + ';box-shadow:inset 0 0 0 1px #c5ccd4"></span>' + lab[i] + "</span>").join("") + (zero ? "<span>&middot; " + L("tidak ada nilai", "no value") + "</span>" : "") + "</div>";
  }
  function heatCell(n, href, label) {
    if (!n) return '<td class="e">&middot;</td>';
    const r = rampOf(n);
    return '<td style="background:' + r[0] + ";color:" + r[1] + '"><a href="' + href + '" aria-label="' + esc(label + ": " + fint(n)) + '">' + fint(n) + "</a></td>";
  }
  function homeStats() {
    const A = state.avail, I = state.catalog.indicators.filter((i) => !isRkd(i) && !i.district_only), topics = state.catalog.topics, cnt = state.manifest.counts;  // the maps describe the Profil books
    const order = topics.map((t, ti) => ({ t, ti })).sort((a, b) => cnt.by_topic[b.t.id] - cnt.by_topic[a.t.id]);
    const withVals = I.filter((i) => i.n > 0);
    const per = {};
    topics.forEach((t) => { per[t.id] = { all: 0, nb5: 0, nb24: 0, nb1: 0, prov: 0, nat: 0, tp: 0, none: 0 }; });
    const tot = { all: 0, nb5: 0, nb24: 0, nb1: 0, prov: 0, nat: 0, tp: 0, none: 0 };
    I.forEach((i) => {
      const bucket = [per[i.topic], tot];
      bucket.forEach((b) => {
        b.all++;
        if (!i.n) { b.none++; return; }
        if (i._nb >= 5) b.nb5++; else if (i._nb >= 2) b.nb24++; else b.nb1++;
        if (i.n_prov > 0) b.prov++; else b.nat++;
        if (i._nb >= 5 && i.n_prov > 0) b.tp++;
      });
    });
    return { A, order, per, tot, withVals, topics, cnt };
  }
  function slideHarm(S) {
    const { order, per, tot } = S;
    const hv = tot.all - tot.none;
    const pct = (x) => fpct(x / hv, 1) + "%";
    const col = (key, label, param) => ({ key, label, param });
    const cols = [col("nb5", L("5 buku atau lebih", "5 or more books"), { nb: "5+" }), col("nb24", L("2 sampai 4 buku", "2 to 4 books"), { nb: "2-4" }), col("nb1", L("1 buku", "1 book"), { nb: "1" }),
      col("prov", L("Ada nilai provinsi", "Province values"), { geo: "prov" }), col("nat", L("Hanya nasional", "National only"), { geo: "nat" })];
    const rowFor = (label, o, topic, dot) => '<tr' + (topic ? "" : ' class="sum"') + '><td class="l">' + (dot ? '<span class="sq" style="background:' + dot + '"></span> ' : "") + (topic ? esc(label) : "<b>" + esc(label) + "</b>") + "</td>" +
      cols.map((c) => heatCell(o[c.key], hashFor("/telusuri", Object.assign({}, topic ? { topic } : {}, c.param)), label + ", " + c.label)).join("") +
      heatCell(o.tp, hashFor("/telusuri", Object.assign({}, topic ? { topic } : {}, { tp: 1 })), label + ", " + L("tren per provinsi", "province trend")) +
      '<td class="tot">' + fint(o.all) + "</td></tr>";
    const body = order.map(({ t }) => rowFor(t.short_id, per[t.id], t.id, TOPIC_COLOR[t.id])).join("") + rowFor(L("Semua topik", "All topics"), tot, "", "");
    return '<div class="slide" id="hm-1"><p class="kicker">' + L("Harmonisasi", "Harmonisation") + "</p><h2>" + L("Data setelah diharmonisasi: tren dan disagregasi", "Harmonised data: trend and disaggregation") + "</h2>" +
      '<p class="lead strong">' + L("Dari " + fint(hv) + " indikator yang memiliki nilai angka, " + fint(tot.nb1) + " (" + pct(tot.nb1) + ") hanya muncul di satu buku. " + fint(tot.nb5) + " muncul di lima buku atau lebih, dan " + fint(tot.tp) + " di antaranya juga punya nilai provinsi: inilah data yang bisa dibaca sebagai tren per provinsi.",
        "Of " + fint(hv) + " indicators with numeric values, " + fint(tot.nb1) + " (" + pct(tot.nb1) + ") appear in one book only. " + fint(tot.nb5) + " appear in five books or more, and " + fint(tot.tp) + " of those also have province values: these are the data that can be read as a province trend.") + "</p>" +
      legendRamp(false) + '<div class="tw hmw" data-hint="' + swipeHint() + '"><table class="av hm2"><thead><tr><th class="l" rowspan="2">' + L("Topik", "Topic") + '</th><th colspan="3" class="grp">' + L("Keseragaman antarbuku", "Consistency across books") + '</th><th colspan="2" class="grp">' + L("Disagregasi", "Disaggregation") + '</th><th rowspan="2" class="both">' + L("Tren per provinsi", "Province trend") + "<span>" + L("5 buku atau lebih dan nilai provinsi", "5+ books and province values") + '</span></th><th class="tot" rowspan="2">Total</th></tr><tr>' + cols.map((c) => "<th>" + c.label + "</th>").join("") + "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      '<p class="src">' + L("Sumber: katalog atlas dan tabel nilai per topik, dibangun " + state.manifest.version + ". Satu buku dihitung bila memuat nilai angka untuk indikator itu; nilai provinsi berarti ada baris menurut provinsi. Kolom keseragaman dan disagregasi masing-masing menjumlah ke indikator yang memiliki nilai angka; Total juga memuat " + fint(tot.none) + " indikator tanpa nilai angka. Pilih sel untuk membuka pencarian.",
        "Source: the atlas catalogue and the per-topic value tables, built " + state.manifest.version + ". A book counts when it prints a numeric value for the indicator; province values means there are province rows. The consistency and disaggregation columns each add up to the indicators with numeric values; Total also includes " + fint(tot.none) + " indicators without numeric values. Select a cell to open the search.") + '</p><p class="dfoot">2 ' + L("dari", "of") + " 3 · " + L("gulir untuk peta berikutnya", "scroll for the next map") + "</p></div>";
  }
  function slideMap(S) {
    const { order, topics } = S, A = state.avail;
    const keys = ["input", "process", "output", "outcome", "context"];
    const rows = order.map(({ t }) => {
      const o = A.ipoo_by_topic[t.id] || {};
      return '<tr><td class="l"><span class="sq" style="background:' + (TOPIC_COLOR[t.id] || "#687487") + '"></span> ' + esc(t.short_id) + "</td>" +
        keys.map((k) => heatCell(o[k] || 0, hashFor("/telusuri", { topic: t.id, ipoo: k }), t.short_id + ", " + IPOO[k][state.lang === "en" ? 1 : 0])).join("") + "</tr>";
    }).join("");
    const tot = keys.map((k) => state.manifest.counts.by_ipoo[k] || 0);
    const sum = '<tr class="sum"><td class="l"><b>' + L("Semua topik", "All topics") + "</b></td>" + keys.map((k, i) => heatCell(tot[i], hashFor("/telusuri", { ipoo: k }), L("Semua topik, ", "All topics, ") + IPOO[k][state.lang === "en" ? 1 : 0])).join("") + "</tr>";
    return '<div class="slide" id="hm-2"><p class="kicker">' + L("Pemetaan", "Mapping") + "</p><h2>" + L("Input, proses, output, outcome", "Input, process, output, outcome") + "</h2>" +
      '<p class="lead">' + L("Setiap indikator dipetakan ke kerangka hasil: input (tenaga, fasilitas, dana, obat), proses (layanan dan program), output (cakupan dan layanan yang dihasilkan), outcome (status kesehatan penduduk), dan konteks (latar penduduk dan lingkungan). Angka di sel adalah jumlah indikator.",
        "Every indicator is mapped to a results framework: input (staff, facilities, funds, medicines), process (services and programmes), output (coverage and services delivered), outcome (population health status), and context (the population and environment). The number in a cell is the count of indicators.") + "</p>" +
      legendRamp(true) + '<div class="tw hmw" data-hint="' + swipeHint() + '"><table class="av mp"><thead><tr><th class="l">' + L("Topik", "Topic") + "</th>" + keys.map((k) => "<th>" + IPOO[k][state.lang === "en" ? 1 : 0] + "</th>").join("") + "</tr></thead><tbody>" + rows + sum + "</tbody></table></div>" +
      '<p class="src">' + L("Pemetaan dibuat per indikator dan dapat dipakai sebagai saringan di halaman Telusuri.", "The mapping is made per indicator and can be used as a filter on the Browse page.") + '</p><p class="dfoot">3 ' + L("dari", "of") + " 3 · " + L("gulir lagi untuk melanjutkan halaman", "scroll again to continue the page") + "</p></div>";
  }
  function pageHome() {
    setTitle("");
    const m = state.manifest, c = m.coverage, cnt = m.counts, S = homeStats();
    const th = Math.floor(cnt.indicators / 1000), rest = cnt.indicators % 1000;
    const qa = m.qa;
    $("#main").innerHTML =
      '<div class="herobg"><div class="wrap"><section class="hero"><div>' +
      '<p class="kicker">' + L("Profil Kesehatan Indonesia · " + c.profile_first + " sampai " + c.profile_last, "Indonesia Health Profile · " + c.profile_first + " to " + c.profile_last) + "</p>" +
      "<h1>" + L("Digitalisasi Data Buku Profil Kesehatan Indonesia", "Digitised Data from the Indonesia Health Profile Books") + "</h1>" +
      '<div class="hacts hsrch"><form class="sbox2 herosf" id="heroform" role="search"><label class="vh" for="hero-q">' + L("Cari indikator", "Search indicators") + '</label>' +
        '<input id="hero-q" type="search" autocomplete="off" placeholder="' + L("Cari indikator", "Search indicators") + '" aria-controls="hsugg"><button type="submit" class="btn">' + ICON.search + L("Cari", "Search") + "</button>" +
        '<div class="sugg" id="hsugg" role="listbox" hidden></div></form>' +
        '<a class="btn ol" href="#/metode">' + L("Data dan metode", "Data and method") + "</a></div></div>" +
      '<div class="side"><div class="prev stats" role="group" aria-label="' + L("Cakupan data: " + fint(cnt.indicators) + " indikator, buku Profil " + c.profile_first + " sampai " + c.profile_last, "Coverage: " + fint(cnt.indicators) + " indicators, Profile books " + c.profile_first + " to " + c.profile_last) + '">' +
      '<div class="st"><p class="kk">' + L("Indikator", "Indicators") + '</p><p class="big num">' + fint(cnt.indicators) + "</p><p class=\"sub\">" + L("indikator yang dapat dicari", "searchable indicators") + "</p></div>" +
      '<div class="st"><p class="kk">' + L("Buku Profil", "Profile books") + '</p><p class="big num">' + c.profile_first + ' <span class="dash">' + L("sampai", "to") + "</span> " + c.profile_last + '</p><p class="sub">' + L(c.profile_books + " buku Profil Kesehatan, ditambah " + c.related_documents + " lampiran dan dokumen terkait sejak " + c.related_first, c.profile_books + " Health Profile books, plus " + c.related_documents + " appendices and related documents since " + c.related_first) + "</p></div>" +
      "</div></div></section></div>" +
      '<p class="pcredit">' + L("Foto: sawah terasering, Jawa Barat. ", "Photo: rice terraces, West Java. ") + '<a href="https://www.pexels.com/photo/aerial-photo-of-rice-terraces-3148866/" target="_blank" rel="noopener">Tom Fisk, Pexels</a></p></div>' +
      articlesStrip() +
      distillSection() +
      pickerSection() +
      featuredSection() +
      exploreSection() +
      '<section class="sec" id="status"><div class="wrap g2" style="gap:44px;align-items:start"><div><p class="kicker">' + L("Status data", "Data status") + "</p><h2>" + L("Status data dan pembaruan", "Data status and updates") + "</h2>" +
      '<table class="lgt"><thead><tr><th>' + L("Tanggal", "Date") + "</th><th>" + L("Peristiwa", "Event") + "</th><th>" + L("Rincian", "Detail") + "</th></tr></thead><tbody>" +
      '<tr><td class="num nw">' + m.version + "</td><td>" + L("Katalog dibangun", "Catalogue built") + "</td><td>" + L(fint(cnt.indicators) + " indikator; " + fint(cnt.reference_values) + " nilai acuan dari " + fint(cnt.all_printings) + " angka tercetak; " + fint(cnt.verified_values) + " nilai terverifikasi dan " + fint(cnt.provisional_values) + " belum terverifikasi",
        fint(cnt.indicators) + " indicators; " + fint(cnt.reference_values) + " reference values from " + fint(cnt.all_printings) + " printed figures; " + fint(cnt.verified_values) + " verified and " + fint(cnt.provisional_values) + " not yet verified") + "</td></tr>" +
      '<tr><td class="num nw">' + m.version + "</td><td>" + L("Uji akurasi", "Accuracy check") + "</td><td>" + acceptanceText() + "</td></tr>" +
      '<tr><td class="num nw">' + m.version + "</td><td>" + L("Edisi belum ditemukan", "Editions not found") + "</td><td>" + esc(c.editions_not_found.join("; ")) + "</td></tr></tbody></table>" +
      '<p class="src">' + L("Cakupan: " + c.profile_books + " buku Profil (" + c.profile_first + " sampai " + c.profile_last + ") dan " + c.related_documents + " lampiran serta dokumen terkait (sejak " + c.related_first + "), " + fint(m.steps.tables_kept) + " tabel sumber.", "Coverage: " + c.profile_books + " Profile books (" + c.profile_first + " to " + c.profile_last + ") and " + c.related_documents + " appendices and related documents (since " + c.related_first + "), " + fint(m.steps.tables_kept) + " source tables.") + '</p><p style="margin-top:12px"><a class="tl ar" href="#/metode">' + L("Metode dan status data", "Method and data status") + "</a></p></div>" +
      feedbackForm() + "</div></section>" +
      // the other ARC tools are one button beside the attribution, not a list (PI comment, 21 Oct)
      '<section class="sec tight"><div class="wrap attr"><div><p class="kicker">' + L("Pernyataan atribusi data", "Data attribution") + '</p><p class="lead" style="margin-top:10px;font-size:15px;max-width:96ch">' +
      L("Dataset ini adalah digitalisasi data publik Profil Kesehatan Indonesia yang diterbitkan Kementerian Kesehatan RI. Hak atas publikasi sumber tetap pada Kementerian Kesehatan RI; ARC Institute Indonesia membantu harmonisasi data antar tahun.",
        "This dataset is a digitisation of public data from the Indonesia Health Profile published by the Ministry of Health of the Republic of Indonesia. Rights to the source publications remain with their holders; ARC Institute Indonesia helped harmonise the data across years.") + "</p></div>" +
      '<a class="btn ol xbtn" href="/tools/">' + L("Jelajahi tools ARC lainnya", "Explore other ARC tools") + " \u2192</a></div></section>";
    setupDeck();
    hxIntro();
    // on a phone the availability map opens at its latest book years; the topic column stays in view (styles.css)
    if (window.innerWidth <= 900) { const t = $(".hmw table.av:not(.hm2):not(.mp):not(.hx)"); if (t) t.parentElement.scrollLeft = t.parentElement.scrollWidth; }
  }
  // Riskesdas on Home: the four national reports, opening Telusuri on that source and year
  function rkdRow() {
    const R = state.manifest.riskesdas;
    if (!R || !R.indicators) return "";
    return '<p class="older rkd"><b>' + L(SURVF() + ", laporan nasional, " + R.reports.length + ":", SURVF() + " national reports, " + R.reports.length + ":") + "</b> " +
      R.reports.map((y) => '<a href="' + hashFor("/telusuri", { src: "rkd", from: y, to: y }) + '">' + y + "</a>").join("") +
      ' <span class="rkn">' + L(fint(R.indicators) + " indikator survei, ditampilkan terpisah dari deret Profil dan ditautkan ke indikator Profil yang sepadan.",
        fint(R.indicators) + " survey indicators, shown apart from the Profil series and linked to the matching Profil indicators.") + "</span></p>";
  }
  function acceptanceText() {
    const q = state.manifest.qa || [];
    const a = q.find((x) => x.sample === "qa200"), b = q.find((x) => x.sample === "qa200-v3") || q.find((x) => x.sample === "qa200-v2");  // latest verified-tier sample
    const pa = a ? fpct(a.correct_share_of_usable, 1) : "87,3", pb = b ? fpct(b.correct_share_of_usable, 1) : "97,0";
    return L("Dari 200 nilai terverifikasi yang diperiksa, " + pb + "% sesuai dengan halaman cetak. Dalam pemeriksaan awal terhadap 200 nilai yang diambil dari seluruh data, " + pa + "% sesuai dengan halaman cetak (hasil untuk buku pindaian adalah 77%).",
      "Among the 200 verified values in the sample, " + pb + "% matched the printed page. In the first sample, which drew 200 values from the full set, " + pa + "% matched (the figure for scanned books was 77%).");
  }
  /* ---- "Dari buku ke data": book shelf, archive chips, flow diagram with matrix canvases ---- */
  function flowSteps() {
    const m = state.manifest, c = m.coverage, s = m.steps;
    return [
      [L(c.profile_books + " buku Profil, " + c.related_documents + " dokumen terkait" + (c.provincial_books ? ", " + fint(c.provincial_books) + " buku Profil Provinsi" : ""),
         c.profile_books + " Profile books, " + c.related_documents + " related documents" + (c.provincial_books ? ", " + fint(c.provincial_books) + " provincial Profile books" : "")), L(c.profile_first + " sampai " + c.profile_last, c.profile_first + " to " + c.profile_last)],
      [L(fint(s.tables_kept) + " tabel", fint(s.tables_kept) + " tables"), L("dari " + fint(s.tables_read) + " tabel yang dibaca dari halaman PDF", "of " + fint(s.tables_read) + " tables read from the PDF pages")],
      [L(fint(s.columns_read) + " kolom", fint(s.columns_read) + " columns"), L("sebagai calon indikator", "as candidate indicators")],
      [L(fint(s.printed_values) + " nilai", fint(s.printed_values) + " values"), L("halaman, baris dan kolom", "page, row and column")],
      [L(fint(s.reference_values) + " nilai acuan", fint(s.reference_values) + " reference values"), L("per indikator, tahun, wilayah dan rincian", "per indicator, year, area and breakdown")],
      [L(fint(s.indicators) + " indikator", fint(s.indicators) + " indicators"), L("terharmonisasi lintas tahun", "harmonised across years")]
    ];
  }
  function distillSection() {
    const m = state.manifest, c = m.coverage;
    const profil = state.catalog.books.filter((b) => b.kind === "main_profile").map((b) => b.year).sort((a, b) => a - b);
    const shelfYears = profil.slice(-9).reverse();
    const older = profil.filter((y) => !shelfYears.includes(y));
    const related = state.catalog.books.filter((b) => b.kind !== "main_profile" && b.kind !== "riskesdas_report").sort((a, b) => a.year - b.year);  // Riskesdas has its own row
    const steps = flowSteps(), it = matrixItems();
    const lab = L("Alur distilasi: ", "Distillation flow: ") + steps.map((x) => x[0]).join(", ") + L(", lalu ke peta di bawah", ", then to the maps below");
    const book = (y) => '<figure class="book"><a class="bcv" href="https://kemkes.go.id/id/profil-kesehatan-indonesia-' + y + '" target="_blank" rel="noopener" aria-label="' + L("Buka halaman Profil Kesehatan Indonesia " + y + " di situs Kemenkes", "Open the Indonesia Health Profile " + y + " page on the Ministry of Health website") + '"><img src="assets/covers/pki-' + y + '.jpg" alt="' + L("Sampul Profil Kesehatan Indonesia " + y, "Cover of the Indonesia Health Profile " + y) + '" width="300" height="424" loading="lazy"></a><figcaption><b>' + y + '</b><a class="kl" href="https://kemkes.go.id/id/profil-kesehatan-indonesia-' + y + '" target="_blank" rel="noopener">' + L("Lihat di Kemenkes", "See at the Ministry") + "</a></figcaption></figure>";
    return '<section class="sec distill"><div class="wrap"><div class="dhead"><p class="kicker">' + L("Dari buku ke data", "From book to data") + "</p><h2>" + L("Buku Profil Kesehatan Indonesia", "The Indonesia Health Profile books") + "</h2></div>" +
      '<div class="shelf" role="list">' + shelfYears.map(book).join("") + "</div>" +
      '<p class="older"><b>' + L("Buku Profil lain dari arsip, " + older.length + ":", "Other Profile books from the archive, " + older.length + ":") + "</b> " + older.map((y) => '<a href="' + hashFor("/telusuri", { from: y, to: y }) + '">' + y + "</a>").join("") + "</p>" +
      rkdRow() +
      '<div class="dflow"><div class="notes left mtrx" aria-hidden="true">' + matrixRain(it.nums, 2, "l") + "</div>" +
      '<ol class="sline" aria-label="' + esc(lab) + '">' + steps.map((x, k) => {
        const t = "<b>" + esc(x[0]) + "</b><span>" + esc(x[1]) + "</span>";
        return '<li class="srow"><div class="sl l">' + (k % 2 ? t : "") + '</div><div class="sc"><span class="sdot"></span></div><div class="sl r">' + (k % 2 ? "" : t) + "</div></li>";
      }).join("") + '<li class="sflow" aria-hidden="true"><i></i><i></i><i></i></li><li class="stip" aria-hidden="true"></li></ol>' +
      '<div class="notes right mtrx" aria-hidden="true">' + matrixRain(it.labels, 2, "r") + "</div></div></div></section>";
  }
  function exploreSection() {
    const I = state.catalog.indicators, cnt = state.manifest.counts;
    const picks = ["POP-01-066", "CDS-01-088"].map((id) => state.byId.get(id)).filter(Boolean);
    const third = I.filter((i) => (i.trend === "yes" || i.trend === "within_period") && i.n && !picks.includes(i)).sort((a, b) => b._nb - a._nb)[0];
    if (third) picks.push(third);
    const ex = [["Imunisasi campak", "Measles immunisation"], ["Penduduk miskin", "Poverty"], ["Leptospirosis", "Leptospirosis"], ["Tenaga kesehatan", "Health workforce"], ["Kematian ibu", "Maternal deaths"], ["Puskesmas", "Puskesmas"]];
    return '<section class="sec paper" id="csv"><div class="wrap g2" style="gap:28px;align-items:stretch">' +
      '<div class="prev qf ex"><p class="kk">' + L("Jelajahi indikator", "Explore indicators") + "</p><h2>" + L("Cari dan buka indikator", "Find and open indicators") + "</h2>" +
      '<form class="sbox2" id="exform" role="search"><label class="vh" for="ex-q">' + L("Cari indikator", "Search indicators") + '</label><input id="ex-q" type="search" placeholder="' + L("Misalnya campak, kemiskinan, puskesmas", "For example measles, poverty, puskesmas") + '"><button type="submit" class="btn">' + L("Cari", "Search") + "</button></form>" +
      '<p class="lab2">' + L("Contoh pencarian", "Example searches") + '</p><div class="exqs">' + ex.map((x) => '<a class="exq" href="' + hashFor("/telusuri", { q: x[0] }) + '">' + L(x[0], x[1]) + "</a>").join("") + "</div>" +
      '<p class="lab2">' + L("Deret yang dapat dibaca lintas buku", "Series that can be read across books") + '</p><ul class="curl">' + picks.map((i) => '<li><a href="' + indHref(i.id) + '">' + esc(indName(i)) + "</a>, " + esc(yearsLabel(i)) + " (" + i._nb + " " + L("buku", "books") + ")</li>").join("") + "</ul>" +
      '<div class="rowbtn"><a class="btn" href="#/jelajah">' + L("Pilih indikator", "Pick an indicator") + '</a><a class="btn ol" href="#/telusuri">' + L("Buka semua indikator", "Open all indicators") + "</a></div>" +
      "</div>" +
      accessPanel() + "</div></section>";
  }
  // the harmonisation and mapping maps (PI comment 22 Oct: they belong on the method page, not on Home)
  function deckSection(S) {
    return '<section class="sec deck-sec"><div class="wrap"><div class="deckpin" id="deckpin"><div class="deckstage">' +
      '<div class="ddots" role="group" aria-label="' + L("Dua peta", "Two maps") + '">' + [L("Harmonisasi", "Harmonisation"), L("Pemetaan", "Mapping")].map((t, k) => '<button type="button" class="ddot" data-a="hm" data-t="hm-' + (k + 1) + '" aria-label="' + L("Peta ", "Map ") + (k + 1) + ": " + t + '"></button>').join("") + "</div>" +
      '<div class="deck" id="deck" aria-label="' + L("Dua peta data", "Two data maps") + '">' + slideHarm(S) + slideMap(S) + "</div></div></div></div></section>";
  }
  function setupDeck() {
    if (state._io) { state._io.disconnect(); state._io = null; }
    if (state._deckOff) { state._deckOff(); state._deckOff = null; }
    const sec = $(".deck-sec"), pin = $("#deckpin"), deck = $("#deck");
    const slides = $$('.slide[id^="hm-"]'), dots = $$(".ddot");
    if (!sec || !pin || !deck || !slides.length) return;
    let pinned = false, step = 0, cur = -1;
    const set = (k) => {
      cur = k;
      dots.forEach((d, j) => { d.classList.toggle("on", j === k); d.setAttribute("aria-pressed", j === k ? "true" : "false"); });
      slides.forEach((s, j) => s.classList.toggle("on", j === k));
    };
    const layout = () => {
      sec.classList.remove("pinned"); pin.style.height = ""; deck.style.height = "";
      slides.forEach((s) => { s.style.transform = ""; s.style.top = ""; });
      pinned = false;
      // PI 22 Oct: on the Method page the maps follow one another; no pinned scroll slideshow
    };
    const onScroll = () => {
      if (!pinned) return;
      const k = Math.max(0, Math.min(slides.length - 1, Math.round(-pin.getBoundingClientRect().top / step)));
      if (k !== cur) set(k);
    };
    state._deckGo = (k) => {
      const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (pinned) window.scrollTo({ top: window.scrollY + pin.getBoundingClientRect().top + k * step + 2, behavior: smooth });
      else slides[k].scrollIntoView({ behavior: smooth, block: "start" });
    };
    layout(); set(0); onScroll();
    let raf = 0, rt = 0;
    const sc = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onScroll(); }); };
    const rs = () => { clearTimeout(rt); rt = setTimeout(() => { layout(); onScroll(); }, 150); };
    window.addEventListener("scroll", sc, { passive: true });
    window.addEventListener("resize", rs);
    state._deckOff = () => { window.removeEventListener("scroll", sc); window.removeEventListener("resize", rs); };
  }
  function matrixItems() {
    const m = state.manifest, c = m.coverage, k = m.counts, s = m.steps, nums = [];
    const add = (v, id, en) => { if (v != null && !isNaN(v)) nums.push(fint(v) + " " + L(id, en)); };
    add(c.profile_books, "buku Profil", "Profile books"); add(c.related_documents, "dokumen terkait", "related documents");
    add(c.provincial_books, "buku Profil Provinsi", "provincial Profile books");
    add(k.indicators, "indikator", "indicators"); add(k.indicators_with_values, "indikator bernilai", "with values");
    add(k.reference_values, "nilai acuan", "reference values"); add(k.all_printings, "angka tercetak", "printed figures");
    add(k.verified_values, "terverifikasi", "verified"); add(k.provisional_values, "belum terverifikasi", "not yet verified");
    add(k.revisions_between_books, "revisi antarbuku", "revisions"); add(k.with_province, "indikator provinsi", "with provinces");
    add(s.tables_read, "tabel dibaca", "tables read"); add(s.tables_kept, "tabel dipakai", "tables used");
    add(s.columns_read, "kolom", "columns"); add(s.candidates, "calon indikator", "candidates");
    state.catalog.topics.forEach((t) => add(t.indicators, t.short_id.toLowerCase(), t.label_en.toLowerCase()));
    const IP = { input: ["input", "input"], process: ["proses", "process"], output: ["output", "output"], outcome: ["outcome", "outcome"], context: ["konteks", "context"] };
    Object.entries(k.by_ipoo || {}).forEach(([key, v]) => add(v, IP[key] ? IP[key][0] : key, IP[key] ? IP[key][1] : key));
    const TR = { yes: ["deret sebanding", "comparable series"], within_period: ["sebanding per periode", "comparable within period"], no: ["satu buku", "single book"], unknown: ["belum dinilai", "not assessed"] };
    Object.entries(k.by_trend || {}).forEach(([key, v]) => add(v, TR[key] ? TR[key][0] : key, TR[key] ? TR[key][1] : key));
    (m.qa || []).forEach((q, n) => { if (q.correct_share_of_usable != null) nums.push(fpct(q.correct_share_of_usable, 1) + "% " + L("cocok, uji " + (n + 1), "match, check " + (n + 1))); });
    const names = [];
    const seen = new Set();
    state.catalog.indicators.forEach((i) => {
      const nm = indName(i).replace(/\s*\(.*\)\s*$/, "").trim();
      if (i.n && nm.length >= 6 && nm.length <= 22 && !seen.has(nm.toLowerCase())) { seen.add(nm.toLowerCase()); names.push(nm); }
    });
    const stride = Math.max(1, Math.floor(names.length / 40)), labels = [];
    for (let x = 0; x < names.length && labels.length < 40; x += stride) labels.push(names[x]);
    return { nums, labels };
  }
  function matrixRain(items, cols, side) {
    if (!items.length) return "";
    let out = '<div class="mrain ' + side + '">';
    for (let c = 0; c < cols; c++) {
      const list = items.map((x, r) => items[(r * (c + 2) + c * 5) % items.length]);
      const spans = list.map((x) => "<span>" + esc(x) + "</span>").join("");
      out += '<div class="mcol"><div class="mtrack" style="animation-duration:' + (26 + c * 9) + "s;animation-delay:-" + (c * 7) + 's">' + spans + spans + "</div></div>";
    }
    return out + "</div>";
  }
  function feedbackForm() {
    return '<form class="prev fb" id="fbform" aria-labelledby="fb-h"><p class="kk">' + L("Masukan", "Feedback") + '</p><h2 id="fb-h">' + L("Beri rekomendasi atau laporkan kesalahan", "Send a recommendation or report an error") + "</h2>" +
      '<div class="qrow"><label for="fb-j">' + L("Jenis masukan", "Type of feedback") + '</label><select id="fb-j"><option value="Laporkan kesalahan data">' + L("Laporkan kesalahan data", "Report a data error") + '</option><option value="Label atau judul rusak">' + L("Label atau judul rusak", "Broken label or title") + '</option><option value="Usulan indikator atau tema">' + L("Usulan indikator atau tema", "Suggest an indicator or topic") + '</option><option value="Saran lain">' + L("Saran lain", "Other suggestion") + "</option></select></div>" +
      '<div class="qrow"><label for="fb-i">' + L("Indikator atau halaman (jika ada)", "Indicator or page (if any)") + '</label><input id="fb-i" type="text" placeholder="' + L("Misalnya: imunisasi campak, buku 2022", "For example: measles immunisation, 2022 book") + '"></div>' +
      '<div class="qrow"><label for="fb-p">' + L("Pesan", "Message") + '</label><textarea id="fb-p" rows="4" required placeholder="' + L("Jelaskan temuan atau usul Anda", "Describe your finding or suggestion") + '"></textarea></div>' +
      '<div class="qrow"><label for="fb-e">' + L("Email (opsional, untuk balasan)", "Email (optional, for a reply)") + '</label><input id="fb-e" type="email" placeholder="nama@instansi.go.id"></div>' +
      '<button type="submit" class="btn">' + L("Kirim masukan", "Send feedback") + '</button><p class="src" id="fbmsg" role="status"></p></form>';
  }
  async function submitFeedback(form) {
    const msg = $("#fbmsg"), btn = $("button[type=submit]", form);
    const jenis = $("#fb-j").value, about = $("#fb-i").value.trim(), text = $("#fb-p").value.trim(), email = $("#fb-e").value.trim();
    if (!text) { $("#fb-p").focus(); return; }
    const type = "Atlas Profil Kesehatan: " + jenis;
    const message = (about ? "Indikator atau halaman: " + about + "\n" : "Halaman: " + location.href + "\n") + "\n" + text;
    const payload = { name: "Pengunjung Atlas Profil Kesehatan", email, organisation: "", type, message, website: "", cf_turnstile_response: (window.arcTurnstileToken ? window.arcTurnstileToken() : "") };
    btn.disabled = true; msg.textContent = L("Mengirim...", "Sending...");
    function mailto() {
      const subject = "ARC contact: " + type;
      const body = "Name: " + payload.name + "\nEmail: " + (email || "-") + "\nType of enquiry: " + type + "\n\n" + message;
      msg.innerHTML = L("Pengiriman langsung tidak berhasil, jadi aplikasi email Anda dibuka dengan pesan yang sama. Jika tidak terjadi apa-apa, kirim ke ", "Direct sending did not work, so your email app is opening with the same message. If nothing happens, write to ") + '<a href="mailto:partnership@arcinstitute.or.id">partnership@arcinstitute.or.id</a>.';
      window.location.href = "mailto:partnership@arcinstitute.or.id?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    }
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("http " + r.status);
      const res = await r.json();
      if (!res || !res.ok) throw new Error("not ok");
      msg.textContent = L("Terima kasih. Masukan Anda sudah terkirim ke tim ARC.", "Thank you. Your feedback has been sent to the ARC team.");
      form.reset();
    } catch (e) { mailto(); }
    btn.disabled = false;
  }

  function saveBlob(text, name, type) {
    const blob = new Blob([text], { type: type || "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  /* ------------------------------------------------------------------ ACCOUNT (PI 22 Oct): a free atlas account raises the
     daily limit from 50 to 200 indicators and opens the CSV downloads; it grants nothing outside this atlas */
  function accessPanel() {
    const m = state.me, lim = limits();
    const who = m && m.tier === "user" ? L("Akses aktif untuk ", "Access active for ") + "<b>" + esc(m.email) + "</b>. " : m && m.tier === "staff" ? L("Anda masuk dengan akun ARC.", "You are signed in with an ARC account.") + " " : "";
    return '<div class="prev qf"><p class="kk">' + L("Unduh data indikator", "Download indicator data") + "</p><h2>" + L("Data per indikator, dengan buku sumber setiap nilai", "Data by indicator, with its source") + "</h2>" +
      '<ul class="ep" style="margin-top:6px"><li><b>' + L("Tanpa data diri", "Without your details") + "</b><span>" + L(fint(lim.anon) + " indikator per hari, tanpa unduhan.", fint(lim.anon) + " indicators a day, no downloads.") + "</span></li>" +
      "<li><b>" + L("Dengan nama dan email", "With name and email") + "</b><span>" + L(fint(lim.user) + " indikator per hari dan unduhan CSV.", fint(lim.user) + " indicators a day and CSV downloads.") + "</span></li></ul>" +
      '<p class="src">' + who + (m && m.limit ? L("Hari ini: " + fint(m.used) + " dari " + fint(m.limit) + " indikator.", "Today: " + fint(m.used) + " of " + fint(m.limit) + " indicators.") : "") + "</p>" +
      '<div class="rowbtn">' + (m && m.tier !== "anon" ? '<a class="btn" href="#/akun">' + L("Akses saya", "My access") + "</a>" : '<button type="button" class="btn" data-a="access">' + L("Isi nama dan email", "Enter name and email") + "</button>") + "</div></div>";
  }
  /* access to the full data (PI 22 Oct: no "registration", just name, institution and email in a simple popup; PI 28 Oct:
     "cukup isi, langsung bisa download"): the filled form turns the access on in this browser at once, no emailed link,
     and a download the reader clicked starts right after; the same three fields for a returning reader */
  function accessForm(id) {
    const f = (k, type, label, ac) => '<div class="qrow"><label for="' + id + "-" + k + '">' + label + '</label><input id="' + id + "-" + k + '" name="' + k + '" type="' + type + '" autocomplete="' + ac + '" required></div>';
    return '<form class="qf acf" id="' + id + '" data-acf="1"><h2>' + L("Akses data lengkap", "Full data access") + "</h2>" +
      '<p class="sub">' + L("Gratis, tanpa pendaftaran: isi nama, institusi dan email, lalu unduhan CSV langsung tersedia, dengan " + fint(limits().user) + " indikator per hari.", "Free, without registering: fill in your name, institution and email and CSV downloads are available at once, with " + fint(limits().user) + " indicators a day.") + "</p>" +
      f("name", "text", L("Nama", "Name"), "name") + f("institution", "text", L("Institusi", "Institution"), "organization") + f("email", "email", "Email", "email") +
      '<button type="submit" class="btn">' + (state.pendingDl ? L("Unduh CSV", "Download CSV") : L("Buka akses data", "Open data access")) + '</button><p class="src" role="status"></p></form>';
  }
  function openAccess() {
    if (state.me && state.me.allowed === false && state.me.tier !== "staff") { const v = $("#viz"); if (v) v.innerHTML = countryHtml(); return; }
    let d = $("#accdlg");
    if (!d) { d = document.createElement("dialog"); d.id = "accdlg"; d.className = "accdlg"; document.body.appendChild(d); }
    d.innerHTML = '<button type="button" class="dlgx" data-a="accclose" aria-label="' + L("Tutup", "Close") + '">&times;</button>' + accessForm("dlgf");
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
    const n = $("#dlgf-name"); if (n) n.focus();
  }
  // the usage monitor (PI 25 Oct: "kasih pemantau"), ARC staff only: the data server's daily totals of indicators opened
  // and CSV downloads, per indicator and per account. No network address and no email address reach this page.
  async function pageUsage() {
    setTitle(L("Pemantau pemakaian", "Usage monitor"));
    const main = $("#main");
    main.innerHTML = '<div class="wrap"><p class="loading">' + L("Memuat angka pemakaian...", "Loading the usage figures...") + "</p></div>";
    let U;
    try {
      const r = await fetch(API + "usage", { credentials: "same-origin", cache: "no-store" });
      if (r.status === 403) { main.innerHTML = '<div class="wrap"><div class="warn" style="margin:40px 0">' + L("Halaman ini hanya untuk staf ARC yang masuk dengan akun ARC.", "This page is for ARC staff signed in with their ARC account.") + "</div></div>"; return; }
      if (!r.ok) throw new Error(r.status);
      U = await r.json();
    } catch (e) { main.innerHTML = '<div class="wrap"><div class="warn" style="margin:40px 0">' + L("Angka pemakaian tidak dapat dimuat.", "The usage figures could not be loaded.") + "</div></div>"; return; }
    const D = U.days, pair = (d, k) => d[k] || [0, 0], sum = (k, j) => D.reduce((a, d) => a + pair(d, k)[j], 0);
    const P = U.people, dlPeople = P.filter((p) => p.downloads && !p.staff).length;
    const dname = (d) => new Date(d + "T00:00:00").toLocaleDateString(state.lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric" });
    const ilink = (id) => { const j = state.byId.get(id); return '<a href="' + indHref(id) + '">' + esc(j ? trunc(indName(j), 80) : id) + "</a>"; };
    const tiles = [[fint(U.accounts.total), L("akun terdaftar, " + fint(U.accounts.confirmed) + " aktif", "registered accounts, " + fint(U.accounts.confirmed) + " active")],
      [fint(sum("anon", 1) + sum("user", 1) + sum("staff", 1)), L("indikator dibuka", "indicators opened")],
      [fint(sum("dl", 0)), L("unduhan CSV", "CSV downloads")],
      [fint(dlPeople), L("akun yang mengunduh", "accounts that downloaded")],
      [fint(D.length), L("hari tercatat sejak ", "days recorded since ") + (U.since ? dname(U.since) : "-")]];
    const rows = D.slice().reverse().map((d) => ({ label: dname(d.day), value: pair(d, "anon")[0] + pair(d, "user")[0] + pair(d, "staff")[0],
      text: fint(pair(d, "anon")[0] + pair(d, "user")[0] + pair(d, "staff")[0]) + L(" (" + fint(pair(d, "user")[0]) + " akun)", " (" + fint(pair(d, "user")[0]) + " accounts)"), color: "#002147" }));
    const cell = (x) => "<td>" + (x ? fint(x) : "") + "</td>";
    const dayTable = '<div class="tw"><table class="snp"><thead><tr><th class="l">' + L("Tanggal", "Date") + "</th><th>" + L("Pembaca tanpa akun", "Readers without an account") + "</th><th>" + L("Indikator dibuka", "Indicators opened") +
      "</th><th>" + L("Pembaca dengan akun", "Readers with an account") + "</th><th>" + L("Indikator dibuka", "Indicators opened") + "</th><th>" + L("Staf ARC", "ARC staff") + "</th><th>" + L("Unduhan CSV", "CSV downloads") + "</th><th>" + L("Pengunduh", "Downloaders") + "</th></tr></thead><tbody>" +
      D.slice().reverse().map((d) => '<tr><th class="l">' + dname(d.day) + "</th>" + cell(pair(d, "anon")[0]) + cell(pair(d, "anon")[1]) + cell(pair(d, "user")[0]) + cell(pair(d, "user")[1]) + cell(pair(d, "staff")[0]) + cell(pair(d, "dl")[0]) + cell(pair(d, "dl")[1]) + "</tr>").join("") + "</tbody></table></div>";
    const peopleTable = '<div class="tw"><table class="snp"><thead><tr><th class="l">' + L("Akun", "Account") + '</th><th class="l">' + L("Nama", "Name") + '</th><th class="l">' + L("Institusi", "Institution") + "</th><th>" + L("Terdaftar", "Registered") +
      "</th><th>" + L("Hari aktif", "Days active") + "</th><th>" + L("Indikator dibuka", "Indicators opened") + "</th><th>" + L("Unduhan CSV", "CSV downloads") + "</th><th>" + L("Terakhir aktif", "Last active") + "</th></tr></thead><tbody>" +
      P.map((p) => '<tr><th class="l">' + (p.staff ? L("Staf ARC", "ARC staff") : "#" + esc(p.id)) + (p.confirmed ? "" : " " + L("(belum aktif)", "(not active)")) + '</th><td class="l">' + esc(p.name) + '</td><td class="l">' + esc(p.institution) + "</td><td>" + (p.registered ? dname(p.registered) : "") +
        "</td>" + cell(p.days) + cell(p.opens) + cell(p.downloads) + "<td>" + (p.last ? dname(p.last) : "") + "</td></tr>").join("") + "</tbody></table></div>";
    const topTable = (lst, dl) => lst.length ? '<div class="tw"><table class="snp"><thead><tr><th class="l">' + L("Indikator", "Indicator") + "</th><th>" + (dl ? L("Unduhan", "Downloads") + "</th><th>" + L("Pengunduh", "Downloaders") : L("Pembaca", "Readers")) + "</th></tr></thead><tbody>" +
      lst.map((x) => '<tr><td class="l">' + ilink(x[0]) + "</td>" + cell(x[1]) + (dl ? cell(x[2]) : "") + "</tr>").join("") + "</tbody></table></div>" : '<p class="src">' + L("Belum ada unduhan tercatat.", "No downloads recorded yet.") + "</p>";
    main.innerHTML = '<div class="wrap"><div class="th"><p class="kicker"><a href="#/akun">' + L("Akses data", "Data access") + "</a> · " + L("Pemantau", "Monitor") + "</p><h1>" + L("Pemakaian atlas", "Use of the atlas") + "</h1>" +
      '<p class="lead2">' + L("Angka dari server data: indikator yang dibuka (satu pembaca yang membuka indikator yang sama pada hari yang sama dihitung sekali) dan unduhan CSV, yang hanya tersedia bagi akun dan staf ARC. Pembaca tanpa akun dihitung menurut alamat jaringan; alamat itu dihapus setelah tiga hari dan tidak tampil di sini. Unduhan tercatat sejak 25 Oktober 2026.",
        "Figures from the data server: indicators opened (a reader opening the same indicator on the same day counts once) and CSV downloads, which only accounts and ARC staff can make. Readers without an account are counted by network address; the address is deleted after three days and is not shown here. Downloads are recorded from 25 October 2026.") + "</p></div>" +
      '<div class="snk">' + tiles.map((t) => "<div><b>" + t[0] + "</b><span>" + t[1] + "</span></div>").join("") + "</div>" +
      '<section class="secx" style="border-top:0"><p class="kicker">' + L("Per hari", "By day") + "</p><h2>" + L("Pembaca dan unduhan per hari", "Readers and downloads by day") + "</h2>" +
      '<figure class="fig" style="margin:14px 0 16px"><p class="ft2">' + L("Pembaca per hari", "Readers by day") + '</p><p class="fs">' + L("Pembaca berbeda yang membuka sedikitnya satu indikator; dalam kurung, yang masuk dengan akun.", "Distinct readers who opened at least one indicator; in brackets, those signed in with an account.") + '</p><div style="margin-top:10px">' +
      barChart({ w: cw(760), rows: rows, xTitle: L("Pembaca", "Readers"), labelW: 130, rowH: 30, mr: 110 }) + "</div></figure>" + dayTable + "</section>" +
      '<section class="secx"><p class="kicker">' + L("Akun", "Accounts") + "</p><h2>" + L("Siapa yang membuka dan mengunduh", "Who opened and downloaded") + "</h2>" + peopleTable + "</section>" +
      '<section class="secx"><div class="g2"><div><p class="kicker">' + L("Paling sering dibuka", "Most opened") + "</p><h2>" + L("Indikator dengan pembaca terbanyak", "Indicators with the most readers") + "</h2>" + topTable(U.top_opened, false) + "</div>" +
      '<div><p class="kicker">' + L("Paling sering diunduh", "Most downloaded") + "</p><h2>" + L("Indikator yang diunduh", "Indicators downloaded") + "</h2>" + topTable(U.top_downloaded, true) + "</div></div></section>" +
      '<p class="src">' + L("Halaman yang disajikan dari cache Cloudflare tidak sampai ke server dan tidak terhitung di sini. Diperbarui ", "Pages served from the Cloudflare cache never reach the server and are not counted here. Updated ") + esc(U.built.slice(0, 16).replace("T", " ")) + ".</p></div>";
  }
  async function pageAccount(r) {
    setTitle(L("Akses data", "Data access"));
    if (!state.me || r.q.get("confirm")) await loadMe();
    const m = state.me || { tier: "anon" }, conf = r.q.get("confirm");
    let next = null; try { next = localStorage.getItem("pk_next"); localStorage.removeItem("pk_next"); } catch (e) { /* private window */ }
    if (conf === "ok" && next && next !== "#/akun") { location.replace(next); toast(L("Akses data lengkap aktif.", "Full data access is on.")); return; }
    const banner = conf === "ok" ? '<div class="note ok">' + L("Akses data lengkap aktif.", "Full data access is on.") + "</div>" :
      conf === "expired" ? '<div class="warn">' + L("Tautan tidak berlaku lagi. Kirim tautan baru.", "The link is no longer valid. Send a new one.") + "</div>" : "";
    let body;
    if (m.allowed === false && m.tier !== "staff") body = countryHtml();
    else if (m.tier === "user" || m.tier === "staff") {
      body = '<div class="prev qf"><h2>' + esc(m.name || m.email || "") + "</h2>" + (m.name && m.email ? '<p class="sub">' + esc(m.email) + "</p>" : "") +
        '<p class="sub">' + (m.tier === "staff" ? L("Akun ARC, tanpa batas harian.", "ARC account, no daily limit.") : L("Hari ini: " + fint(m.used) + " dari " + fint(m.limit) + " indikator.", "Today: " + fint(m.used) + " of " + fint(m.limit) + " indicators.")) + "</p>" +
        (m.tier === "user" ? '<div class="rowbtn"><button type="button" class="btn ol" data-a="logout">' + L("Keluar", "Sign out") + "</button></div>" : "") +
        (m.tier === "staff" ? '<div class="rowbtn"><a class="btn sm ol" href="#/pemantau">' + L("Pemantau pemakaian", "Usage monitor") + "</a></div>" : "") + "</div>";
    } else body = '<div class="prev acwrap">' + accessForm("pgf") + "</div>";
    $("#main").innerHTML = '<div class="wrap"><div class="th"><p class="kicker">' + L("Akses data", "Data access") + "</p></div>" + banner + body + "</div>";
  }
  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 4000);
  }
  async function submitAccount(f) {
    const msgEl = $(".src[role=status]", f), btn = $("button[type=submit]", f), val = (k) => (f.elements[k] ? f.elements[k].value.trim() : "");
    const ERR = { email: L("Alamat email tidak valid.", "The email address is not valid."), name: L("Isi nama.", "Fill in the name."),
      institution: L("Isi institusi.", "Fill in the institution."), slow_down: L("Terlalu banyak percobaan. Coba lagi nanti.", "Too many attempts. Try again later."),
      country: L("Hanya dari jaringan di Indonesia.", "Only from a network in Indonesia.") };
    const body = { name: val("name"), institution: val("institution"), email: val("email"), lang: state.lang };
    btn.disabled = true; msgEl.textContent = L("Membuka akses...", "Opening access...");
    try {
      const res = await fetch(API + "signup", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { msgEl.textContent = ERR[j.error] || L("Tidak berhasil (", "Did not work (") + res.status + ")."; btn.disabled = false; return; }
      // a data server from before 28 Oct still emails a link: say so, as it did
      if (!j.signed_in) {
        try { if (!location.hash.startsWith("#/akun")) localStorage.setItem("pk_next", PATH_ID ? location.pathname + location.hash : location.hash || "#/"); } catch (e) { /* the link still works */ }
        f.outerHTML = '<div class="acsent"><h2>' + L("Periksa email Anda", "Check your email") + "</h2><p>" + L("Tautan akses sudah dikirim ke <b>" + esc(body.email) + "</b>. Buka tautan itu di peramban ini.", "The access link was sent to <b>" + esc(body.email) + "</b>. Open it in this browser.") + "</p></div>";
        return;
      }
      // the access is on at once (PI 28 Oct): close the form, redraw the page with the real download buttons, and start
      // the download the reader clicked
      const d = $("#accdlg"); if (d) { if (d.close) d.close(); else d.removeAttribute("open"); }
      const pend = state.pendingDl; state.pendingDl = null;
      state.groups.clear(); await loadMe();
      toast(L("Akses data lengkap aktif.", "Full data access is on."));
      await route();
      if (pend) csvIndicator(pend.id, pend.w);
      return;
    } catch (e) { msgEl.textContent = L("Server data tidak dapat dihubungi.", "The data server could not be reached."); }
    btn.disabled = false;
  }
  async function signOut() {
    try { await fetch(API + "logout", { method: "POST", credentials: "same-origin" }); } catch (e) { /* the cookie expires anyway */ }
    state.groups.clear(); await loadMe(); pageAccount(parseHash());
  }

  /* ------------------------------------------------------------------ SEARCH PAGE */
  const FSET = ["topic", "measure", "trend", "geo", "ipoo", "who", "nb", "src"];
  function readP(q) {
    const P = { q: q.get("q") || "", from: q.get("from") || "", to: q.get("to") || "", sort: q.get("sort") || "", tp: q.get("tp") || "" };
    FSET.forEach((k) => { P[k] = new Set((q.get(k) || "").split(",").filter(Boolean)); });
    return P;
  }
  function writeP(P) {
    const o = { q: P.q, from: P.from, to: P.to, sort: P.sort, tp: P.tp };
    FSET.forEach((k) => { o[k] = Array.from(P[k]).join(","); });
    return o;
  }
  function matches(i, P, omit) {
    const has = (k) => k !== omit && P[k].size;
    if (has("topic") && !P.topic.has(i.topic)) return false;
    if (has("src") && !P.src.has(isRkd(i) ? "rkd" : "pk")) return false;
    if (has("measure") && !P.measure.has(MEASURE_GROUP(i.measure))) return false;
    if (has("trend") && !P.trend.has(i.trend)) return false;
    if (has("ipoo") && !P.ipoo.has(i.ipoo)) return false;
    if (has("who") && !P.who.has(i.who)) return false;
    if (has("geo")) { if (!P.geo.has(geoKey(i)) || !i.n) return false; }
    if (has("nb")) { const b = i._nb >= 5 ? "5+" : i._nb >= 2 ? "2-4" : i._nb === 1 ? "1" : "0"; if (!P.nb.has(b)) return false; }
    if (P.tp && omit !== "tp" && !(i._nb >= 5 && i.n_prov > 0)) return false;
    if (omit !== "year" && (P.from || P.to)) {
      const f = P.from ? +P.from : -1e9, t = P.to ? +P.to : 1e9;
      if (!(i.books || []).some((y) => y >= f && y <= t)) return false;
    }
    return true;
  }
  const SORTS = () => [["", L("Paling relevan", "Most relevant")], ["books", L("Paling banyak buku", "Most books")], ["latest", L("Terbaru", "Latest")], ["name", L("Nama A sampai Z", "Name A to Z")]];
  function searchResults(P) {
    const base = P.q.trim() ? runSearch(P.q) : state.catalog.indicators.filter(listed);
    return base.filter((i) => matches(i, P));
  }
  function fdrop(title, key, items, P) {
    const n = P[key] ? P[key].size : 0;
    return '<details class="fdrop' + (n ? " on" : "") + '" data-k="' + key + '"' + (state._openDrop === key ? " open" : "") + "><summary>" + title + (n ? " · " + n : "") + '</summary><div class="fpanel">' + facetBlock(title, key, items, P) + "</div></details>";
  }
  function facetBlock(title, key, items, P, extra) {
    return '<div class="grp"><p class="kk">' + title + "</p>" + items.map((it) =>
      '<label class="cb' + (it.n === 0 && !P[key].has(it.v) ? " off" : "") + '"><input type="checkbox" id="f-' + key + "-" + esc(it.v) + '" data-a="f" data-f="' + key + '" data-v="' + esc(it.v) + '"' + (P[key].has(it.v) ? " checked" : "") + "><span>" + (it.dot ? '<span class="sq sm" style="background:' + it.dot + '"></span> ' : "") + it.label + (it.small ? "<small>" + it.small + "</small>" : "") + '</span><span class="n">' + fint(it.n) + "</span></label>").join("") + (extra || "") + "</div>";
  }
  function pageSearch(r, keep) {
    const P = readP(r.q);
    state._P = P;
    setTitle(P.q ? L("Hasil untuk ", "Results for ") + P.q : L("Telusuri", "Browse"));
    const all = state.catalog.indicators;
    const res = searchResults(P);
    const sort = P.sort || (P.q.trim() ? "" : "books");
    const sorted = res.slice();
    if (sort === "books") sorted.sort((a, b) => b._nb - a._nb || b.n - a.n);
    else if (sort === "latest") sorted.sort((a, b) => (b.last || 0) - (a.last || 0) || b._nb - a._nb);
    else if (sort === "name") sorted.sort((a, b) => a.name_id.localeCompare(b.name_id, "id"));
    else if (!P.q.trim()) sorted.sort((a, b) => b._nb - a._nb);
    state._res = sorted;
    // facet counts: with every other filter applied
    const pool = P.q.trim() ? runSearch(P.q) : all;
    const count = (omit, fn) => { const o = {}; pool.forEach((i) => { if (matches(i, P, omit)) { const k = fn(i); o[k] = (o[k] || 0) + 1; } }); return o; };
    const cT = count("topic", (i) => i.topic), cM = count("measure", (i) => MEASURE_GROUP(i.measure)), cR = count("trend", (i) => i.trend),
      cG = count("geo", (i) => (i.n ? geoKey(i) : "none")), cI = count("ipoo", (i) => i.ipoo), cW = count("who", (i) => i.who),
      cS = count("src", (i) => (isRkd(i) ? "rkd" : "pk")),
      cB = count("nb", (i) => (i._nb >= 5 ? "5+" : i._nb >= 2 ? "2-4" : i._nb === 1 ? "1" : "0"));
    const lang = state.lang === "en" ? 1 : 0;
    const topicItems = state.catalog.topics.map((t) => ({ v: t.id, label: esc(t.short_id), n: cT[t.id] || 0, dot: TOPIC_COLOR[t.id] })).sort((a, b) => b.n - a.n);
    const measureItems = Object.keys(MEASURE).filter((k) => k !== "change" && k !== "difference").map((k) => ({ v: k, label: MEASURE[k][lang], n: cM[k] || 0 })).sort((a, b) => b.n - a.n);
    const trendItems = ["yes", "within_period", "no", "unknown"].map((k) => ({ v: k, label: esc(trendLabel(k)), n: cR[k] || 0, dot: TREND[k].color, small: "" }));
    const geoItems = [{ v: "prov", label: L("Ada nilai provinsi", "Province values"), n: cG.prov || 0 }, { v: "nat", label: L("Hanya nasional atau tanpa wilayah", "National or no area only"), n: cG.nat || 0 },
      { v: "kab", label: L("Hanya kabupaten/kota", "Districts only"), n: cG.kab || 0 }];
    const ipooItems = Object.keys(IPOO).map((k) => ({ v: k, label: IPOO[k][lang], n: cI[k] || 0 }));
    const srcItems = [{ v: "pk", label: "Profil Kesehatan", n: cS.pk || 0 }, { v: "rkd", label: L(SURV() + " (survei)", SURV() + " (survey)"), n: cS.rkd || 0 }];
    const whoItems = Object.keys(WHO).map((k) => ({ v: k, label: WHO[k][lang], n: cW[k] || 0 })).sort((a, b) => b.n - a.n);
    const nbItems = [{ v: "5+", label: L("5 buku atau lebih", "5 or more books"), n: cB["5+"] || 0 }, { v: "2-4", label: L("2 sampai 4 buku", "2 to 4 books"), n: cB["2-4"] || 0 }, { v: "1", label: L("1 buku", "1 book"), n: cB["1"] || 0 }, { v: "0", label: L("Belum ada nilai angka", "No numeric values yet"), n: cB["0"] || 0 }];
    const yrs = state.avail.book_years.filter((y, i) => state.avail.indicators.some((rw) => rw[i] > 0));
    const yopt = (sel) => yrs.map((y) => "<option" + (String(y) === sel ? " selected" : "") + ">" + y + "</option>").join("");
    const prevId = state.preview && sorted.some((i) => i.id === state.preview) ? state.preview : sorted[0] && sorted[0].id;
    state.preview = prevId;
    const shown = sorted.slice(0, state.shown);
    const n = sorted.length;
    $("#main").innerHTML =
      '<div class="wrap"><div class="sbar"><p class="kicker">' + L("Telusuri · " + fint(all.length) + " indikator", "Browse · " + fint(all.length) + " indicators") + "</p><h1>" + (P.q.trim() ? L("Hasil untuk &ldquo;", "Results for &ldquo;") + esc(P.q) + "&rdquo;" : L("Semua indikator", "All indicators")) + "</h1>" +
      '<form class="sbox" id="sform" role="search"><label class="vh" for="q">' + L("Cari indikator", "Search indicators") + "</label>" + ICON.search + '<input id="q" type="search" value="' + esc(P.q) + '" placeholder="' + L("Cari indikator, misalnya campak, bidan, kemiskinan", "Search indicators, for example measles, midwife, poverty") + '"><button class="btn" type="submit">' + L("Cari", "Search") + "</button></form>" +
      '<p class="shint">' + L("Saran saat mengetik menampilkan nama indikator, topik dan tahun buku. Kode indikator hanya ada di halaman indikator, untuk dikutip.", "Suggestions while typing show the indicator name, topic and book years. The indicator code appears only on the indicator page, for citation.") + "</p></div></div>" +
      '<div class="wrap"><div class="fbar" role="group" aria-label="' + L("Saring hasil", "Filter results") + '">' +
      (hasRkd() ? fdrop(L("Sumber", "Source"), "src", srcItems, P) : "") +
      fdrop(L("Topik", "Topic"), "topic", topicItems, P) +
      '<details class="fdrop' + (P.from || P.to ? " on" : "") + '" data-k="year"' + (state._openDrop === "year" ? " open" : "") + "><summary>" + L("Tahun buku", "Book year") + (P.from || P.to ? " · " + (P.from || yrs[0]) + "-" + (P.to || yrs[yrs.length - 1]) : "") + '</summary><div class="fpanel"><div class="grp"><div class="yr"><label class="field"><span class="lab">' + L("Dari", "From") + '</span><select id="f-from" data-a="fy" data-f="from"><option value="">' + yrs[0] + "</option>" + yopt(P.from) + '</select></label><label class="field"><span class="lab">' + L("Sampai", "To") + '</span><select id="f-to" data-a="fy" data-f="to"><option value="">' + yrs[yrs.length - 1] + "</option>" + yopt(P.to) + "</select></label></div></div></div></details>" +
      fdrop(L("Satuan", "Unit type"), "measure", measureItems, P) +
      fdrop(L("Keterbandingan", "Comparability"), "trend", trendItems, P) +
      fdrop(L("Banyak buku", "Number of books"), "nb", nbItems, P) +
      fdrop(L("Tingkat wilayah", "Area level"), "geo", geoItems, P) +
      fdrop(L("Tipe indikator", "Indicator type"), "ipoo", ipooItems, P) +
      fdrop(L("Blok WHO", "WHO block"), "who", whoItems, P) +
      '<a class="freset" href="#/telusuri' + (P.q ? "?q=" + encodeURIComponent(P.q) : "") + '" data-a="reset">' + L("Atur ulang", "Reset") + "</a></div>" +
      '<div class="ws2">' +
      '<section class="main" aria-label="' + L("Hasil", "Results") + '"><div class="rhead"><div class="rt"><h2>' + fint(n) + " " + L("indikator", "indicators") + "</h2><p>" + (P.tp ? L("Dengan tren per provinsi: 5 buku atau lebih dan nilai provinsi. ", "With a province trend: 5 or more books and province values. ") : "") + L("Satu indikator satu entri; persen dan jumlah dari konsep yang sama dipisah menurut jenis ukuran.", "One entry per indicator; a percentage and a count of the same concept are kept apart by their measure.") + '</p></div><label class="field srt"><span class="lab">' + L("Urutkan", "Sort") + '</span><select id="f-sort" data-a="fs">' + SORTS().filter((s) => s[0] !== "" || P.q.trim()).map((s) => '<option value="' + s[0] + '"' + (s[0] === sort ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></label></div>" +
      "<div>" + (shown.length ? shown.map((i) => resultRow(i, i.id === prevId)).join("") : '<p class="empty">' + L("Tidak ada indikator yang cocok. Coba kata lain atau atur ulang saringan.", "No indicator matches. Try another word or reset the filters.") + "</p>") + "</div>" +
      (n > shown.length ? '<div class="more"><button type="button" class="btn sm ol" data-a="more" data-auto="1">' + L("Tampilkan 12 berikutnya", "Show the next 12") + "</button><span>" + shown.length + " " + L("dari", "of") + " " + fint(n) + "</span></div>" : "") + "</section>" +
      '<aside class="pvcol" id="pvcol" aria-label="' + L("Pratinjau", "Preview") + '"></aside></div></div>';
    renderPreview(prevId);
    const f = state._focus; if (f) { const el = document.getElementById(f); if (el) el.focus(); state._focus = null; }
  }
  function resultRow(i, on) {
    const lang = state.lang === "en" ? 1 : 0;
    return '<a class="res' + (on ? " on" : "") + '" href="' + indHref(i.id) + '" data-a="res" data-id="' + esc(i.id) + '"><b>' + esc(indName(i)) + '</b><span class="meta"><span class="dom"><span class="sq" style="background:' + (TOPIC_COLOR[i.topic] || "#687487") + '"></span>' + esc(topicLabel(i._topic)) + '</span>' + srcChip(i) + '<span class="ms"><span>' + MEASURE[i.measure][lang] + "</span></span><span>" +
      (i.n ? esc(yearsLabel(i)) + " · " + i._nb + " " + bookWord(i, i._nb) : L("Belum ada nilai angka", "No numeric values yet")) + '</span><span class="lad"><i style="background:' + (TREND[i.trend] || TREND.unknown).color + '"></i>' + esc(trendLabel(i.trend)) + "</span></span></a>";
  }
  function applySearchState(P, focusId) {
    const h = hashFor("/telusuri", writeP(P));
    history.replaceState(null, "", h);
    state._focus = focusId || null;
    state.shown = 12;
    pageSearch(parseHash(), true);
    renderHeader("telusuri", parseHash());
  }
  /* the search preview shows where an indicator is printed, from the catalogue, and loads no values: browsing must
     not spend the reader's daily limit (agents/innov review 22 Oct: 14 searches had used 13 of 50) */
  function coverStrip(i) {
    const yrs = (state.avail && state.avail.book_years) || [], have = new Set(i.books || []), brk = new Set((i.periods || []).slice(1).map((p) => p.from));
    return '<div class="pvstrip" role="img" aria-label="' + esc(L("Buku yang memuat indikator ini", "Books that print this indicator")) + '">' +
      yrs.map((y) => '<span class="' + (have.has(y) ? "on" : "") + (brk.has(y) ? " brk" : "") + '" title="' + y + '"></span>').join("") + "</div>" +
      '<p class="pvsl"><span>' + (yrs[0] || "") + "</span><span>" + (yrs[yrs.length - 1] || "") + "</span></p>";
  }
  function renderPreview(id) {
    const box = $("#pvcol");
    if (!box) return;
    const i = id && state.byId.get(id);
    if (!i) { box.innerHTML = ""; return; }
    const lang = state.lang === "en" ? 1 : 0;
    const def = (state.lang === "en" ? i.def_en : i.def_id) || "";
    box.innerHTML = '<div class="pv"><p class="kk">' + L("Pratinjau · ", "Preview · ") + esc(topicLabel(i._topic)) + "</p><h3>" + esc(indName(i)) + "</h3>" +
      '<p class="pvt">' + esc(def.length > 230 ? def.slice(0, 230).replace(/\s+\S*$/, "") + "..." : def) + "</p>" +
      '<p class="pvt"><span class="lad"><i style="background:' + (TREND[i.trend] || TREND.unknown).color + '"></i>' + esc(trendLabel(i.trend)) + "</span></p>" +
      (i.district_only ? '<p class="pvt">' + L("Hanya tingkat kabupaten/kota: " + fint(i.district_only.districts) + " kabupaten/kota di " + i.district_only.provinces + " provinsi, " + yearsLabel(i) + "; " + i._nb + " " + bookWord(i, i._nb) + (i.district_only.data_go_id ? " dan data.go.id" : "") + ".", "District level only: " + fint(i.district_only.districts) + " districts in " + i.district_only.provinces + " provinces, " + yearsLabel(i) + "; " + i._nb + " " + bookWord(i, i._nb) + (i.district_only.data_go_id ? " and data.go.id" : "") + ".") + "</p>" : "") +
      (i.district_only ? "" : '<p class="pvt">' + (i.n ? L("Ada di " + i._nb + " " + bookWord(i, i._nb) + ", " + yearsLabel(i) + ". ", "In " + i._nb + " " + bookWord(i, i._nb) + ", " + yearsLabel(i) + ". ") + (i.n_prov ? L(i.n_prov + " provinsi. ", i.n_prov + " provinces. ") : "") : L("Belum ada nilai angka yang terbaca untuk indikator ini.", "No numeric value has been read for this indicator yet.")) + "</p>") +
      (i.n && !i.district_only ? coverStrip(i) : "") +
      (i.n && !i.district_only && i.verified_share < 1 ? '<div class="note" style="margin-top:10px">' + L(fpct(1 - i.verified_share, 0) + "% nilai indikator ini belum terverifikasi.", fpct(1 - i.verified_share, 0) + "% of this indicator's values are not yet verified.") + "</div>" : "") +
      '<div class="pvbtn"><a class="btn sm" href="' + indHref(i.id) + '">' + L("Buka halaman indikator", "Open the indicator page") + "</a>" + (i.n ? (canDl() ? '<button type="button" class="btn sm ol" data-a="csvind" data-id="' + esc(i.id) + '">' + ICON.dl + L("Unduh nilai CSV", "Download values as CSV") + "</button>" : dlGate(i.id, "all")) : "") + "</div></div>";
  }

  /* ------------------------------------------------------------------ METHOD PAGE */
  /* ------------------------------------------------------------------ PICK AN INDICATOR on Home (PI 21 and 22 Oct): the
     availability table, with its numbers, is the way in. On first sight the book years fill in from the earliest to the
     latest, then the themes come in and a four-step guide leads: theme, subtheme, indicator, trend or map. A click
     anywhere on a row picks that row; the chosen theme is framed and the others step back. Rows open in place. */
  /* featured trends under the heatmap (PI 22 Oct, after data.worldbank.org): a few national series drawn from
     data/featured.json (pipeline/build_featured.py), so they cost a visitor nothing of the daily limit */
  const fbig = (v) => (Math.abs(v) >= 100000 ? new Intl.NumberFormat(LOC(), { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 }).format(v) : fval(v));
  // featured trends as "data insights" (PI 25 Oct: "ikuti Data Insight di home ourworldindata"): a tinted band with a
  // row of wide cards that slides sideways, each card the chart on the left and a short reading on the right. The
  // reading is written from the series itself: where the definition changed (trend "within_period"), the change is
  // measured inside the latest definition period only, never across a break.
  function insightText(f, i) {
    const P = f.pts, last = P[P.length - 1], pct = f.unit === "%";
    const period = f.trend === "yes" ? P : P.filter((p) => p[3] === last[3]);
    const first = period[0];
    const other = f.trend === "yes" ? [] : P.filter((p) => p[3] !== last[3]).map((p) => p[0]);
    // counts keep their full or compact form; levels, rates and shares read to one decimal
    const v = (x) => (f.measure === "count" || f.measure === "currency" || Math.abs(x) >= 1000 ? fbig(x)
      : new Intl.NumberFormat(LOC(), { maximumFractionDigits: 1 }).format(x)) + (pct ? "%" : "");
    const name = L(f.title_id, f.title_en);
    let title = name + L(" pada " + last[0] + ": " + v(last[1]), " in " + last[0] + ": " + v(last[1]));
    let change = "";
    if (period.length > 1 && first[0] !== last[0]) {
      const d = last[1] - first[1], up = d > 0, flat = Math.abs(d) < Math.abs(first[1]) * 0.005 || v(first[1]) === v(last[1]);   // the same once rounded reads as no change
      const verb = flat ? L("hampir tetap", "stayed about the same") : up ? L("naik", "rose") : L("turun", "fell");
      title = flat ? name + L(" hampir tetap sejak " + first[0], " has stayed about the same since " + first[0])
        : name + " " + verb + L(" dari " + v(first[1]) + " pada " + first[0] + " menjadi " + v(last[1]) + " pada " + last[0], " from " + v(first[1]) + " in " + first[0] + " to " + v(last[1]) + " in " + last[0]);
      const rel = first[1] ? Math.round((d / Math.abs(first[1])) * 100) : null;
      if (!flat) change = pct ? L("Selisih antara " + first[0] + " dan " + last[0] + " adalah " + fpct(Math.abs(d) / 100, 1) + " poin persen.", "A change of " + fpct(Math.abs(d) / 100, 1) + " percentage points in " + (last[0] - first[0]) + " years.")
        : rel != null ? L("Nilai pada " + last[0] + " " + (up ? "lebih tinggi" : "lebih rendah") + " " + Math.abs(rel) + "% dibandingkan nilai pada " + first[0] + ".", "A change of " + Math.abs(rel) + "% in " + (last[0] - first[0]) + " years.") : "";
      const top = period.reduce((m, p) => (p[1] > m[1] ? p : m)), low = period.reduce((m, p) => (p[1] < m[1] ? p : m));
      if (up && top[0] !== last[0]) change += L(" Nilai tertinggi " + v(top[1]) + " tercatat pada " + top[0] + ".", " The highest value, " + v(top[1]) + ", was in " + top[0] + ".");
      if (!up && !flat && low[0] !== last[0]) change += L(" Nilai terendah " + v(low[1]) + " tercatat pada " + low[0] + ".", " The lowest value, " + v(low[1]) + ", was in " + low[0] + ".");
    }
    const def = String(L(i.def_id, i.def_en) || "").replace(/\s*(Definisi operasional tidak dicetak di buku|The operational definition is not printed in the book)[^.]*\.?/gi, "").trim();
    // years under another definition: before the compared period, or single years inside it
    const yrs = (a) => (a.length > 2 && a[a.length - 1] - a[0] === a.length - 1 ? a[0] + L(" sampai ", " to ") + a[a.length - 1] : a.join(", "));
    const brk = !other.length ? "" : other.every((y) => y < first[0])
      ? L("Sebelum " + first[0] + " buku memakai definisi atau cara pencatatan yang berbeda, sehingga perbandingan di atas hanya dalam periode " + first[0] + " sampai " + last[0] + ".",
        "Before " + first[0] + " the definition or recording differed, so the comparison above stays within " + first[0] + " to " + last[0] + ".")
      : L("Nilai " + yrs(other) + " memakai definisi lain dan tidak ikut dibandingkan.", "The value for " + yrs(other) + " uses another definition and is left out of the comparison.");
    return { title, paras: [change, def, brk].filter(Boolean), from: P[0][0], to: last[0] };
  }
  // a small row of the English articles above "Dari buku ke data" (PI comment 18 Nov: "diatas ini ada thumbnail scroll news
  // article kita. kecil saja"); the list is articles/index.json, written by pipeline/article_pages.py
  function articlesStrip() {
    const A = state.articles && state.articles.articles;
    if (!A || !A.length) return "";
    return '<section class="artstrip" aria-label="' + L("Artikel terbaru", "Latest articles") + '"><div class="wrap"><div class="ashd"><h2>' + L("Artikel terbaru", "Latest articles") +
      ' <small lang="en">' + L("dalam bahasa Inggris", "in English") + '</small></h2><a class="asall" href="articles/">' + L("Semua artikel", "All articles") + ' <span aria-hidden="true">&#8594;</span></a></div>' +
      '<ul class="astrack">' + A.map((a) => '<li><a href="articles/' + encodeURIComponent(a.slug) + '/" lang="en">' +
        (a.thumb ? '<img src="' + esc(a.thumb) + '" alt="" loading="lazy"' + (a.chart ? ' class="ch"' : "") + ">" : "") +
        "<span><b>" + esc(a.title) + "</b><small>" + esc(a.topic || "") + "</small></span></a></li>").join("") + "</ul></div></section>";
  }
  // each selected trend links to its article in English (PI 18 Nov: "trend selection harusnya dibuat articles juga")
  function artLink(f) {
    const A = state.articles && state.articles.articles, want = f.article_id || f.id;
    const a = A && A.find((x) => x.id === want);
    return a ? '<a class="diart" href="articles/' + encodeURIComponent(a.slug) + '/" lang="en">' + L("Baca artikel", "Read the article") + ' <span aria-hidden="true">&#8594;</span></a>' : "";
  }
  function featuredSection() {
    const F = state.featured && state.featured.series;
    if (!F || !F.length) return "";
    const cards = F.map((f) => {
      const i = state.byId.get(f.id);
      if (!i) return "";
      const t = insightText(f, i), unit = f.unit === "%" ? "%" : f.unit;
      const series = [{ name: L(f.title_id, f.title_en), color: "#002147",
        pts: f.pts.map((p) => ({ x: p[0], y: p[1], ver: !!p[2], seg: p[3], tip: p[0] + ": " + fbig(p[1]) + (f.unit === "%" ? "%" : "") })) }];
      // drawn at the width it is shown, so its axis labels keep their size on a phone
      const cwid = window.innerWidth < 600 ? Math.max(260, window.innerWidth - 90) : 380;
      const chart = lineChart({ w: cwid, h: cwid < 380 ? 230 : 250, series, join: f.trend === "yes" ? "all" : "seg", unit: unit, aria: L(f.title_id, f.title_en) });
      return '<li class="dicard' + (artLink(f) ? " hasart" : "") + '"><a class="dilink" href="' + indHref(f.id) + '">' +
        '<figure class="diplate"><p class="dpt">' + esc(L(f.title_id, f.title_en)) + '</p><p class="dps">' + L("Indonesia, nasional", "Indonesia, national") + "</p>" + chart +
        '<p class="dpsrc">' + L("Sumber: Profil Kesehatan Indonesia " + t.from + "-" + t.to, "Source: Indonesia Health Profile " + t.from + "-" + t.to) + "</p></figure>" +
        '<div class="ditext"><p class="didate"><i aria-hidden="true"></i>' + esc(topicLabel(i._topic)) + " · " + L("data " + t.to, "data " + t.to) + "</p><h3>" + esc(t.title) + "</h3>" +
        '<p class="diby">' + L("Buku Profil Kesehatan Indonesia", "Indonesia Health Profile books") + "</p>" +
        '<div class="dibody">' + t.paras.map((x) => "<p>" + esc(x) + "</p>").join("") + "</div></div></a>" + artLink(f) + "</li>";
    }).join("");
    return '<section class="sec di-sec"><div class="wrap"><div class="dihd"><div><h2>' + L("Tren nasional pilihan", "Selected national trends") + "</h2><p>" +
      L("Ringkasan singkat perubahan indikator nasional menurut buku Profil Kesehatan Indonesia.", "Short readings of how national indicators have changed, from the Indonesia Health Profile books.") + "</p></div>" +
      '<a class="btn ol dimore" href="' + (PAGES ? "articles/" : "#/telusuri") + '">' + (PAGES ? L("Semua artikel", "All articles") : L("Telusuri semua indikator", "Browse all indicators")) + ' <span aria-hidden="true">&#8594;</span></a></div>' +
      '<div class="dicar"><ul class="ditrack" id="ditrack">' + cards + "</ul>" +
      '<button type="button" class="dinav prev" data-a="dinav" data-d="-1" hidden aria-label="' + L("Sebelumnya", "Previous") + '">&#8249;</button>' +
      '<button type="button" class="dinav next" data-a="dinav" data-d="1" aria-label="' + L("Berikutnya", "Next") + '">&#8250;</button></div></div></section>';
  }
  function pickerSection() {
    const q = (state.hx && state.hx.q) || "";
    return '<section class="sec pick-sec' + (state.hxSeen ? " ready" : "") + '" id="pilih"><div class="wrap"><p class="kicker">' + L("Ketersediaan · pilih indikator", "Availability · pick an indicator") + "</p><h2>" +
      L("Jumlah indikator per tema dan tahun buku", "Indicators per theme and book year") + "</h2>" + hxExample() +
      '<div class="hxq">' + ICON.search + '<label class="vh" for="hxq">' + L("Cari indikator di tabel", "Search indicators in the table") + '</label><input id="hxq" type="search" autocomplete="off" value="' + esc(q) + '" placeholder="' + L("Cari indikator di tabel ini, misalnya campak", "Search indicators in this table, for example measles") + '"></div>' +
      '<div id="hx">' + hxTable() + "</div></div></section>";
  }
  // themes grouped as the PI asked (22 Oct): health status first, then its determinants, then the health system
  const HX_GROUPS = [
    [["Penyakit dan status kesehatan", "Disease and health status"], ["communicable-diseases-surveillance", "noncommunicable-diseases-risk-factors", "maternal-newborn-child-health", "nutrition", "population-demography-mortality", "emergency-disaster-health-security"]],
    [["Determinan kesehatan", "Health determinants"], ["environmental-health-sanitation", "health-promotion-behaviour"]],
    [["Sistem kesehatan", "Health system"], ["health-services-coverage", "health-workforce-facilities-education", "medicines-medical-technology", "financing-governance-administration"]],
    [["Lainnya", "Other"], ["other-health-statistics"]]];
  function hxTopics() {
    const out = [], seen = new Set();
    HX_GROUPS.forEach(([lab, ids]) => ids.forEach((id) => { const t = state.topicById.get(id); if (t) { out.push([t, L(lab[0], lab[1])]); seen.add(id); } }));
    state.catalog.topics.forEach((t) => { if (!seen.has(t.id)) out.push([t, L("Lainnya", "Other")]); });
    return out;
  }
  function hxGuide(H, tp, sb, it) {
    const lang = state.lang === "en" ? 1 : 0;
    const step = !H.t ? 1 : !H.u ? 2 : 3;
    const st = [
      [L("Tema", "Theme"), tp ? tp.short_id : L("Pilih tema", "Pick a theme")],
      [L("Subtema", "Subtheme"), sb ? (lang ? sb.label_en : sb.label_id) : L("Pilih subtema", "Pick a subtheme")],
      [L("Indikator", "Indicator"), L("Buka halaman indikator", "Open its page")]];
    const hint = [
      L("Langkah 1: klik nama tema atau angka mana pun di baris tema itu.", "Step 1: click a theme name or any number on its row."),
      L("Langkah 2: pilih subtema di bawah tema yang terbuka. Klik nama tema lagi untuk menutup daftar subtema.", "Step 2: pick a subtheme under the open theme. Click the theme name again to close it."),
      L("Langkah 3: klik indikator untuk membuka halaman indikator, dengan tren antar tahun dan peta provinsi. Kotak gelap menandai tahun buku yang memuat nilai indikator itu.", "Step 3: click an indicator to open its page, with its trend across years and its province map. A dark block marks a book year that prints its values.")][step - 1];
    return '<ol class="hxsteps" aria-label="' + L("Langkah memilih indikator", "Steps to pick an indicator") + '">' + st.map((s, k) => {
      const n = k + 1, cls = n < step ? "done" : n === step ? "on" : "todo";
      const inner = '<span class="n">' + n + '</span><span class="tx"><small>' + s[0] + "</small><b>" + esc(s[1]) + "</b></span>";
      return '<li class="' + cls + '"' + (n === step ? ' aria-current="step"' : "") + ">" + (n < step ? '<button type="button" data-a="hx" data-back="' + n + '" title="' + L("Kembali ke langkah ini", "Back to this step") + '">' + inner + "</button>" : "<div>" + inner + "</div>") + "</li>";
    }).join("") + '</ol><p class="hxhint" aria-live="polite">' + hint + "</p>";
  }
  function hxTable() {
    const H = state.hx || (state.hx = { t: "", u: "", i: "", s: "all", q: "", lim: 40 });
    const lang = state.lang === "en" ? 1 : 0;
    const q0 = norm(H.q || ""), qn = q0.length >= 2 ? q0 : "";  // one letter matches nearly everything: no filter
    const sq = (i) => (i._sq && i._sql === state.lang ? i._sq : ((i._sql = state.lang), (i._sq = norm(indName(i) + " " + i.name_id + " " + i.id))));
    const all = state.catalog.indicators.filter((i) => i.n > 0 && listed(i) && (H.s === "all" || (H.s === "rkd") === isRkd(i)) && (!qn || sq(i).includes(qn)));
    const Y = Array.from(new Set(all.flatMap((i) => i.books || []))).sort((a, b) => a - b);
    const yix = new Map(Y.map((y, k) => [y, k]));
    const cnt = (list) => { const c = Y.map(() => 0); list.forEach((i) => (i.books || []).forEach((y) => { const k = yix.get(y); if (k != null) c[k]++; })); return c; };
    const btn = (attrs, inner) => '<button type="button" data-a="hx" ' + attrs + ">" + inner + "</button>";
    const cells = (list, attrs) => cnt(list).map((n, c) => {
      if (!n) return '<td class="e" style="--c:' + c + '">&middot;</td>';
      const r = rampOf(n);
      return '<td style="background:' + r[0] + ";color:" + r[1] + ";--c:" + c + '">' + btn(attrs + ' data-c="1" aria-label="' + esc(Y[c] + ": " + fint(n)) + '"', fint(n)) + "</td>";
    }).join("");
    const head = '<tr><th class="l">' + L("Tema", "Theme") + "</th>" + Y.map((y, c) => '<th style="--c:' + c + '">' + "'" + String(y).slice(2) + "</th>").join("") + "</tr>";
    let body = "", selT = null, selU = null, selI = null, rw = 0, lastG = "", shown = 0;
    hxTopics().forEach(([tp, grp]) => {
      const tl = all.filter((i) => i.topic === tp.id);
      if (!tl.length || (qn && shown >= H.lim)) return;
      if (grp !== lastG) { lastG = grp; body += '<tr class="hxg"><td class="l" style="--rw:' + rw++ + '">' + esc(grp) + '</td><td colspan="' + Y.length + '"></td></tr>'; }
      const open = H.t === tp.id || !!qn;
      if (open) selT = tp;
      body += '<tr class="hx0' + (open ? " open" : "") + '"><td class="l" style="--rw:' + rw++ + '">' + btn('data-t="' + tp.id + '" aria-expanded="' + open + '"', '<span class="tw">' + (open ? "&#9662;" : "&#9656;") + '</span><span class="sq" style="background:' + (TOPIC_COLOR[tp.id] || "#687487") + '"></span>' + esc(tp.short_id) + "<b>" + fint(tl.length) + "</b>") + "</td>" + cells(tl, 'data-t="' + tp.id + '"') + "</tr>";
      if (!open) return;
      const subs = (tp.subs || []).filter((sb) => tl.some((i) => i.sub === sb.id));
      if (tl.some((i) => !i.sub)) subs.push({ id: "-", label_id: "Belum dikelompokkan", label_en: "Not yet grouped" });
      const groups = subs.length ? subs : [{ id: "*", label_id: "Semua indikator", label_en: "All indicators" }];
      if (groups.length === 1 && !H.u) H.u = groups[0].id;
      groups.forEach((sb) => {
        const sl = tl.filter((i) => sb.id === "*" || (sb.id === "-" ? !i.sub : i.sub === sb.id));
        if (!sl.length || (qn && shown >= H.lim)) return;
        const so = H.u === sb.id || !!qn;
        if (so) selU = sb;
        body += '<tr class="hx1' + (so ? " open" : "") + '"><td class="l">' + btn('data-t="' + tp.id + '" data-u="' + sb.id + '" aria-expanded="' + so + '"', '<span class="tw">' + (so ? "&#9662;" : "&#9656;") + "</span>" + esc(lang ? sb.label_en : sb.label_id) + "<b>" + fint(sl.length) + "</b>") + "</td>" + cells(sl, 'data-t="' + tp.id + '" data-u="' + sb.id + '"') + "</tr>";
        if (!so) return;
        const IPO = ["input", "process", "output", "outcome", "context"], io = (i) => (IPO.indexOf(i.ipoo) + 1 || 9);
        const list = sl.slice().sort((a, b) => io(a) - io(b) || b._nb - a._nb || indName(a).localeCompare(indName(b), "id"));
        let lastP = "";
        list.slice(0, qn ? Math.max(0, H.lim - shown) : H.lim).forEach((i) => {
          shown++;
          if (i.ipoo !== lastP) { lastP = i.ipoo; body += '<tr class="hxp"><td class="l">' + esc(IPOO[i.ipoo] ? IPOO[i.ipoo][lang] : L("Lainnya", "Other")) + '</td><td colspan="' + Y.length + '"></td></tr>'; }
          const on = H.i === i.id, bk = new Set(i.books || []);
          if (on) selI = i;
          body += '<tr class="hx2' + (on ? " open" : "") + '" data-a="hx" data-t="' + tp.id + '" data-u="' + sb.id + '" data-i="' + esc(i.id) + '"><td class="l">' + btn('data-t="' + tp.id + '" data-u="' + sb.id + '" data-i="' + esc(i.id) + '" aria-expanded="' + on + '"', '<span class="nm">' + esc(indName(i)) + "</span>" + srcChip(i)) + "</td>" +
            Y.map((y) => '<td class="mk">' + (bk.has(y) ? '<i class="' + (isRkd(i) ? "rk" : "") + '"></i>' : "") + "</td>").join("") + "</tr>";
        });
        if (!qn && list.length > H.lim) body += '<tr class="hxmore"><td colspan="' + (Y.length + 1) + '">' + btn('data-more="1" data-auto="1"', L("Tampilkan 40 indikator berikutnya", "Show the next 40 indicators") + " (" + H.lim + " " + L("dari", "of") + " " + fint(list.length) + ")") + "</td></tr>";
      });
    });
    const seg = '<div class="seg hxsrc" role="group" aria-label="' + L("Sumber", "Source") + '">' + [["pk", "Profil Kesehatan"], ["rkd", SURV()], ["all", L("Semua sumber", "All sources")]].map(([v, lab]) =>
      btn('data-s="' + v + '"' + (v === H.s ? ' aria-pressed="true"' : ""), lab)).join("") + "</div>";
    if (qn && all.length > shown) body += '<tr class="hxmore"><td colspan="' + (Y.length + 1) + '">' + btn('data-more="1" data-auto="1"', L("Tampilkan 40 indikator berikutnya", "Show the next 40 indicators") + " (" + shown + " " + L("dari", "of") + " " + fint(all.length) + ")") + "</td></tr>";
    if (qn && !all.length) body = '<tr class="hxnone"><td class="l" colspan="' + (Y.length + 1) + '">' + L("Tidak ada indikator yang cocok dengan pencarian ini.", "No indicator matches this search.") + "</td></tr>";
    const cls = "av hx" + (state.hxSeen ? "" : " pre") + (H.t ? " has-t" : "") + (H.u && selU ? " has-u" : "") + (H.i && selI ? " has-i" : "");
    return '<div class="hxbar">' + (hasRkd() ? seg : "") + legendRamp(true) + "</div>" +
      '<div class="tw hmw" data-hint="' + swipeHint() + '"><table class="' + cls + '" data-n="' + Y.length + '" style="--sweep:' + Y.length + '"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>" +
      "";
  }
  // a worked example (PI 22 Oct: "kasih contoh gimana untuk navigate heatmap"): the three clicks that lead to one
  // indicator, played on request in the table itself
  const HX_EX = ["communicable-diseases-surveillance", "communicable-diseases-surveillance/demam-berdarah", "CDS-01-043"];
  function hxExample() {
    const t = state.topicById.get(HX_EX[0]), sb = state.subById && state.subById.get(HX_EX[1]), i = state.byId.get(HX_EX[2]);
    if (!t || !sb || !i) return "";
    const lab = (x) => esc(state.lang === "en" ? x.label_en || x.label_id : x.label_id);
    return '<p class="hxeg"><b>' + L("Contoh", "Example") + "</b> " + lab(t) + " <span>&rsaquo;</span> " + lab(sb) + " <span>&rsaquo;</span> " + esc(indName(i)) +
      ' <button type="button" class="btn sm ol" data-a="hxdemo">' + L("Tunjukkan", "Show me") + "</button></p>";
  }
  function hxRedraw() {
    const box = $("#hx"); if (!box) return;
    state.hxSeen = true;
    const sec = $("#pilih"); if (sec) sec.classList.add("ready");
    box.innerHTML = hxTable();
  }
  function hxDemo() {
    const H = state.hx, box = $("#hx");
    if (!H || !box) return;
    clearTimeout(state._hxDemo);
    H.q = ""; H.s = "all"; H.t = H.u = H.i = ""; H.lim = 40;
    const mark = (sel) => { const b = $("#hx").querySelector(sel), el = b && b.closest("tr"); if (!el) return; el.classList.add("hxdemo"); el.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
    const steps = [
      () => { H.t = HX_EX[0]; hxRedraw(); mark('button[data-t="' + HX_EX[0] + '"]:not([data-u]):not([data-c])'); },
      () => { H.u = HX_EX[1]; hxRedraw(); mark('button[data-u="' + HX_EX[1] + '"]:not([data-i]):not([data-c])'); },
      () => mark('tr.hx2[data-i="' + HX_EX[2] + '"] td')];
    const run = (k) => { if (k < steps.length && $("#hx")) { steps[k](); state._hxDemo = setTimeout(() => run(k + 1), 900); } };
    $("#pilih").scrollIntoView({ block: "start", behavior: "smooth" });
    state._hxDemo = setTimeout(() => run(0), 350);
  }
  function hxClick(a) {
    const H = state.hx, d = (k) => a.getAttribute("data-" + k), cell = !!d("c");
    if (d("back")) { const n = +d("back"); if (n <= 1) H.t = H.u = H.i = ""; else if (n === 2) H.u = H.i = ""; else H.i = ""; H.lim = 40; }
    else if (d("s")) { H.s = d("s"); H.t = H.u = H.i = ""; }
    else if (d("more")) H.lim += 40;
    else if (d("i")) { location.href = indHref(d("i")); return; }
    else if (d("u")) { H.u = H.u === d("u") && !cell ? "" : d("u"); H.i = ""; H.lim = 40; }
    else if (d("t")) { const same = H.t === d("t"); H.t = same && !cell ? "" : d("t"); if (!same) H.u = ""; H.i = ""; H.lim = 40; }
    state.hxSeen = true;
    const sec = $("#pilih");
    if (sec) sec.classList.add("ready");  // a click during the intro ends it
    const box = $("#hx"), top = box.getBoundingClientRect().top;
    box.innerHTML = hxTable();
    window.scrollBy(0, box.getBoundingClientRect().top - top);  // the table stays where the reader is looking
    const f = box.querySelector('button[data-a="hx"]' + (H.i ? '[data-i="' + H.i + '"]' : H.u ? '[data-u="' + H.u + '"]:not([data-i]):not([data-c])' : H.t ? '[data-t="' + H.t + '"]:not([data-u]):not([data-c])' : ""));
    if (f && (a.closest("td") || a.closest(".hxsteps"))) f.focus({ preventScroll: true });
  }
  // the first sight of the table: book years fill in from the earliest to the latest (on a phone the table scrolls
  // along with them), then the themes and the guide come in; reduced motion shows everything at once
  function hxIntro() {
    const sec = $("#pilih"), t = sec && sec.querySelector("table.hx");
    if (!t || !t.classList.contains("pre")) return;
    const done = () => { state.hxSeen = true; t.classList.remove("pre"); sec.classList.add("ready"); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return done();
    const STEP = 12, n = +t.dataset.n || 30, dur = n * STEP + 120;  // about half a second across the book years (PI 22 Oct: faster again)
    const go = () => {
      state.hxSeen = true;
      const w = t.parentElement, max = w.scrollWidth - w.clientWidth;
      t.classList.remove("pre"); t.classList.add("sweep");
      sec.classList.add("ready");  // themes and subthemes come in while the years sweep, not after (PI 22 Oct)
      if (max > 4) {
        w.scrollLeft = 0;
        const t0 = performance.now();
        const tick = (now) => { const p = Math.min(1, (now - t0) / dur); w.scrollLeft = max * p; if (p < 1 && t.isConnected) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
      setTimeout(() => t.classList.remove("sweep"), dur + 600);
    };
    // watch the scrolling frame, not the table: on a phone the table is wider than the screen, so its own visible share
    // never reaches the threshold
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); go(); } }, { threshold: window.innerWidth <= 700 ? 0.12 : 0.3 });  // a phone frame is tall
    io.observe(t.parentElement);
  }

  // district-only indicators: how columns without a national counterpart become indicators (moved from the
  // Subnational page to the Method page, PI 25 Oct: "ini kebawah taruh di metode")
  function distMethod() {
    return '<section class="secx" id="kabkota"><p class="kicker">' + L("Indikator kabupaten/kota", "District indicators") + "</p><h2>" + L("Ukuran yang hanya dicetak untuk kabupaten/kota", "Measures printed for districts only") + "</h2>" +
      '<p class="lead">' + L("Beberapa kolom dalam tabel kabupaten/kota tidak memiliki pasangan di buku nasional. Ukuran yang sama dari berbagai provinsi dan data.go.id disatukan sebagai satu indikator kabupaten/kota pada tema dan subtema yang sesuai, dengan nama serta definisi tersendiri. Untuk data jumlah, nilai dibandingkan dengan total provinsi pada tabel yang sama. Indikator ditampilkan jika memiliki setidaknya 20 nilai.", "Some columns in district tables have no equivalent in the national book. Matching measures from different provinces and data.go.id are grouped as one district indicator under the relevant theme and subtheme, with a distinct name and definition. Counts are checked against the province total in the same table. An indicator is shown when it has at least 20 values.") +
      ' <a href="' + hashFor("/telusuri", { geo: "kab" }) + '">' + L("Telusuri indikator kabupaten/kota", "Browse the district indicators") + '</a> · <a href="#/metode/subnasional">' + L("Data subnasional", "Subnational data") + "</a></p></section>";
  }
  function rkdMethod() {
    const R = state.manifest.riskesdas;
    if (!R || !R.indicators) return "";
    const span = R.reports.length > 1 ? R.reports[0] + L(" sampai ", " to ") + R.reports[R.reports.length - 1] : String(R.reports[0]);
    const what = SURV() === "SKI" ? L("Survei Kesehatan Indonesia (SKI) merupakan survei rumah tangga Kementerian Kesehatan yang meneruskan Riset Kesehatan Dasar (Riskesdas). Jika indikator SKI dan Riskesdas mengukur hal yang sama, keduanya menggunakan satu indikator bersama.", "Survei Kesehatan Indonesia (SKI) is the Ministry of Health's household survey that succeeded Riset Kesehatan Dasar (Riskesdas). When an SKI indicator measures the same subject as a Riskesdas indicator, both use the same indicator.")
      : L("Kementerian Kesehatan menyelenggarakan Riset Kesehatan Dasar sebagai survei rumah tangga.", "Riset Kesehatan Dasar is the Ministry of Health's household survey.");
    return '<section class="secx" id="riskesdas"><div class="g2"><div><p class="kicker">' + SURV() + "</p><h2>" + L("Digitalisasi Laporan " + SURVF() + " " + span, "Digitised " + SURVF() + " reports " + span) + "</h2>" +
      '<p class="lead" style="font-size:16px;margin-top:10px">' + what + " " + L("Tabel dalam laporan nasional survei (" + R.reports.join(", ") + ") diproses dengan cara yang sama seperti buku Profil. Setiap nilai mencatat laporan, halaman, tabel, baris, dan judul kolom persis seperti yang tercetak.",
        "Tables in national reports for the survey (" + R.reports.join(", ") + ") are processed in the same way as the Profil books. Each value records the report, page, table, row, and column heading as printed.") + "</p></div>" +
      '<div><ul class="ep" style="margin-top:6px">' +
      "<li><code>" + fint(R.indicators) + "</code><span>" + L("indikator survei. Nama dari tahun berbeda disatukan hanya jika definisi, populasi, dan satuannya sama. Kategori dalam distribusi menjadi rincian indikator. Kategori yang sama pada gelombang berbeda menggunakan satu nama agar trennya tersambung. Label yang sekadar mengutip sebagian judul tabel tidak ditampilkan", "survey indicators. Names from different years are combined only when the definition, population, and unit match. Distribution categories become breakdowns. The same category across survey waves uses one name so its trend can be followed. Labels that merely repeat part of a table heading are omitted") + "</span></li>" +
      "<li><code>" + fint(R.reference_values) + "</code><span>" + L("nilai. " + fint(R.with_province) + " indikator memiliki nilai tingkat provinsi", "values. " + fint(R.with_province) + " indicators have province-level values") + "</span></li>" +
      "<li><code>" + fint(R.linked_to_profil) + "</code><span>" + L("indikator dihubungkan dengan indikator Profil yang sepadan, tetapi datanya tidak digabung. Survei mengukur penduduk, sedangkan Profil mencatat laporan program", "indicators are linked to equivalent Profil indicators, but the data are not combined. The survey measures people, while the Profil records programme reports") + "</span></li>" +
      "</ul></div></div></section>";
  }
  /* ------------------------------------------------------------------ SUBNATIONAL DATA (#/metode/subnasional; PI 22 Oct:
     "buatkan page di methods, khusus tracking subnational ini", first a heatmap of PDF availability by province and year).
     Reads assets/subnational.json (pipeline/build_subnational.py): the state of every provincial book by edition year and
     the reading progress per province. A static file, so it costs a visitor nothing of the daily limit. */
  const SNSTATE = () => ({
    H: [L("Tampil di atlas", "Shown in the atlas")],
    R: [L("Dibaca, belum tampil", "Read, not shown yet")],
    E: [L("Tabel kab/kota ditemukan", "District tables found")],
    D: [L("Belum terbaca", "Not yet readable")],
    N: [L("Tanpa tabel kab/kota", "No district tables")],
    X: [L("Belum dapat diunduh", "Not downloadable")],
    "": [L("Belum ditemukan", "Not found")]
  });
  async function pageSubnational() {
    setTitle(L("Data subnasional", "Subnational data"));
    const main = $("#main");
    main.innerHTML = '<div class="wrap"><p class="loading">' + L("Memuat data subnasional...", "Loading subnational data...") + "</p></div>";
    let D;
    try { const r = await fetch("assets/subnational.json", { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); D = await r.json(); }
    catch (e) { main.innerHTML = '<div class="wrap"><div class="warn" style="margin:40px 0">' + L("Data subnasional tidak dapat dimuat.", "Subnational data could not be loaded.") + "</div></div>"; return; }
    // the data.go.id datasets behind district values (pipeline/build_sdi_sources.py); the page opens without them
    let SD = null;
    try { const r = await fetch("assets/sdi_sources.json", { cache: "no-cache" }); if (r.ok) SD = await r.json(); } catch (e) { /* optional */ }
    const T = D.totals, years = [];
    for (let y = D.years[0]; y <= D.years[1]; y++) years.push(y);
    const cellOf = (p, y) => p.cells[String(y)] || ["", 0, 0, 0, ""];
    const detail = (p, y) => {
      const c = cellOf(p, y), parts = [p.name + ", " + L("edisi ", "edition ") + y + ": " + SNSTATE()[c[0]][0]];
      if (c[1]) parts.push(fint(c[1]) + L(" tabel", " tables") + ", " + fint(c[2]) + L(" dibaca", " read"));
      if (c[3]) parts.push(fint(c[3]) + L(" nilai terbaca", " values read"));
      if (c[5]) parts.push(fint(c[5]) + L(" tampil di atlas", " shown in the atlas"));
      return parts.join(" · ");
    };
    // a cell: its detail in a popover on hover or focus, the download location on click (PI 23 Oct)
    const cell = (p, y) => '<td class="c s' + (cellOf(p, y)[0] || "0") + (cellOf(p, y)[4] ? " lnk" : "") + '" tabindex="0" data-pi="' + D.provinces.indexOf(p) + '" data-y="' + y + '" aria-label="' + esc(detail(p, y)) + '"></td>';
    const legend = '<div class="snl">' + ["H", "R", "E", "D", "N", "X", ""].map((k) => '<span><i class="s' + (k || "0") + '"></i>' + esc(SNSTATE()[k][0]) + "</span>").join("") + "</div>";
    const heat = '<div class="tw snw" data-hint="' + swipeHint() + '"><table class="snx"><thead><tr><th class="l">' + L("Provinsi", "Province") + "</th>" +
      years.map((y) => '<th class="y">' + (y % 5 === 0 || y === years[0] || y === years[years.length - 1] ? y : "'" + String(y).slice(2)) + "</th>").join("") + '<th class="n">' + L("Edisi", "Editions") + "</th></tr></thead><tbody>" +
      // the province's coat of arms and a link to its region page (PI comment 25 Oct: "kasih logo provinsi kecil diujung kirinya")
      D.provinces.map((p) => '<tr><th class="l"><span class="pn"><img class="emb" src="assets/emblems/' + esc(p.code) + '.png" alt="" loading="lazy" height="20">' +
        (PAGES ? '<a href="wilayah/' + esc(String(p.name).toLowerCase().replace(/\./g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) + '/">' + esc(p.name) + "</a>" : esc(p.name)) + "</span></th>" + years.map((y) => cell(p, y)).join("") + '<td class="n">' + (p.editions || "") + (p.before.length ? "<sup>*</sup>" : "") + "</td></tr>").join("") + "</tbody></table></div>";
    const before = D.provinces.filter((p) => p.before.length).map((p) => p.name + " " + p.before.join(", ")).join("; ");
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const prog = '<div class="tw" data-hint="' + swipeHint() + '"><table class="snp"><thead><tr><th class="l">' + L("Provinsi", "Province") + "</th><th>" + L("Edisi dengan tabel", "Editions with tables") + "</th><th>" + L("Tabel", "Tables") + "</th><th>" + L("Tabel dibaca", "Tables read") + '</th><th class="bar"></th><th>' + L("Kabupaten/kota di atlas", "Districts in the atlas") + "</th><th>" + L("Nilai terbaca", "Values read") + "</th><th>" + L("Nilai di atlas", "Values in the atlas") + '</th><th class="l">' + L("Tautan sumber", "Source links") + "</th></tr></thead><tbody>" +
      D.provinces.filter((p) => p.editions).map((p) => "<tr><th class=\"l\">" + esc(p.name) + "</th><td>" + p.with_tables + "</td><td>" + fint(p.tables) + "</td><td>" + fint(p.tables_read) + '</td><td class="bar"><span><i style="width:' + pct(p.tables_read, p.tables) + '%"></i></span>' + pct(p.tables_read, p.tables) + "%</td><td>" + (p.districts ? p.districts + " / " + p.districts_total : "") + "</td><td>" + (p.values ? fint(p.values) : "") + "</td><td>" + (p.shown ? fint(p.shown) : "") + '</td><td class="l lk">' + Object.keys(p.cells).filter((y) => p.cells[y][4]).map((y) => '<a href="' + esc(p.cells[y][4]) + '" target="_blank" rel="noopener"' + (p.cells[y][0] === "X" ? ' class="xl" title="' + esc(L("Diketahui ada, belum dapat diunduh", "Known to exist, not downloadable")) + '"' : "") + ">" + y + "</a>").join(" ") + "</td></tr>").join("") + "</tbody></table></div>";
    // the extraction audit (24 Oct; work/prov/audit_weighted.py): samples of 400 district values checked on the printed
    // page, stratified by check status and reading method, weighted here to the statuses of the values the atlas shows
    const auditSec = (A) => {
      if (!A || !A.samples || !A.samples.length) return "";
      const S = A.samples, z = S[S.length - 1], P = A.population, NP = Object.keys(P).reduce((a, k) => a + P[k], 0), pc = (x) => fpct(x, 1) + "%";
      const ST = { v: L("Sama dengan buku nasional", "Agrees with the national book"), s: L("Sama, tahun digeser satu", "Agrees, year moved by one"),
        c: L("Sama dengan total tercetak", "Adds up to the printed total"), a: L("Berbeda, lolos tinjauan", "Differs, accepted on review"),
        u: L("Tanpa pembanding", "Nothing to compare with"), t: L("Khusus kab/kota, total sama", "District-only, total agrees"),
        o: L("Khusus kab/kota, tanpa total", "District-only, no total"), k: L("Data administratif SI-SDMK", "SI-SDMK administrative data") };   // short: the chart cuts labels at about 38 characters
      const byS = Object.keys(P).filter((k) => z.by_status[k] && ST[k]).sort((a, b) => P[b] - P[a]).map((k) => {
        const s = z.by_status[k];
        return { label: ST[k] + " (" + Math.round((P[k] / NP) * 100) + "%)", value: (s[0] / s[1]) * 100, text: Math.round((s[0] / s[1]) * 100) + "% (" + s[0] + "/" + s[1] + ")", color: "#002147" };
      });
      const byT = S.map((x, k) => ({ label: L("Sampel " + (k + 1) + ": ", "Sample " + (k + 1) + ": ") + x.note[state.lang === "en" ? 1 : 0], value: x.weighted_share * 100, text: pc(x.weighted_share) + " (" + fpct(x.ci95[0], 1) + "-" + fpct(x.ci95[1], 1) + ")", color: k === S.length - 1 ? "#002147" : "#9aa6b2" }));
      const before = S.length > 1 ? L(", dibandingkan " + pc(S[0].weighted_share) + " sebelum perbaikan", ", against " + pc(S[0].weighted_share) + " before the fixes") : "";
      // samples taken after the fixes whose intervals overlap: their difference is within sampling variation (x2 89.3% and
      // x3 83.6% on 24 Oct; the errors of x3 were older column links, not the new decisions)
      const p_ = S.length > 2 ? S[S.length - 2] : null;
      const overlap = p_ && z.ci95[0] <= p_.ci95[1] && p_.ci95[0] <= z.ci95[1];
      // the latest sample checked by another language model than the one before (25 Oct: x5 by Claude agents, x1-x4 by
      // Codex): part of the difference may come from the checker, and the page says so
      const other = p_ && z.checker && p_.checker && z.checker !== p_.checker;
        return '<section class="secx"><p class="kicker">' + L("Ketepatan bacaan", "Reading accuracy") + "</p><h2>" + L("Seberapa sering nilai kabupaten/kota cocok dengan halaman cetak", "How often a district value matches the printed page") + "</h2>" +
        '<p class="lead">' + L("Pemeriksa mencocokkan sampel acak yang terdiri atas " + z.items + " nilai kabupaten/kota di atlas dengan halaman buku Profil Kesehatan Provinsi yang memuat setiap nilai. Pengambilan sampel dikelompokkan menurut status pemeriksaan dan metode pembacaan tabel, lalu diberi bobot berdasarkan jumlah nilai pada setiap status. Dalam sampel terbaru, " + pc(z.weighted_share) + " nilai cocok (selang kepercayaan 95%: " + pc(z.ci95[0]) + " sampai " + pc(z.ci95[1]) + ")" + before + "." + (overlap ? " Selang kepercayaan sampel setelah perbaikan saling tumpang tindih. Dengan demikian, perbedaan antarsampel masih berada dalam rentang variasi pengambilan sampel." : "") +
          (other ? " Sampel terbaru diperiksa dengan model bahasa yang berbeda dari pemeriksaan sebelumnya atas data yang hampir sama. Perbedaan model pemeriksa mungkin menjelaskan sebagian selisih hasil kedua sampel." : "") + " Angka yang tercetak hampir selalu dibaca dengan benar. Kesalahan yang tersisa umumnya terjadi ketika kolom dihubungkan dengan indikator yang kurang tepat. Contohnya, bagian tabel untuk satu jenis kelamin atau kelompok umur dibaca sebagai keseluruhan, atau jumlah sekolah digunakan sebagai ukuran jumlah murid.",
          "Reviewers matched a random sample of " + z.items + " district values in the atlas to the pages of the provincial Health Profiles that contain them. Sampling was stratified by check status and table-reading method, then weighted by the number of values in each status. In the latest sample, " + pc(z.weighted_share) + " matched (95% confidence interval: " + pc(z.ci95[0]) + " to " + pc(z.ci95[1]) + ")" + before + "." + (overlap ? " The confidence intervals for samples taken after the fixes overlap. The differences between those samples therefore remain within sampling variation." : "") +
          (other ? " The latest sample was checked by a different language model from the previous review of nearly the same data. The difference between the models may explain part of the change in results." : "") + " The printed figures are almost always read correctly. Remaining errors usually involve linking a column to a less suitable indicator. For example, a table section for one sex or age group may be read as the total, or the number of schools may be used for the number of pupils.") + "</p>" +
        '<div class="g2" style="margin-top:16px"><figure class="fig"><p class="ft2">' + L("Nilai yang cocok, menurut sampel", "Values that match, by sample") + '</p><p class="fs">' + L("Persentase tertimbang menurut jumlah nilai di setiap status pemeriksaan. Perbaikan pertama memindahkan kolom yang berisi bagian tabel (misalnya satu jenis kelamin) ke rincian indikator yang sesuai dan memeriksa setiap temuan audit di halaman" + (S.length > 2 ? "; perbaikan kedua memeriksa setiap kolom ukuran khusus kabupaten/kota dan setiap pasangan kolom yang mengisi sel yang sama" : "") + (S.length > 3 ? "; perbaikan ketiga memeriksa setiap kolom yang belum pernah diperiksa, tabel demi tabel" : "") + ". Dalam kurung: selang kepercayaan 95%.", "Percent weighted by the number of values in each check status. The first fixes moved part-of-table columns to their breakdown and checked every audit finding on the page" + (S.length > 2 ? "; the second checked every column of the district-only measures and every pair of columns that filled the same cell" : "") + (S.length > 3 ? "; the third checked every column no review had checked, table by table" : "") + ". In brackets: 95% confidence interval.") + '</p><div style="margin-top:10px">' +
        barChart({ w: cw(600), rows: byT, xTitle: L("Persen nilai yang cocok dengan halaman cetak", "Percent of values matching the printed page"), max: 100, labelW: 250, rowH: 40, mr: 118 }) + "</div></figure>" +
        '<figure class="fig"><p class="ft2">' + L("Menurut status pemeriksaan, sampel terakhir", "By check status, latest sample") + '</p><p class="fs">' + L("Status: apakah kabupaten/kota berjumlah sama dengan total provinsi yang tercetak di tabel yang sama, dan total itu dengan buku nasional. Dalam kurung: bagian status itu di antara nilai yang tampil.", "Status: whether the districts add up to the province total printed in the same table, and that total to the national book. In brackets: the status's share of the values shown.") + '</p><div style="margin-top:10px">' +
        barChart({ w: cw(600), rows: byS, xTitle: L("Persen nilai yang cocok", "Percent of values that match"), max: 100, labelW: 290, rowH: 32, mr: 84 }) + "</div></figure></div>" +
        '<p class="src">' + L("Nilai dari dataset data.go.id tidak termasuk sampel. Diperbarui " + esc(A.built) + ".", "Values from data.go.id datasets are not in the samples. Updated " + esc(A.built) + ".") + "</p></section>";
    };
    main.innerHTML = '<div class="wrap"><div class="th"><p class="kicker"><a href="#/metode">' + L("Metode", "Method") + "</a> · " + L("Data subnasional", "Subnational data") + "</p><h1>" + L("Profil Kesehatan Provinsi", "Provincial Health Profiles") + "</h1>" +
      '<p class="lead2">' + L("Setiap Dinas Kesehatan provinsi menerbitkan Profil Kesehatan dengan lampiran tabel menurut kabupaten/kota. Atlas mengumpulkan buku-buku itu untuk membawa indikator nasional ke tingkat kabupaten/kota. Halaman ini mencatat buku yang sudah diperoleh dan tabel yang sudah dibaca.", "Every provincial health office publishes a Health Profile with annex tables by district. The atlas collects these books to bring the national indicators down to district level. This page records the books obtained and the tables read so far.") + "</p>" +
        "</div>" +
      '<section class="secx" style="border-top:0"><p class="kicker">' + L("Ketersediaan berkas", "Availability of the books") + "</p><h2>" + L("Buku per provinsi dan tahun edisi", "Books by province and edition year") + "</h2>" +
      legend + heat + '<p class="sndet" id="sndet" aria-live="polite">' + L("Arahkan atau ketuk sel untuk melihat keterangan dan sampul buku; klik sel untuk membuka lokasi unduhan buku.", "Point at or tap a cell for its detail and the book's cover; click a cell to open its download location.") + "</p>" + (before ? '<p class="src"><sup>*</sup> ' + L("Termasuk edisi sebelum " + years[0] + ": ", "Includes editions before " + years[0] + ": ") + esc(before) + ".</p>" : "") +
      '<p class="src">' + L("Sumber: situs Dinas Kesehatan dan PPID provinsi, portal Satu Data provinsi, berkas yang ditautkan dari situs tersebut, dan salinan arsip situs Kementerian Kesehatan serta Dinas Kesehatan di Internet Archive. Diperbarui ", "Sources: provincial health office and PPID websites, provincial Satu Data portals, files linked from those sites, and Internet Archive copies of the Ministry of Health and provincial health office sites. Updated ") + esc(D.built) + ".</p></section>" +
      // the key numbers and the way to the region pages, under the table (PI comment 26 Oct: "taruh dibawah saja")
      '<div class="snk snk2"><div><b>' + T.provinces_with_books + " / " + T.provinces + "</b><span>" + L("provinsi dengan buku", "provinces with books") + "</span></div><div><b>" + fint(T.editions) + "</b><span>" + L("edisi buku", "book editions") + "</span></div><div><b>" + fint(T.with_tables) + "</b><span>" + L("edisi dengan tabel kabupaten/kota", "editions with district tables") + "</span></div><div><b>" + pct(T.tables_read, T.tables) + "%</b><span>" + L(fint(T.tables_read) + " dari " + fint(T.tables) + " tabel dibaca", fint(T.tables_read) + " of " + fint(T.tables) + " tables read") + "</span></div>" +
        (T.shown ? "<div><b>" + fint(T.shown) + "</b><span>" + L("nilai kabupaten/kota tampil di atlas, " + T.districts + " dari " + T.districts_total + " kabupaten/kota", "district values shown in the atlas, " + T.districts + " of " + T.districts_total + " districts") + "</span></div>" : "") + "</div>" +
      (PAGES ? '<p class="snreg"><a class="tl ar" href="wilayah/">' + L("Data per provinsi dan kabupaten/kota: indikator yang tersedia untuk setiap wilayah", "Data by province and district: the indicators available for each area") + "</a></p>" : "") +
      '<section class="secx"><p class="kicker">' + L("Pembacaan tabel", "Reading the tables") + "</p><h2>" + L("Tabel kabupaten/kota yang sudah dibaca", "District tables read so far") + "</h2>" +
      '<p class="lead">' + L("Setiap kolom tabel diberi nama ukuran, satuan dan rincian (misalnya jenis kelamin), lalu ditautkan ke indikator nasional atlas bila mengukur hal yang sama. Nama kabupaten/kota dicocokkan dengan kode wilayah Kemendagri. Nilai kabupaten/kota ditampilkan di atlas setelah satu provinsi selesai diperiksa.", "Every table column is given its measure, unit and breakdown, then linked to the atlas national indicator when it measures the same thing. District names are matched to the Ministry of Home Affairs area codes. District values appear in the atlas once a province has been checked.") + "</p>" + prog + "</section>" +
      auditSec(D.audit) +
      (SD && SD.datasets.length ? '<section class="secx"><p class="kicker">' + L("Sumber tambahan", "Further source") + "</p><h2>" + L("Dataset data.go.id yang dipakai", "data.go.id datasets in use") + "</h2>" +
        '<p class="lead">' + L("Portal Satu Data provinsi, yang dihimpun data.go.id, menerbitkan sebagian tabel Profil Kesehatan sebagai dataset. Nilai dataset dipakai bila salinan dataset (CSV, XLSX, JSON) berisi angka yang sama; untuk indikator nasional juga bila jumlah nilai kabupaten/kota sama dengan angka provinsi di buku nasional (selisih paling banyak 10%). Buku provinsi didahulukan bila mencetak kabupaten/kota dan tahun yang sama. Setiap berkas disimpan bersama sidik sha256 berkas itu.", "Provincial One Data portals, gathered by data.go.id, publish some Health Profile tables as datasets. Their values are used when the copies of a dataset (CSV, XLSX, JSON) agree; for national indicators also when their districts add up to the province figure in the national book (at most 10% apart). The provincial book comes first where it prints the same district and year. Every file is kept with its sha256 fingerprint.") + "</p>" +
        '<div class="tw" data-hint="' + swipeHint() + '"><table class="snp sds"><thead><tr><th class="l">' + L("Penerbit", "Publisher") + '</th><th class="l">' + L("Dataset", "Dataset") + '</th><th class="l">' + L("Indikator", "Indicators") + "</th><th>" + L("Nilai", "Values") + "</th></tr></thead><tbody>" +
        SD.datasets.map((x) => '<tr><th class="l">' + esc(x[2]) + '</th><td class="l">' + (x[3] ? '<a href="' + esc(x[3]) + '" target="_blank" rel="noopener">' + esc(x[1]) + "</a>" : esc(x[1])) + '</td><td class="l">' +
          x[4].map((id) => { const j = state.byId.get(id); return '<a href="' + indHref(id) + '">' + esc(j ? trunc(indName(j), 70) : id) + "</a>"; }).join("; ") + "</td><td>" + fint(x[5]) + "</td></tr>").join("") +
        "</tbody></table></div><p class=\"src\">" + L(SD.datasets.length + " dataset, " + fint(SD.datasets.reduce((a, x) => a + x[5], 0)) + " nilai kabupaten/kota. Diperbarui " + SD.built + ".", SD.datasets.length + " datasets, " + fint(SD.datasets.reduce((a, x) => a + x[5], 0)) + " district values. Updated " + SD.built + ".") + "</p></section>" : "") +
      '<section class="secx"><p class="kicker">' + L("Batas data", "Limits of the data") + "</p><h2>" + L("Yang perlu diperhatikan", "What to keep in mind") + '</h2><ul class="err" style="margin-top:10px">' +
      [[L("Tahun edisi dan tahun data.", "Edition year and data year."), L("Sebagian provinsi menomori buku menurut tahun terbit, sehingga angka di dalam buku mengacu pada tahun sebelumnya. Tahun data dibaca dari judul dan kepala setiap tabel.", "Some provinces number the book by year of publication, so its figures refer to the year before. The data year is read from the title and header of each table.")],
       [L("Pemekaran wilayah.", "New districts."), L("Kabupaten/kota yang dibentuk kemudian tidak memiliki nilai sebelum tahun kabupaten/kota itu dibentuk, dan nilai kabupaten induk sebelum pemekaran mencakup wilayah yang lebih luas.", "Districts formed later have no values before they were formed, and the parent district's values before the split cover a larger area.")],
       [L("Buku tanpa lampiran.", "Books without annexes."), L("Sebagian berkas hanya memuat bab naratif tanpa lampiran tabel; edisi itu ditandai sebagai buku tanpa tabel kabupaten/kota.", "Some files hold only the narrative chapters without the annex tables; those editions are marked as books without district tables.")],
       // the outlier screens and the page review (23 Oct): what the reader sees is what the page prints
       [L("Nilai yang menyimpang.", "Values out of line."), L("Nilai yang jauh dari tahun-tahun lain kabupaten/kota yang sama (lima kali lipat atau seperlima dari nilai biasa; untuk jumlah kecil, selisih lebih dari 20) diperiksa ulang terhadap halaman buku sumber. Yang memang tercetak demikian tetap tampil, misalnya lonjakan kasus DBD 2024; yang salah baca (baris bergeser, kolom lain, tahun keliru) dikeluarkan. Angka ganjil yang memang tercetak tetap ditampilkan bersama nomor halaman sumber.", "Values far from the same district's other years (five times or a fifth; for small counts, more than 20 apart) were checked again against their book page. Those the page prints stay, such as the 2024 rise in dengue cases; misreads (a shifted row, another column, a wrong year) were left out. Odd numbers that the page does print are shown with their page.")],
       [L("Tahun kosong di data.go.id.", "Blank years on data.go.id."), L("Tahun dengan nilai 0 untuk seluruh kabupaten/kota dianggap tabel yang belum diisi bila ukuran indikator berupa persentase, bila tabel itu biasanya memuat angka yang lebih besar, atau bila tahun itu adalah tahun berjalan; nol untuk kejadian langka tetap tampil.", "A year in which every district is 0 is taken as a table not yet filled when the measure is a percentage, when the table usually holds larger numbers, or when it is the current year; zeros for rare events stay.")]]
        .map((k) => "<li><b>" + k[0] + "</b> " + k[1] + "</li>").join("") + "</ul></section></div>";
    const tb = $(".snx");
    if (!tb) return;
    // the header row of the books table pins under the site header: keep its height in a CSS variable (PI comment 25 Oct)
    const hdrh = () => { const h = $("#hdr"); if (h) document.documentElement.style.setProperty("--hdrh", h.offsetHeight + "px"); };
    hdrh();
    if (!window.__hdrh) { window.__hdrh = 1; window.addEventListener("resize", hdrh); }
    // the popover of a cell (PI 23 Oct: "ketika di hover terlihat detail keterangannya secara rapi; kalau di klik
    // mengarah ke lokasi downloadnya; kalau sudah di download, pop up hovernya memunculkan covernya")
    let pop = $("#snpop");
    if (!pop) { pop = document.createElement("div"); pop.id = "snpop"; pop.className = "snpop"; pop.setAttribute("role", "tooltip"); pop.hidden = true; document.body.appendChild(pop); }
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
    const popHtml = (p, y, touch) => {
      const c = cellOf(p, y), u = c[4], slot = c[6] == null ? -1 : c[6], bps = c[7] === "bps";
      const n = Math.max(0, ...Object.values(p.cells).map((x) => (x[6] == null ? -1 : x[6]))) + 1;
      const lines = [];
      if (bps) lines.push(L("Profil statistik BPS (Susenas) tingkat provinsi; tidak memuat tabel kabupaten/kota.", "BPS statistical profile (Susenas), province level; no district tables."));
      if (c[1]) lines.push(fint(c[1]) + L(" tabel kabupaten/kota, ", " district tables, ") + fint(c[2]) + L(" dibaca", " read"));
      if (c[3]) lines.push(fint(c[3]) + L(" nilai terbaca", " values read"));
      if (c[5]) lines.push("<b>" + fint(c[5]) + "</b>" + L(" nilai tampil di atlas", " values shown in the atlas"));
      const cov = slot >= 0 ? '<span class="cov" style="background-image:url(assets/covers/' + esc(p.code) + ".jpg);background-size:" + n * 96 + "px 136px;background-position:-" + slot * 96 + 'px 0" aria-hidden="true"></span>' : "";
      return '<div class="snpop-in">' + cov + '<div class="snpop-t"><p class="snpop-h">' + esc(p.name) + " · " + L("edisi ", "edition ") + y + "</p>" +
        '<p class="snpop-s"><i class="s' + (c[0] || "0") + '"></i>' + esc(SNSTATE()[c[0] || ""][0]) + "</p>" + lines.map((x) => "<p>" + x + "</p>").join("") +
        (u ? '<p class="snpop-u">' + esc(host(u)) + (touch ? ' <a href="' + esc(u) + '" target="_blank" rel="noopener">' + L("Buka lokasi unduhan", "Open the download location") + "</a>"
          : '<span>' + L("Klik untuk membuka lokasi unduhan", "Click to open the download location") + "</span>") + "</p>" : "") + "</div></div>";
    };
    let touch = false, cur = null;
    const place = (td) => {
      const r = td.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
      let x = r.right + 10, y = r.top - 8;
      if (x + w > vw - 8) x = r.left - w - 10;
      if (x < 8) { x = Math.max(8, Math.min(vw - w - 8, r.left - w / 2)); y = r.bottom + 8; }
      if (y + h > vh - 8) y = Math.max(8, vh - h - 8);
      pop.style.left = x + "px"; pop.style.top = y + "px";
    };
    const show = (td, t) => {
      const p = D.provinces[+td.getAttribute("data-pi")], y = +td.getAttribute("data-y");
      if (!p) return;
      cur = td; pop.innerHTML = popHtml(p, y, t); pop.classList.toggle("tap", !!t); pop.hidden = false; place(td);
    };
    const hide = () => { pop.hidden = true; cur = null; };
    const open = (td) => { const p = D.provinces[+td.getAttribute("data-pi")], c = p && cellOf(p, +td.getAttribute("data-y")); if (c && c[4]) window.open(c[4], "_blank", "noopener"); };
    tb.addEventListener("pointerdown", (e) => { touch = e.pointerType === "touch"; });
    tb.addEventListener("mouseover", (e) => { const td = e.target.closest && e.target.closest("td.c"); if (td && !touch) show(td, false); });
    tb.addEventListener("mouseleave", () => { if (!touch) hide(); });
    tb.addEventListener("focusin", (e) => { const td = e.target.closest && e.target.closest("td.c"); if (td) show(td, touch); });
    tb.addEventListener("focusout", (e) => { if (!pop.contains(e.relatedTarget)) setTimeout(() => { if (!pop.matches(":hover") && !touch) hide(); }, 0); });
    tb.addEventListener("click", (e) => { const td = e.target.closest && e.target.closest("td.c"); if (!td) return; if (touch) { show(td, true); return; } open(td); });
    tb.addEventListener("keydown", (e) => { const td = e.target.closest && e.target.closest("td.c"); if (td && e.key === "Enter") open(td); if (e.key === "Escape") hide(); });
    document.addEventListener("click", (e) => { if (touch && cur && !cur.contains(e.target) && !pop.contains(e.target)) hide(); });
    addEventListener("hashchange", hide, { once: true });
    addEventListener("scroll", () => { if (cur && !pop.hidden) place(cur); }, { passive: true });
  }
  function pageMethod() {
    setTitle(L("Metode", "Method"));
    const m = state.manifest, c = m.counts, s = m.steps, lang = state.lang === "en" ? 1 : 0;
    const trendRows = ["yes", "within_period", "no", "unknown"].map((k) => ({ label: trendLabel(k), value: c.by_trend[k] || 0, color: TREND[k].color }));
    const q1 = (m.qa || []).find((x) => x.sample === "qa200"), q2 = (m.qa || []).find((x) => x.sample === "qa200-v2");
    const sampleBars = (q, name) => q ? { name, items: q.items, share: q.correct_share_of_usable, ok: q.verdicts.correct || 0, bad: q.items - (q.verdicts.correct || 0) - (q.verdicts.image_unusable || 0), unusable: q.verdicts.image_unusable || 0 } : null;
    const sb = [sampleBars(q2, L("Sampel nilai terverifikasi", "Sample of verified values")), sampleBars(q1, L("Sampel pertama, semua nilai", "First sample, all values"))].filter(Boolean);
    const qaChart = barChart({ w: cw(600), rows: sb.map((x) => ({ label: x.name, value: x.share * 100, text: fpct(x.share, 1) + "%", color: "#002147" })), xTitle: L("Persen nilai yang cocok dengan halaman cetak", "Percent of values matching the printed page"), max: 100, labelW: 190, rowH: 40 });
    const verRows = [{ label: L("Terverifikasi", "Verified"), value: c.verified_values, color: "#002147" }, { label: L("Belum terverifikasi", "Not yet verified"), value: c.provisional_values, color: "#9aa6b2" }];
    const known = [
      [L("Buku pindaian dan beberapa edisi belum terverifikasi.", "Scanned books and certain editions remain unverified."), L("Nilai dalam buku 1989 sampai 2004, edisi 2013 dan 2014, serta pendamping data 2016 belum diverifikasi. Status yang sama berlaku bagi bacaan dengan tingkat keyakinan sedang atau rendah. Pada grafik, nilai tersebut ditandai dengan titik kosong; pada tabel, nilai tersebut diberi tanda. Status ini berlaku bagi " + fint(c.provisional_values) + " dari " + fint(c.reference_values) + " nilai acuan.",
        "Values in the 1989 to 2004 books, the 2013 and 2014 editions, and the 2016 data companion have not been verified. The same status applies to readings with medium or low confidence. These values appear as hollow points in charts and are flagged in tables. This status applies to " + fint(c.provisional_values) + " of " + fint(c.reference_values) + " reference values.")],
      [L("Definisi indikator dapat berbeda antarbuku.", "Indicator definitions may differ between books."), L("Pada " + fint(c.by_trend.within_period) + " indikator, garis menghubungkan titik hanya selama definisinya tetap sama. Untuk " + fint(c.by_trend.no) + " indikator, hanya satu buku yang memuat data atau definisinya berubah. Karena itu, nilai untuk indikator tersebut dibaca per tahun.",
        "For " + fint(c.by_trend.within_period) + " indicators, lines connect points only while the definition stays the same. For " + fint(c.by_trend.no) + " indicators, only one book includes data or the definition changes. Read those indicators year by year.")],
      [L("Angka untuk nilai yang sama dapat berbeda antarbuku.", "Books may report different figures for the same value."), L("Buku yang terbit kemudian mencetak ulang " + fint(c.revisions_between_books) + " nilai dengan angka yang berbeda. Atlas menggunakan angka dari cetakan terbaru, sementara dataset lengkap menyimpan semua cetakan.",
        fint(c.revisions_between_books) + " values appear in later books with different figures. The atlas uses the latest printing, while the full dataset retains every printing.")],
      [L("Periksa baris total dan persentase di atas 100%.", "Check total rows and percentages above 100%."), L("Total pada tabel sumber tidak selalu sama dengan penjumlahan baris provinsi. Persentase juga dapat melebihi 100% jika jumlah sasaran lebih kecil daripada jumlah yang dilayani. Atlas menampilkan angka sebagaimana tercetak. Periksa tabel sumber untuk setiap nilai.",
        "The total in a source table does not always equal the sum of its province rows. Percentages can also exceed 100% when the target is smaller than the number served. The atlas displays figures as printed. Check the source table for each value.")],
      [L("Cakupan wilayah dapat berubah antarbuku.", "Geographic coverage may change between books."), L("Jumlah dan susunan provinsi berubah dari waktu ke waktu, termasuk ketika provinsi baru dibentuk di Papua. Pada peta, provinsi yang tidak tercantum dalam tabel untuk tahun tertentu diberi arsiran, bukan ditampilkan sebagai nilai nol.",
        "The number and set of provinces change over time, including when new provinces are formed in Papua. On the map, a province absent from a table for a given year is hatched rather than shown with a value of zero.")],
      [L("Edisi yang belum ditemukan.", "Editions not found."), esc(m.coverage.editions_not_found.join("; ")) + "."]
    ];
    $("#main").innerHTML =
      '<div class="wrap"><div class="th"><p class="kicker">' + L("Metode", "Method") + "</p><h1>" + L("Metode digitalisasi dan harmonisasi", "Digitisation and harmonisation method") + "</h1>" +
      '<p class="lead2">' + L("Atlas mengambil data dari tabel dalam buku PDF, bukan dari basis data Kementerian. Setiap nilai mencatat buku, halaman, tabel, baris, dan kolom sumbernya. Status di bawah menjelaskan cara penggunaan setiap indikator.", "The atlas extracts data from tables in PDF books, not from a Ministry database. Each value records its source book, page, table, row, and column. The status below explains how each indicator may be used.") + "</p>" +
      '<p style="margin-top:12px"><a class="tl ar" href="#/metode/subnasional">' + L("Data subnasional: Profil Kesehatan Provinsi menurut provinsi dan tahun", "Subnational data: provincial Health Profiles by province and year") + "</a></p></div>" +
      "</div>" + deckSection(homeStats()) + '<div class="wrap">' +
      '<section class="secx" id="status" style="border-top:0"><p class="kicker">' + L("Status keterbandingan", "Comparability status") + "</p><h2>" + L("Bolehkah angka dari tahun berbeda dibandingkan?", "Can figures from different years be compared?") + "</h2>" +
      '<p class="lead">' + L("Setiap indikator memiliki satu dari empat label. Label tersebut menunjukkan apakah angka dari tahun berbeda mengukur hal yang sama dan dapat dihubungkan sebagai satu garis.", "Each indicator has one of four labels. The label shows whether figures from different years measure the same thing and can be connected by a line.") + '</p><div class="g2" style="margin-top:16px"><figure class="fig"><p class="ft2">' + L("Indikator menurut status", "Indicators by status") + '</p><div style="margin-top:10px">' +
      barChart({ w: cw(620), rows: trendRows, xTitle: L("Jumlah indikator", "Number of indicators"), labelW: 260, rowH: 34 }) + "</div></figure><div>" +
      ["yes", "within_period", "no", "unknown"].map((k) => '<div class="lrow"><span class="lad"><i style="background:' + TREND[k].color + '"></i>' + esc(trendLabel(k)) + "</span><p>" + (state.lang === "en" ? TREND[k].xen : TREND[k].xid) + "</p></div>").join("") + "</div></div></section>" +
      '<section class="secx"><p class="kicker">' + L("Ketepatan bacaan", "Reading accuracy") + "</p><h2>" + L("Seberapa sering angka cocok dengan halaman cetak", "How often a figure matches the printed page") + '</h2><p class="lead">' + acceptanceText() + '</p><div class="g2" style="margin-top:16px"><figure class="fig"><p class="ft2">' + L("Hasil dua sampel uji", "Results of two test samples") + "</p>" +
      '<p class="fs">' + L("Setiap sampel berisi 200 nilai yang dicocokkan satu per satu dengan gambar halaman cetak.", "Each sample holds 200 values checked one by one against the image of the printed page.") + '</p><div style="margin-top:10px">' + qaChart + "</div></figure>" +
      '<figure class="fig"><p class="ft2">' + L("Status nilai acuan", "Status of the reference values") + "</p><p class=\"fs\">" + L("Jumlah nilai acuan, satu per indikator, tahun, wilayah dan rincian.", "Number of reference values, one per indicator, year, area and breakdown.") + '</p><div style="margin-top:10px">' + barChart({ w: cw(600), rows: verRows, xTitle: L("Jumlah nilai", "Number of values"), labelW: 170, rowH: 40 }) + "</div></figure></div></section>" +
      '<section class="secx"><p class="kicker">' + L("Hal yang diketahui", "Known issues") + "</p><h2>" + L("Yang perlu diperiksa sebelum mengutip", "What to check before citing") + '</h2><ul class="err" style="margin-top:10px">' + known.map((k) => "<li><b>" + k[0] + "</b> " + k[1] + "</li>").join("") + "</ul></section>" +
      rkdMethod() + distMethod() +
      "</div>";
    setupDeck();
  }

  /* ------------------------------------------------------------------ charts */
  function niceTicks(min, max, n) {
    if (min === max) { const d = Math.abs(min) || 1; min -= d * 0.5; max += d * 0.5; }
    const span = max - min, step0 = span / (n || 5), mag = Math.pow(10, Math.floor(Math.log10(step0))), nm = step0 / mag;
    const step = (nm < 1.5 ? 1 : nm < 3 ? 2 : nm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, t = [];
    for (let v = lo; v <= hi + step * 1e-6; v += step) t.push(+v.toFixed(10));
    return t;
  }
  const cw = (max) => Math.max(260, Math.min(max, window.innerWidth <= 900 ? window.innerWidth - 84 : max));
  // shown on phones above a table wider than the screen (styles.css hides it elsewhere)
  const swipeHint = () => esc(L("Geser tabel ke samping \u2192", "Swipe the table sideways \u2192"));
  function trunc(s, n) { s = String(s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s; }
  function lineChart(o) {
    const small = !!o.small, w = o.w, h = o.h, narrow = w < 520;
    // direct labels at the line ends (PI 22 Oct, as on the World Bank line view) take a right margin of their own
    const labs = o.labels && !small ? o.series.map((s, k) => trunc(o.labels[k] || s.name, narrow ? 12 : 24)) : null;
    const bandLabs = o.band && o.band.length && labs ? [L("Prov. tertinggi", "Highest prov."), L("Prov. terendah", "Lowest prov.")] : [];
    const lw = labs && labs.length ? Math.min(narrow ? 96 : 200, 14 + Math.max.apply(null, labs.concat(bandLabs).map((t) => t.length)) * (narrow ? 6.2 : 6.9)) : 0;
    // on a phone the unit sits above the axis: rotated, it ran into the tick labels
    const ml = small ? 46 : narrow ? 52 : 62, mr = (small ? 12 : lw ? 10 : 20) + lw, mt = small ? 12 : narrow ? 30 : 16, mb = small ? 34 : 50;
    const pw = w - ml - mr, ph = h - mt - mb;
    const xs = [], ys = [];
    o.series.forEach((s) => s.pts.forEach((p) => { xs.push(p.x); ys.push(p.y); }));
    (o.band || []).forEach((b) => { xs.push(b.x); ys.push(b.lo, b.hi); });
    if (!xs.length) return '<p class="empty">' + L("Tidak ada titik dengan tahun untuk ditampilkan.", "No points with a year to display.") + "</p>";
    // o.xr: the year range chosen under the chart; the axis spans it even where a series has no point
    let x0 = o.xr ? o.xr[0] : Math.min.apply(null, xs), x1 = o.xr ? o.xr[1] : Math.max.apply(null, xs);
    if (x0 === x1) { x0 -= 1; x1 += 1; } else { const pad = Math.max(0.4, (x1 - x0) * 0.025); x0 -= pad; x1 += pad; }
    const ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    const zero = ymin >= 0 && ymin <= ymax * 0.7;
    const yt = niceTicks(zero ? 0 : ymin, ymax, small ? 4 : 5), y0 = yt[0], y1 = yt[yt.length - 1];
    const sx = (x) => ml + ((x - x0) / (x1 - x0)) * pw, sy = (y) => mt + ph - ((y - y0) / (y1 - y0 || 1)) * ph;
    const fs = small ? 11 : 12;
    let g = "";
    yt.forEach((v) => {
      g += '<line x1="' + ml + '" y1="' + sy(v).toFixed(1) + '" x2="' + (w - mr) + '" y2="' + sy(v).toFixed(1) + '" stroke="#e6eae8"/>' +
        '<line x1="' + (ml - 4) + '" y1="' + sy(v).toFixed(1) + '" x2="' + ml + '" y2="' + sy(v).toFixed(1) + '" stroke="#000000"/>' +
        '<text x="' + (ml - 8) + '" y="' + sy(v).toFixed(1) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + fs + '" fill="#3f4b59" text-anchor="end" dominant-baseline="middle">' + faxis(v, y1 - y0) + "</text>";
    });
    const maxTicks = Math.max(3, Math.floor(pw / (small ? 44 : 52)));
    let step = 1; [1, 2, 5, 10, 20, 25, 50].some((s) => { step = s; return (x1 - x0) / s <= maxTicks; });
    for (let t = Math.ceil(x0 / step) * step; t <= x1 + 1e-9; t += step) {
      g += '<line x1="' + sx(t).toFixed(1) + '" y1="' + (mt + ph) + '" x2="' + sx(t).toFixed(1) + '" y2="' + (mt + ph + 4) + '" stroke="#000000"/>' +
        '<text x="' + sx(t).toFixed(1) + '" y="' + (mt + ph + 17) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + fs + '" fill="#3f4b59" text-anchor="middle">' + t + "</text>";
    }
    // period labels close together share one label ("New definition periods: 2013, 2014 and 2015"; PI 27 Oct, three
    // labels a year apart printed over each other), each label takes the first row it fits in, and a label that would
    // run past the plot ends at its line instead
    const inB = (o.bounds || []).filter((b) => b.x > x0 && b.x < x1), groups = [];
    inB.forEach((b) => {
      g += '<line x1="' + sx(b.x).toFixed(1) + '" y1="' + mt + '" x2="' + sx(b.x).toFixed(1) + '" y2="' + (mt + ph) + '" stroke="#b18421" stroke-dasharray="4 4"/>';
      const last = groups[groups.length - 1];
      if (last && sx(b.x) - sx(last[0].x) < 170) last.push(b); else groups.push([b]);
    });
    if (!small && w >= 560 && groups.length <= 4) {
      const rowEnd = [];
      const andJoin = (a, w_) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " " + w_ + " " + a[a.length - 1];
      groups.forEach((gr) => {
        const labs = gr.map((b) => b.label);
        const txt = gr.length === 1 ? L("Periode definisi baru, " + labs[0], "New definition period, " + labs[0])
          : L("Periode definisi baru: " + andJoin(labs, "dan"), "New definition periods: " + andJoin(labs, "and"));
        const tw = txt.length * 6.4;
        let x = sx(gr[0].x) + 5, anchor = "start", left = x, right = x + tw;
        if (right > ml + pw) { x = sx(gr[gr.length - 1].x) - 5; anchor = "end"; left = x - tw; right = x; }
        let row = rowEnd.findIndex((e) => e < left - 8);
        if (row < 0) row = rowEnd.length;
        rowEnd[row] = right;
        g += '<text x="' + x.toFixed(1) + '" y="' + (mt + 11 + row * 14) + '" text-anchor="' + anchor + '" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="#7a4f00">' + esc(txt) + "</text>";
      });
    }
    // the province range behind the national line (PI comment 25 Oct: "kalau ada nilai provinsi, kasih range juga line
    // chart provinsi paling tinggi dan paling rendah"): each year's highest and lowest province, joined as the national
    // line is joined (by definition period where it changes), a light fill between them, every point named on hover
    if (o.band && o.band.length) {
      const bp = o.band.slice().sort((a, b) => a.x - b.x), bg = [];
      if (o.join === "all") bg.push(bp);
      else if (o.join === "seg") { const m = new Map(); bp.forEach((p) => { if (!m.has(p.seg)) m.set(p.seg, []); m.get(p.seg).push(p); }); m.forEach((v) => bg.push(v)); }
      const joined = new Set();
      bg.forEach((gr) => {
        if (gr.length < 2) return;
        gr.forEach((p) => joined.add(p));
        const hi = gr.map((p) => sx(p.x).toFixed(1) + " " + sy(p.hi).toFixed(1)), lo = gr.map((p) => sx(p.x).toFixed(1) + " " + sy(p.lo).toFixed(1));
        g += '<path d="M' + hi.join("L") + "L" + lo.slice().reverse().join("L") + 'Z" fill="#dfe6ee" fill-opacity="0.7" stroke="none"/>' +
          '<path d="M' + hi.join("L") + '" fill="none" stroke="#7d8a99" stroke-width="1.2" stroke-dasharray="5 3"/>' +
          '<path d="M' + lo.join("L") + '" fill="none" stroke="#7d8a99" stroke-width="1.2" stroke-dasharray="5 3"/>';
      });
      bp.forEach((p) => {
        if (!joined.has(p)) g += '<line x1="' + sx(p.x).toFixed(1) + '" y1="' + sy(p.hi).toFixed(1) + '" x2="' + sx(p.x).toFixed(1) + '" y2="' + sy(p.lo).toFixed(1) + '" stroke="#7d8a99" stroke-width="1.2"/>';
        g += '<circle cx="' + sx(p.x).toFixed(1) + '" cy="' + sy(p.hi).toFixed(1) + '" r="2.6" fill="#7d8a99"><title>' + esc(L("Provinsi tertinggi ", "Highest province ") + p.x + ": " + p.hiN + ", " + fval(p.hi)) + "</title></circle>" +
          '<circle cx="' + sx(p.x).toFixed(1) + '" cy="' + sy(p.lo).toFixed(1) + '" r="2.6" fill="#7d8a99"><title>' + esc(L("Provinsi terendah ", "Lowest province ") + p.x + ": " + p.loN + ", " + fval(p.lo)) + "</title></circle>";
      });
    }
    o.series.forEach((s) => {
      const pts = s.pts.slice().sort((a, b) => a.x - b.x);
      let groups = [];
      if (o.join === "all") groups = [pts];
      else if (o.join === "seg") { const m = new Map(); pts.forEach((p) => { if (!m.has(p.seg)) m.set(p.seg, []); m.get(p.seg).push(p); }); groups = Array.from(m.values()); }
      groups.forEach((gr) => { if (gr.length > 1) g += '<path d="M' + gr.map((p) => sx(p.x).toFixed(1) + " " + sy(p.y).toFixed(1)).join("L") + '" fill="none" stroke="' + s.color + '" stroke-width="1.6"/>'; });
      pts.forEach((p) => {
        g += '<circle class="pt" cx="' + sx(p.x).toFixed(1) + '" cy="' + sy(p.y).toFixed(1) + '" r="' + (small ? 3.2 : 3.8) + '" fill="' + (p.ver ? s.color : "#ffffff") + '" stroke="' + s.color + '" stroke-width="1.6" data-x="' + p.x + '" data-t="' + esc(p.tip) + '" data-c="' + s.color + '"></circle>';
      });
    });
    if (labs) {
      // each label sits in the right margin at the height of its line's last point, pushed apart when two would touch
      const fl = narrow ? 11 : 12, gap = fl + 3, lx = ml + pw + 8;
      const ls = o.series.map((s, k) => {
        if (!s.pts.length) return null;
        const p = s.pts.reduce((a, b) => (b.x > a.x ? b : a));
        return { k, px: sx(p.x), py: sy(p.y), y: sy(p.y), t: labs[k], c: s.color };
      }).filter(Boolean);
      if (bandLabs.length) {
        const e = o.band.reduce((a, b) => (b.x > a.x ? b : a));
        ls.push({ k: -1, px: sx(e.x), py: sy(e.hi), y: sy(e.hi), t: bandLabs[0], c: "#5f6b78", band: true }, { k: -2, px: sx(e.x), py: sy(e.lo), y: sy(e.lo), t: bandLabs[1], c: "#5f6b78", band: true });
      }
      ls.sort((a, b) => a.y - b.y);
      for (let j = 1; j < ls.length; j++) if (ls[j].y < ls[j - 1].y + gap) ls[j].y = ls[j - 1].y + gap;
      for (let j = ls.length - 1; j >= 0; j--) { const lim = j === ls.length - 1 ? mt + ph : ls[j + 1].y - gap; if (ls[j].y > lim) ls[j].y = lim; }
      ls.forEach((l) => {
        if (lx - l.px > 14 || Math.abs(l.y - l.py) > 2) g += '<path d="M' + (l.px + 5).toFixed(1) + " " + l.py.toFixed(1) + "L" + (lx - 3).toFixed(1) + " " + l.y.toFixed(1) + '" fill="none" stroke="' + l.c + '" stroke-width="1" stroke-dasharray="2 2"/>';
        g += '<text x="' + lx + '" y="' + l.y.toFixed(1) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + fl + '" font-weight="700" fill="' + l.c + '" dominant-baseline="middle"><title>' + esc(l.band ? l.t : o.series[l.k].name) + "</title>" + esc(l.t) + "</text>";
      });
    }
    g += '<line x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + ph) + '" stroke="#000000" stroke-width="1.2"/><line x1="' + ml + '" y1="' + (mt + ph) + '" x2="' + (w - mr) + '" y2="' + (mt + ph) + '" stroke="#000000" stroke-width="1.2"/>';
    g += '<text x="' + (ml + pw / 2) + '" y="' + (h - 6) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + fs + '" fill="#3f4b59" text-anchor="middle">' + esc(o.xTitle || L("Tahun pengamatan", "Year of observation")) + "</text>";
    if (o.unit) g += narrow && !small ? '<text x="4" y="13" font-family="Arial,Helvetica,sans-serif" font-size="' + fs + '" fill="#3f4b59">' + esc(trunc(o.unit, 40)) + "</text>"
      : '<text transform="translate(12 ' + (mt + ph / 2) + ') rotate(-90)" font-family="Arial,Helvetica,sans-serif" font-size="' + fs + '" fill="#3f4b59" text-anchor="middle">' + esc(trunc(o.unit, 34)) + "</text>";
    g += '<line class="hguide" x1="0" x2="0" y1="' + mt + '" y2="' + (mt + ph) + '" stroke="#162230" stroke-width="1" visibility="hidden"/>';
    return '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "") + '" class="chart hov" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:' + w + 'px">' + g + "</svg>";
  }
  /* hover or tap on a line chart (PI comment 21 Oct): a guide at the nearest year and a box with each drawn series'
     value there, its book and page */
  // a province under the pointer shows its name and value (PI comment 22 Oct)
  function onMapHover(e) {
    const p = e.target.closest && e.target.closest(".pmap path[data-t]");
    let tip = $("#mtip");
    if (!p) { if (tip) tip.hidden = true; return; }
    if (!tip) { tip = document.createElement("div"); tip.id = "mtip"; tip.className = "ctip"; tip.setAttribute("role", "status"); document.body.appendChild(tip); }
    tip.textContent = p.getAttribute("data-t");
    tip.hidden = false;
    const x = e.pageX + 14, w = tip.offsetWidth;
    tip.style.left = Math.min(x, window.scrollX + document.documentElement.clientWidth - w - 8) + "px";
    tip.style.top = e.pageY + 16 + "px";
  }
  function onChartHover(e) {
    const svg = e.target.closest && e.target.closest("svg.chart.hov");
    let tip = $("#ctip");
    if (!svg) { if (tip) tip.hidden = true; $$("svg.chart.hov .hguide").forEach((l) => l.setAttribute("visibility", "hidden")); return; }
    const pts = Array.from(svg.querySelectorAll(".pt"));  // points of a line, or the year bars of the Batang tab
    if (!pts.length) return;
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    const px = (e.clientX - ctm.e) / ctm.a, cxOf = (c) => +(c.getAttribute("cx") || c.getAttribute("data-cx"));
    let best = null, bd = Infinity;
    pts.forEach((c) => { const d = Math.abs(cxOf(c) - px); if (d < bd) { bd = d; best = c; } });
    const x = best.getAttribute("data-x"), at = pts.filter((c) => c.getAttribute("data-x") === x);
    const gl = svg.querySelector(".hguide");
    if (gl) { gl.setAttribute("x1", cxOf(best)); gl.setAttribute("x2", cxOf(best)); gl.setAttribute("visibility", "visible"); }
    if (!tip) { tip = document.createElement("div"); tip.id = "ctip"; tip.className = "ctip"; tip.setAttribute("role", "status"); document.body.appendChild(tip); }
    tip.innerHTML = "<b>" + esc(x) + "</b>" + at.map((c) => '<span><i style="background:' + c.getAttribute("data-c") + '"></i>' + esc(c.getAttribute("data-t").replace(/ · \d{4}: /, ": ")) + "</span>").join("");
    tip.hidden = false;
    const r = tip.getBoundingClientRect(), vw = window.innerWidth;
    let left = e.clientX + 14, top = e.clientY + 14;
    if (left + r.width > vw - 8) left = Math.max(8, e.clientX - r.width - 14);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, e.clientY - r.height - 14);
    tip.style.left = left + window.scrollX + "px"; tip.style.top = top + window.scrollY + "px";
  }
  function barChart(o) {
    const rows = o.rows.filter((r) => !r.hidden), w = o.w, narrow = w < 480;  // phone: label above its bar
    const ml = narrow ? 2 : Math.min(o.labelW || 150, w * 0.42), mr = o.mr ? (narrow ? Math.min(o.mr, 100) : o.mr) : (narrow ? 58 : 64), mt = 8, mb = 46, rh = (o.rowH || 26) + (narrow ? 16 : 0), h = mt + rows.length * rh + mb;
    const pw = w - ml - mr, max = o.max || Math.max.apply(null, rows.map((r) => r.value).concat([1]));
    const tk = niceTicks(0, max, Math.max(2, Math.min(o.max ? 5 : 4, Math.floor(pw / 62)))), top = o.max || tk[tk.length - 1];
    const sx = (v) => ml + (v / top) * pw;
    let g = "";
    tk.filter((v) => v <= top + 1e-9).forEach((v) => {
      g += '<line x1="' + sx(v).toFixed(1) + '" y1="' + mt + '" x2="' + sx(v).toFixed(1) + '" y2="' + (mt + rows.length * rh) + '" stroke="#e6eae8"/>' +
        '<line x1="' + sx(v).toFixed(1) + '" y1="' + (mt + rows.length * rh) + '" x2="' + sx(v).toFixed(1) + '" y2="' + (mt + rows.length * rh + 4) + '" stroke="#000000"/>' +
        '<text x="' + sx(v).toFixed(1) + '" y="' + (mt + rows.length * rh + 17) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59" text-anchor="middle">' + faxis(v, top) + "</text>";
    });
    rows.forEach((r, k) => {
      const y = mt + k * rh, bh = narrow ? 14 : rh * 0.62, by = narrow ? y + 18 : y + (rh - bh) / 2, cy = by + bh / 2;
      g += (narrow ? '<text x="' + (ml + 4) + '" y="' + (y + 11) + '" font-family="Arial,Helvetica,sans-serif" font-size="12.5" fill="#3f4b59"><title>' + esc(r.label) + "</title>" + esc(trunc(r.label, Math.floor((w - 8) / 6.6))) + "</text>"
        : '<text x="' + (ml - 8) + '" y="' + (y + rh / 2) + '" font-family="Arial,Helvetica,sans-serif" font-size="12.5" fill="#3f4b59" text-anchor="end" dominant-baseline="middle"><title>' + esc(r.label) + "</title>" + esc(trunc(r.label, Math.floor(ml / 6.6))) + "</text>") +
        '<rect x="' + ml + '" y="' + by.toFixed(1) + '" width="' + Math.max(1, sx(r.value) - ml).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + (r.color || "#002147") + '"><title>' + esc(r.label + ": " + (r.text || fint(r.value))) + "</title></rect>" +
        '<text x="' + (sx(r.value) + 6).toFixed(1) + '" y="' + cy.toFixed(1) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#162230" dominant-baseline="middle">' + esc(r.text || fint(r.value)) + "</text>";
    });
    g += '<line x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + rows.length * rh) + '" stroke="#000000" stroke-width="1.2"/><line x1="' + ml + '" y1="' + (mt + rows.length * rh) + '" x2="' + (w - mr + 20) + '" y2="' + (mt + rows.length * rh) + '" stroke="#000000" stroke-width="1.2"/>';
    if (o.xTitle) g += '<text x="' + (narrow ? w / 2 : ml + pw / 2) + '" y="' + (h - 6) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59" text-anchor="middle">' + esc(o.xTitle) + "</text>";
    return '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || o.xTitle || "") + '" class="chart" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:' + w + 'px">' + g + "</svg>";
  }
  /* one column per year of observation (the Batang tab); the axis runs over every year, so a year without a value
     stays an empty slot instead of closing up */
  function colChart(o) {
    const w = o.w, h = o.h, pts = o.pts.slice().sort((a, b) => a.x - b.x);
    if (!pts.length) return '<p class="empty">' + L("Tidak ada nilai dengan tahun untuk ditampilkan.", "No values with a year to display.") + "</p>";
    const ml = 62, mr = 16, mt = 16, mb = 50, pw = w - ml - mr, ph = h - mt - mb;
    const x0 = o.xr ? o.xr[0] : pts[0].x, x1 = o.xr ? o.xr[1] : pts[pts.length - 1].x, n = x1 - x0 + 1;
    const bw = Math.max(2, Math.min(40, (pw / n) * 0.7)), cx = (x) => ml + ((x - x0 + 0.5) / n) * pw;
    const ys = pts.map((p) => p.y), yt = niceTicks(Math.min(0, Math.min.apply(null, ys)), Math.max(0, Math.max.apply(null, ys)), 5), y0 = yt[0], y1 = yt[yt.length - 1];
    const sy = (y) => mt + ph - ((y - y0) / (y1 - y0 || 1)) * ph, base = sy(0);
    let g = "";
    yt.forEach((v) => {
      g += '<line x1="' + ml + '" y1="' + sy(v).toFixed(1) + '" x2="' + (w - mr) + '" y2="' + sy(v).toFixed(1) + '" stroke="#e6eae8"/>' +
        '<line x1="' + (ml - 4) + '" y1="' + sy(v).toFixed(1) + '" x2="' + ml + '" y2="' + sy(v).toFixed(1) + '" stroke="#000000"/>' +
        '<text x="' + (ml - 8) + '" y="' + sy(v).toFixed(1) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59" text-anchor="end" dominant-baseline="middle">' + faxis(v, y1 - y0) + "</text>";
    });
    const maxTicks = Math.max(3, Math.floor(pw / 52));
    let step = 1; [1, 2, 5, 10, 20, 25, 50].some((s) => { step = s; return n / s <= maxTicks; });
    for (let t = Math.ceil(x0 / step) * step; t <= x1; t += step) {
      g += '<line x1="' + cx(t).toFixed(1) + '" y1="' + (mt + ph) + '" x2="' + cx(t).toFixed(1) + '" y2="' + (mt + ph + 4) + '" stroke="#000000"/>' +
        '<text x="' + cx(t).toFixed(1) + '" y="' + (mt + ph + 17) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59" text-anchor="middle">' + t + "</text>";
    }
    pts.forEach((p) => {
      const y = sy(p.y), c = p.ver ? "#002147" : "#9aa6b2";
      g += '<rect class="pt" x="' + (cx(p.x) - bw / 2).toFixed(1) + '" y="' + Math.min(y, base).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(base - y)).toFixed(1) + '" fill="' + c + '" data-x="' + p.x + '" data-cx="' + cx(p.x).toFixed(1) + '" data-t="' + esc(p.tip) + '" data-c="' + c + '"></rect>';
    });
    if (y0 < 0) g += '<line x1="' + ml + '" y1="' + base.toFixed(1) + '" x2="' + (w - mr) + '" y2="' + base.toFixed(1) + '" stroke="#000000" stroke-width="1"/>';
    g += '<line x1="' + ml + '" y1="' + mt + '" x2="' + ml + '" y2="' + (mt + ph) + '" stroke="#000000" stroke-width="1.2"/><line x1="' + ml + '" y1="' + (mt + ph) + '" x2="' + (w - mr) + '" y2="' + (mt + ph) + '" stroke="#000000" stroke-width="1.2"/>';
    g += '<text x="' + (ml + pw / 2) + '" y="' + (h - 6) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59" text-anchor="middle">' + esc(L("Tahun pengamatan", "Year of observation")) + "</text>";
    if (o.unit) g += '<text transform="translate(12 ' + (mt + ph / 2) + ') rotate(-90)" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59" text-anchor="middle">' + esc(trunc(o.unit, 34)) + "</text>";
    g += '<line class="hguide" x1="0" x2="0" y1="' + mt + '" y2="' + (mt + ph) + '" stroke="#162230" stroke-width="1" visibility="hidden"/>';
    return '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(o.aria || "") + '" class="chart hov" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;max-width:' + w + 'px">' + g + "</svg>";
  }
  /* a small trend glyph for a table row or a related indicator: the row's own value scale on a shared year axis, a gold
     dot on the year the row reports; joined like the main chart (never across a definition change) */
  function sparkSvg(pts, mark, w, h, xr, join) {
    if (!pts.length) return "";
    pts = pts.slice().sort((a, b) => a.x - b.x);
    const x0 = xr ? xr[0] : pts[0].x, x1 = xr ? xr[1] : pts[pts.length - 1].x;
    let y0 = Math.min.apply(null, pts.map((p) => p.y)), y1 = Math.max.apply(null, pts.map((p) => p.y));
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const l = 3, r = 4, t = 3, b = 4;
    const sx = (x) => l + (x1 > x0 ? ((x - x0) / (x1 - x0)) * (w - l - r) : (w - l - r) / 2), sy = (y) => t + (1 - (y - y0) / (y1 - y0)) * (h - t - b);
    let s = '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true" focusable="false"><path d="M0.5 0V' + (h - 0.5) + "H" + w + '" fill="none" stroke="#000000" stroke-width="1"/>';
    let groups = pts.map((p) => [p]);
    if (join === "all") groups = [pts];
    else if (join === "seg") { const m = new Map(); pts.forEach((p) => { if (!m.has(p.seg)) m.set(p.seg, []); m.get(p.seg).push(p); }); groups = Array.from(m.values()); }
    groups.forEach((gr) => {
      s += gr.length > 1 ? '<path d="M' + gr.map((p) => sx(p.x).toFixed(1) + " " + sy(p.y).toFixed(1)).join("L") + '" fill="none" stroke="#002147" stroke-width="1.3"/>'
        : '<circle cx="' + sx(gr[0].x).toFixed(1) + '" cy="' + sy(gr[0].y).toFixed(1) + '" r="1.7" fill="#002147"/>';
    });
    const m = pts.find((p) => p.x === mark);
    if (m) s += '<circle cx="' + sx(m.x).toFixed(1) + '" cy="' + sy(m.y).toFixed(1) + '" r="2.8" fill="#b18421" stroke="#ffffff" stroke-width="1"/>';
    return s + "</svg>";
  }

  /* ------------------------------------------------------------------ indicator data model */
  const joinMode = (i) => (i.trend === "yes" ? "all" : i.trend === "within_period" ? "seg" : "none");
  function periodBounds(i) {
    if (i.trend !== "within_period") return [];
    const f = Array.from(new Set((i.periods || []).map((p) => p.from))).sort((a, b) => a - b).slice(1);
    return f.map((y) => ({ x: y - 0.5, label: String(y) }));
  }
  const regionOf = (r) => (r.geo === 0 ? "N" : r.geo === 1 ? "P" + r.prov : "O");
  function regionLabel(g, key) { return key === "N" ? L("Nasional", "National") : key === "O" ? L("Baris lain (menurut kategori)", "Other rows (by category)") : g.F.provinces[+key.slice(1)]; }
  function regionList(g) {
    if (g._regions) return g._regions;
    const m = new Map();
    g.rows.forEach((r) => { const k = regionOf(r); m.set(k, (m.get(k) || 0) + (r.y != null ? 1 : 0)); });
    const out = Array.from(m.entries()).map(([key, n]) => ({ key, n, label: regionLabel(g, key) }));
    out.sort((a, b) => (a.key === "N" ? -1 : b.key === "N" ? 1 : a.key === "O" ? 1 : b.key === "O" ? -1 : a.label.localeCompare(b.label, "id")));
    g._regions = out; return out;
  }
  /* a breakdown may carry the observation year as a dimension; the year is the x axis, not part of the series identity */
  function sidOf(F, bd) {
    if (bd < 0) return -1;
    if (!F._sm) { F._sm = new Map(); F._sstr = []; }
    if (F._sm.has(bd)) return F._sm.get(bd);
    let str = "";
    try { const o = JSON.parse(F.breakdowns[bd]); delete o.year; str = Object.keys(o).length ? JSON.stringify(o) : ""; } catch (e) { str = F.breakdowns[bd]; }
    let id = -1;
    if (str) { id = F._sstr.indexOf(str); if (id < 0) { id = F._sstr.length; F._sstr.push(str); } }
    F._sm.set(bd, id);
    return id;
  }
  function seriesLabel(F, cat, sid) {
    const parts = [];
    if (cat >= 0) parts.push(F.categories[cat]);
    if (sid >= 0) { try { Object.values(JSON.parse(F._sstr[sid])).forEach((v) => parts.push(v)); } catch (e) { parts.push(F._sstr[sid]); } }
    return parts.join(" \u00b7 ") || L("Nilai utama", "Main value");
  }
  function seriesOf(g, region, geoOnly) {
    const cache = g._ser || (g._ser = new Map()), ck = region + "|" + (geoOnly || "");
    if (cache.has(ck)) return cache.get(ck);
    const m = new Map();
    g.rows.forEach((r) => {
      if (region && regionOf(r) !== region) return;
      if (geoOnly != null && r.geo !== geoOnly) return;
      const sid = sidOf(g.F, r.bd), k = r.cat + "." + sid;
      let s = m.get(k);
      if (!s) { s = { key: k, label: seriesLabel(g.F, r.cat, sid), rows: [], n: 0 }; m.set(k, s); }
      s.rows.push(r); if (r.y != null) s.n++;
    });
    const arr = Array.from(m.values()).filter((s) => s.n > 0);
    arr.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, "id"));
    cache.set(ck, arr); return arr;
  }
  // the series a page opens on: the overall one when it has at least half the years of the longest (26 Oct: the poverty
  // line opened on its rural series, 21 years, while the headline gave the overall national value, 11 years; 27 Oct:
  // TT/Td in pregnant women has 3 overall years and 30 years by dose, and must open on the long series), else the longest
  function firstSeries(ser) {
    const ov = ser.find((s) => s.label === L("Nilai utama", "Main value"));
    if (ov && ov.n >= Math.max(Math.min(3, ser[0].n), ser[0].n / 2)) return ov;
    // not a residual category when a named one runs almost as long (27 Oct, ENV-01-108 opened on "lainnya")
    const resid = (s) => /(^|\u00b7 )(lain-lain|lainnya|lain|other|others|tidak tahu)$/i.test(s.label);
    // among series nearly as long as the longest, the order was alphabetical (28 Oct: diabetes type opened on "DM gestasional",
    // 2.6%, smoking status on one age band): fewest dimensions first, a named category before a residual one, then the
    // largest latest value, which is the main category of a distribution
    const tie = ser.filter((s) => s.n >= 0.8 * ser[0].n);
    if (tie.length > 1) {
      const dims = (s) => s.label.split(" \u00b7 ").length;
      const last = (s) => { let y = -Infinity, v = -Infinity; s.rows.forEach((r) => { if (r.y != null && r.v != null && r.y >= y) { y = r.y; v = r.v; } }); return v; };
      return tie.slice().sort((x, z) => resid(x) - resid(z) || dims(x) - dims(z) || last(z) - last(x))[0];
    }
    return resid(ser[0]) ? ser.find((s) => !resid(s) && s.n >= 0.8 * ser[0].n) || ser[0] : ser[0];
  }
  function bookOf(g, r) {
    const t = g.F.tables[r.tab] || [], b = state.bookBySource.get(t[1]);
    return { title: b ? b.title : t[1], year: t[2], page: t[3], table: t[4] || "", source: t[1] };
  }
  function toSeries(g, s, color, i) {
    const pts = [];
    s.rows.forEach((r) => {
      if (r.y == null || r.v == null) return;
      const b = bookOf(g, r);
      pts.push({ x: r.y, y: r.v, ver: r.ver, seg: r.per, tip: s.label + " · " + r.y + ": " + fval(r.v) + (i && i.unit ? " " + i.unit : "") + " · " + b.title + (b.page ? ", " + L("hlm. ", "p. ") + b.page : "") + (r.ver ? "" : " · " + L("belum terverifikasi", "not yet verified")) });
    });
    return { name: s.label, key: s.key, color, pts };
  }
  function defaultView(i, g) {
    const regs = regionList(g).filter((r) => r.n > 0);
    if (!regs.length) return null;
    let region = regs.find((r) => r.key === "N") ? "N" : null;
    if (!region) { const p = regs.filter((r) => r.key[0] === "P").sort((a, b) => b.n - a.n)[0]; region = p ? p.key : regs[0].key; }
    const ser = seriesOf(g, region);
    return { region, series: ser.slice(0, 1).map((s, k) => toSeries(g, s, PALETTE[k], i)) };
  }
  function allRowsCsv(i, g, rows) {
    const q = (v) => { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const head = ["kode_indikator", "indikator", "tahun_pengamatan", "wilayah", "kategori", "rincian", "nilai", "satuan", "status_verifikasi", "buku", "tahun_buku", "halaman", "tabel", "baris", "kolom", "catatan"];
    const lines = [head.join(",")];
    rows.forEach((r) => {
      const b = bookOf(g, r);
      lines.push([i.id, i.name_id, r.y == null ? "" : r.y, regionLabel(g, regionOf(r)), r.cat >= 0 ? g.F.categories[r.cat] : "", r.bd >= 0 ? g.F.breakdowns[r.bd] : "", r.v == null ? "" : r.v, i.unit, r.ver ? "terverifikasi" : "belum terverifikasi", b.title, b.year, b.page, b.table, r.row, r.col, g.F.notes[r.note] || ""].map(q).join(","));
    });
    return "﻿" + lines.join("\n") + "\n";
  }
  // the district values of an indicator (district-only indicators have nothing else): one row per district, year and
  // subgroup, with the status of the check and the book page or data.go.id dataset
  function districtCsv(i, D) {
    const q = (v) => { v = v == null ? "" : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const ST = { v: "terverifikasi", s: "terverifikasi, tahun digeser", c: "konsisten", u: "belum diperiksa", a: "buku provinsi berbeda dari buku nasional", f: "satuan disesuaikan", r: "dipindah", g: "data.go.id", t: "jumlah sama dengan total provinsi", o: "tanpa pembanding", k: "data administratif SI-SDMK" };
    const lines = [["kode_indikator", "indikator", "tahun", "kode_kabkota", "kabupaten_kota", "provinsi", "rincian", "nilai", "satuan", "status", "sumber", "halaman_atau_baris"].join(",")];
    D.rows.forEach((r) => {
      const sid = D.src[r[3]];
      lines.push([i.id, i.name_id, r[0], D.d[r[1]][0], D.d[r[1]][1], D.d[r[1]][2], r.length > 6 && D.b ? D.b[r[6]] : "", r[2], i.unit, ST[r[5]] || r[5], srcName(sid, D), r[4]].map(q).join(","));
    });
    return "\ufeff" + lines.join("\n") + "\n";
  }
  async function csvIndicator(id, which) {
    if (!canDl()) { openAccess(); return; }
    const i = state.byId.get(id);
    const g = await indicatorRows(i);
    if (i.district_only || which === "kab") {
      const D = g.F.district && g.F.district[i.id];
      if (D) { saveBlob(districtCsv(i, D), "profil-kesehatan_" + id + "_kabupaten-kota.csv"); countDl(id, "kab"); }
      return;
    }
    let rows = g.rows;
    const V = state.V;
    if (which && V && V.i === i) rows = which === "series" ? currentSeriesRows() : which === "prov" ? currentProvRows() : which === "view" ? currentViewRows() : g.rows;
    saveBlob(allRowsCsv(i, g, rows), "profil-kesehatan_" + id + (which && which !== "all" ? "_" + which : "") + ".csv");
    countDl(id, which || "all");
  }
  // every CSV download is counted on the data server for the usage monitor (PI 25 Oct: "kasih pemantau"); the file is
  // built in the browser, so without this the server never sees it. A failed count never blocks the download.
  function countDl(id, kind) {
    try { fetch(API + "dl", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ind: id, kind: kind }), keepalive: true }).catch(() => {}); } catch (e) { /* counting is best effort */ }
  }
  function copyText(text, msg) {
    const done = () => toast(msg || L("Disalin.", "Copied."));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); done();
  }
  let toastT;
  function toast(msg) {
    let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.className = "on"; clearTimeout(toastT); toastT = setTimeout(() => { t.className = ""; }, 2200);
  }

  /* Profil and Riskesdas indicators of the same concept point to each other; they are never one series (a survey
     estimate and an administrative count have different denominators). In the sidebar since 22 Oct, each with a small
     national sparkline (filled by fillRelatedSparks; related indicators share the topic file already loaded) */
  function relatedBlock(i) {
    const rel = (i.related || []).map((id) => state.byId.get(id)).filter(Boolean);
    if (!rel.length) return "";
    const head = isRkd(i) ? L("Indikator Profil Kesehatan yang sepadan", "Matching Profil Kesehatan indicators") : L("Hasil survei " + SURV() + " yang sepadan", "Matching " + SURV() + " survey results");
    return '<div class="rail relr"><h3>' + head + '</h3><ul class="rlist">' + rel.map((r) => '<li><a href="' + indHref(r.id) + '"><span class="rn">' + esc(indName(r)) + '</span><span class="ry">' + esc(yearsLabel(r)) + '</span><span class="rspark" data-id="' + esc(r.id) + '"></span></a></li>').join("") + "</ul>" +
      '<p class="src">' + L("Ditampilkan terpisah: survei mengukur penduduk, Profil mencatat laporan program.", "Shown apart: the survey measures the population, the Profil records programme reports.") + "</p></div>";
  }
  // the national series of the related indicators arrive with this indicator's values (related_spark), so the
  // sidebar does not count against the viewer's daily limit
  function fillRelatedSparks() {
    const V = state.V, sp = (V && V.g && V.g.F.related_spark) || {};
    for (const el of $$(".rspark[data-id]")) {
      const id = el.getAttribute("data-id"), j = state.byId.get(id), raw = sp[id];
      if (!j || !raw || raw.length < 2 || !el.isConnected) continue;
      const pts = raw.map((p) => ({ x: p[0], y: p[1], ver: 1, seg: 0 }));
      el.innerHTML = sparkSvg(pts, Math.max.apply(null, pts.map((p) => p.x)), 64, 22, null, joinMode(j));
    }
  }
  /* ------------------------------------------------------------------ INDICATOR PAGE */
  const dd = (k, v) => (v ? "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>" : "");
  async function pageIndicator(r) {
    const id = r.parts[1], i = state.byId.get(id), lang = state.lang === "en" ? 1 : 0;
    state.V = null;
    const into = !i && (state.catalog.aliases || {})[id];
    // merged into another indicator: the link keeps its tab and province (27 Oct: an old district-tab link opened the
    // national chart)
    if (into) { const qs = r.q.toString(); location.replace(indHref(into, qs)); return; }
    if (!i) {
      setTitle(L("Indikator tidak ditemukan", "Indicator not found"));
      $("#main").innerHTML = '<div class="wrap"><nav class="crumb" style="padding-top:18px"><a href="#/telusuri">' + L("Telusuri", "Browse") + '</a></nav><div class="warn" style="margin:30px 0"><b>' + L("Indikator tidak ditemukan.", "Indicator not found.") + "</b> " + L("Kode ", "The code ") + esc(id || "") + L(" tidak ada di katalog.", " is not in the catalogue.") + ' <a href="#/telusuri">' + L("Telusuri indikator", "Browse indicators") + "</a></div></div>";
      return;
    }
    // the indicator page (23 Nov): the page's own title stays for search engines; its metadata, written into the page by
    // the build (definition, national value and series, availability, questions, citation), moves into the Metadata tab
    const PG = PATH_ID && id === PATH_ID, meta = PG && (r.meta || !i.n);
    if (PG && state.meta === undefined) { state.meta = $("#pkmeta"); if (state.meta) state.meta.remove(); }
    if (!PG || state.lang === "en") setTitle(indName(i));
    state._pload = null;
    const t = i._topic, def = (state.lang === "en" ? i.def_en : i.def_id) || "";
    const periods = periodsHtml(i);
    const nm2 = indName2(i);
    // page order (PI comments 21 Oct): definition, then the chart card with the breakdowns and downloads beside it and
    // the area table under it, then citation, quality note and the provenance table across the full width
    $("#main").innerHTML =
      '<div class="wrap"><nav class="crumb" aria-label="' + L("Lokasi", "Breadcrumb") + '" style="padding-top:18px"><a href="#/telusuri">' + L("Telusuri", "Browse") + "</a><span>/</span><a href=\"" + (PAGES ? "tema/" + encodeURIComponent(i.topic) + "/" : hashFor("/jelajah", { t: i.topic })) + '">' + esc(topicLabel(t)) + "</a><span>/</span>" +
      (subOf(i) ? '<a href="' + (PAGES ? "tema/" + encodeURIComponent(i.topic) + "/" + encodeURIComponent(String(i.sub).split("/").pop()) + "/" : hashFor("/jelajah", { t: i.topic, u: i.sub })) + '">' + esc(state.lang === "en" ? subOf(i).label_en : subOf(i).label_id) + "</a><span>/</span>" : "") + "<span>" + esc(trunc(indName(i), 60)) + "</span></nav>" +
      '<div class="ahead"><div><p class="kicker">' + (isRkd(i) ? survOf(i) + " · " : "") + L("Indikator", "Indicator") + " · " + esc(topicLabel(t)) + (IPOO[i.ipoo] ? " · " + IPOO[i.ipoo][lang] : "") + (i.district_only ? " · " + L("kabupaten/kota", "districts") : "") + "</p><h1>" + esc(indName(i)) + "</h1>" + (nm2 ? '<p class="sub" lang="' + (state.lang === "en" ? "id" : "en") + '">' + esc(nm2) + "</p>" : "") +
      // the comparability status lives in the definition and in the change box, not under the title (PI comment 22 Oct)
      '<div class="chips"><span class="tag">' + MEASURE[i.measure][lang] + "</span>" + (i.unit ? '<span class="tag">' + esc(i.unit) + "</span>" : "") +
      '<span class="tag">' + (i.district_only ? (i._nb ? i._nb + " " + bookWord(i, i._nb) + " · " : "") + (i.district_only.data_go_id ? "data.go.id · " : "") + fint(i.n) + " " + L("nilai kabupaten/kota", "district values")
        : i.n ? i._nb + " " + bookWord(i, i._nb) + " · " + fint(i.n) + " " + L("nilai", "values") : L("belum ada nilai angka", "no numeric values yet")) + "</span>" + srcChip(i) + "</div>" + msetHtml(i) + "</div>" +
      "</div>" +
      (PG ? '<div class="ptabs" role="tablist" aria-label="' + L("Isi halaman indikator", "Contents of the indicator page") + '">' +
        [["data", L("Data", "Data")], ["meta", L("Metadata", "Metadata")]].map(([k, lab]) => '<button type="button" role="tab" id="pt-' + k + '" data-a="ptab" data-k="' + k +
          '" aria-controls="p' + k + '" aria-selected="' + ((k === "meta") === meta) + '" tabindex="' + ((k === "meta") === meta ? 0 : -1) + '">' + lab + "</button>").join("") + "</div>" +
        '<div id="pdata" role="tabpanel" aria-labelledby="pt-data"' + (meta ? " hidden" : "") + ">" : "") +
      '<div id="hl"></div>' +
      '<div class="lay ilay"><div id="viz">' + (i.n ? '<p class="loading">' + L("Memuat nilai...", "Loading the values...") + "</p>" : '<div class="note"><b>' + L("Belum ada nilai angka.", "No numeric values yet.") + "</b> " + L("Katalog memuat definisi indikator ini, tetapi belum ada nilai angka yang terbaca dari buku.", "The catalogue holds this indicator's definition, but no numeric value has been read from the books yet.") + "</div>") + "</div>" +
      '<aside id="rail" aria-label="' + L("Rincian, indikator terkait dan unduhan", "Breakdowns, related indicators and downloads") + '">' + railHtml(i) + "</aside>" +
      '<section id="atab" class="atab" aria-label="' + L("Nilai menurut wilayah", "Values by area") + '"></section></div>' +
      '<div id="vbot">' + bottomHtml(i) + "</div>" +
      (PG ? '</div><div id="pmeta" class="sp" role="tabpanel" aria-labelledby="pt-meta"' + (meta ? "" : " hidden") + "></div>" : "") + "</div>";
    if (PG && state.meta) $("#pmeta").appendChild(state.meta);
    if (!i.n) return;
    const load = async () => {
      try {
        const g = await indicatorRows(i);
        if (parseHash().parts[0] !== "indikator") return;
        initView(i, g, r.q);
        renderViz();
        fillRelatedSparks();
      } catch (e) {
        const v = $("#viz"); if (v) v.innerHTML = loadErr(e, '<div class="warn"><b>' + L("Nilai tidak dapat dimuat.", "The values could not be loaded.") + "</b> " + esc(e.message) + "</div>");
      }
    };
    // opened on the Metadata tab: the values (and a count against the daily limit) wait until the Data tab is opened
    if (meta) { state._pload = load; return; }
    await load();
  }
  // the two tabs of the indicator page: Data (chart, map, tables) and Metadata (the page written by the build)
  function setPtab(k) {
    const d = $("#pdata"), m = $("#pmeta");
    if (!d || !m) return;
    d.hidden = k !== "data"; m.hidden = k !== "meta";
    $$(".ptabs [role=tab]").forEach((b) => { const on = b.getAttribute("data-k") === k; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
    // the address follows the tab: "#metadata", or the view the Data tab had (#tab=map...)
    if (k === "meta") { if (location.hash !== "#metadata") state._vq = location.hash; history.replaceState(null, "", location.pathname + location.search + "#metadata"); }
    else history.replaceState(null, "", location.pathname + location.search + (state._vq || ""));
    if (k === "data") { if (state._pload) { const f = state._pload; state._pload = null; f(); } else if (state.V) drawCharts(); }
  }
  function initView(i, g, q) {
    const regs = regionList(g).filter((r) => r.n > 0);
    const dv = defaultView(i, g);
    const V = { i, g, region: dv ? dv.region : "N", sel: [], pk: "", py: "", psort: "v", pdir: -1, nvals: 12, chipq: "", chipsAll: false, tab: "", yr: null, bmode: "bd" };
    V.years = Array.from(new Set(g.rows.filter((r) => r.y != null && r.v != null).map((r) => r.y))).sort((a, b) => a - b);
    V.single = V.years.length === 1;
    V.hasProv = seriesOf(g, null, 1).length > 0;
    const rq = q.get("r"); if (rq && regs.some((r) => r.key === rq)) V.region = rq;
    const cq = (q.get("c") || "").split(",").filter((k) => k !== "O" && regs.some((r) => r.key === k));
    if (cq.length > 1) V.cmp = cq.slice(0, 8);
    const ser = seriesOf(g, V.region);
    const sq = (q.get("s") || "").split(",").filter((k) => ser.some((s) => s.key === k));
    V.sel = sq.length ? sq.slice(0, 6) : ser.length ? [firstSeries(ser).key] : [];
    V.pk = q.get("pk") || ""; V.py = q.get("py") || "";
    // the picker on Home links with v=trend or v=geo: open the line or the map
    V.tab = q.get("tab") || ({ geo: "map", trend: "line" })[q.get("v")] || "";
    // a region page (wilayah/, 24 Oct) links an indicator with its province: open the district view of that province
    const kpq = q.get("kp"); if (kpq) { V.kp = kpq; if (!V.tab) V.tab = "kab"; }
    const yr = /^(\d{4})-(\d{4})$/.exec(q.get("yr") || ""); if (yr) V.yr = [+yr[1], +yr[2]];
    if (q.get("bm") === "prov") V.bmode = "prov";
    state.V = V;
    fixView();
  }
  /* ---- the chart card: tabs Garis | Batang | Peta (PI comment 21 Oct on "Deret menurut tahun pengamatan", after the
     World Bank indicator page) ---- */
  const TABS = () => [["line", L("Garis", "Line")], ["bar", L("Batang", "Bar")], ["map", L("Peta", "Map")], ["kab", L("Kabupaten/kota", "Districts")]];
  // a tab that has nothing to draw says why instead of opening an empty view
  function tabOff() {
    const V = state.V;
    if (V.i.district_only) { const o = L("hanya nilai kabupaten/kota", "district values only"); return { line: o, bar: o, map: o, kab: "" }; }
    return { line: V.single ? L("satu tahun saja", "one year only") : "", bar: "", map: V.hasProv ? "" : L("tanpa nilai provinsi", "no province values"),
      kab: distOf() ? "" : L("belum ada nilai kabupaten/kota", "no district values yet") };
  }
  const defaultTab = () => (state.V.i.district_only ? "kab" : state.V.single ? (state.V.hasProv ? "map" : "bar") : "line");
  const provSeries = () => seriesOf(state.V.g, null, 1);
  // keep the view state consistent after any change: a tab that can draw, a mapped breakdown and year, a year range
  // inside the years drawn
  function fixView() {
    const V = state.V, off = tabOff();
    if (!TABS().some((t) => t[0] === V.tab) || off[V.tab]) V.tab = defaultTab();
    if (V.hasProv) provView(); else V.pk = V.sel[0] || "";
    V.sp = yrSpan();  // the range in effect; V.yr keeps what the reader chose, so another area does not narrow it for good
  }
  function syncUrl() {
    const V = state.V; if (!V) return;
    const p = {};
    const defReg = defaultView(V.i, V.g);
    if (defReg && V.region !== defReg.region) p.r = V.region;
    const ser = seriesOf(V.g, V.region);
    if (V.sel.join() !== (ser[0] ? firstSeries(ser).key : "")) p.s = V.sel.join(",");
    if (V.tab !== defaultTab()) p.tab = V.tab;
    const pv = V.hasProv ? provView() : null;
    if (pv) {
      if (V.pk !== (pv.ps.some((s) => s.key === V.sel[0]) ? V.sel[0] : pv.ps[0].key)) p.pk = V.pk;
      if (+V.py !== defaultPy(pv.rowsY, pv.years)) p.py = V.py;
    }
    if (V.sp) p.yr = V.sp.join("-");
    if (cmpOn()) p.c = V.cmp.join(",");
    if (V.single && V.bmode === "prov") p.bm = "prov";
    history.replaceState(null, "", hashFor("/indikator/" + encodeURIComponent(V.i.id), p));
  }
  function currentSeriesRows() {
    const V = state.V, ser = seriesOf(V.g, V.region), rows = [];
    if (V.single) { ser.forEach((s) => s.rows.forEach((r) => rows.push(r))); return rows; }
    V.sel.forEach((k) => { const s = ser.find((x) => x.key === k); if (s) s.rows.forEach((r) => rows.push(r)); });
    return rows.sort((a, b) => (b.y == null ? -1e9 : b.y) - (a.y == null ? -1e9 : a.y));
  }
  // the latest year printed for at least half as many provinces as the best-covered year
  function defaultPy(rowsY, years) {
    const cnt = {}; rowsY.forEach((r) => { cnt[r.y] = (cnt[r.y] || 0) + 1; });
    const mx = Math.max.apply(null, Object.values(cnt).concat([1]));
    return years.slice().reverse().find((y) => cnt[y] >= mx * 0.5) || years[years.length - 1];
  }
  /* the province view of one breakdown (V.pk) in one year (V.py). Each year has one reference value per province (from
     the latest printing), so the year alone picks it; the old source-book select is gone (PI 21 Oct) */
  function provView() {
    const V = state.V, ps = provSeries();
    if (!ps.length) return null;
    if (!ps.some((s) => s.key === V.pk)) V.pk = ps.some((s) => s.key === V.sel[0]) ? V.sel[0] : ps[0].key;
    const s = ps.find((x) => x.key === V.pk);
    const rowsY = s.rows.filter((r) => r.y != null && r.v != null);
    const years = Array.from(new Set(rowsY.map((r) => r.y))).sort((a, b) => a - b);
    if (!years.includes(+V.py)) V.py = String(defaultPy(rowsY, years));
    const yrRows = rowsY.filter((r) => r.y === +V.py);
    return { ps, s, years, rowsY, yrRows };
  }
  function currentProvRows() { const pv = provView(); return pv ? pv.yrRows : []; }
  // all rows of one breakdown key, every area and year, indexed once per indicator
  function keyRows(g, key) {
    if (!g._bk) {
      g._bk = new Map();
      g.rows.forEach((r) => { const k = r.cat + "." + sidOf(g.F, r.bd); let a = g._bk.get(k); if (!a) g._bk.set(k, (a = [])); a.push(r); });
    }
    return g._bk.get(key) || [];
  }
  // a new area keeps the breakdowns it also prints, the one in the area table first, so the line shows the row clicked
  function setArea(key) {
    const V = state.V, ser = seriesOf(V.g, key), has = (k) => ser.some((s) => s.key === k);
    let sel = V.sel.filter(has);
    if (has(V.pk)) sel = [V.pk].concat(sel.filter((k) => k !== V.pk));
    V.region = key; V.sel = (sel.length ? sel : ser.length ? [firstSeries(ser).key] : []).slice(0, 6);
    V.chipq = ""; V.chipsAll = false; V.nvals = 12; V.bmode = "bd"; V.cmp = null;
  }
  /* compare areas on the line chart (PI 26 Oct, after OWID's "Add/remove countries and regions"): a checklist of the
     national row and the provinces in the side column, each with its latest value; two or more ticked draw one line per
     area for one breakdown, coloured as their ticks */
  const cmpOn = () => { const V = state.V; return !!(V && V.cmp && V.cmp.length > 1 && V.tab === "line"); };
  function cmpKey() {
    const V = state.V, ps = provSeries();
    return ps.some((s) => s.key === V.pk) ? V.pk : ps.some((s) => s.key === V.sel[0]) ? V.sel[0] : ps[0] ? ps[0].key : V.sel[0];
  }
  function cmpList() {
    const V = state.V, on = V.cmp && V.cmp.length > 1 ? V.cmp : [V.region], q = (V.cq || "").trim().toLowerCase();
    const A = areaRows(cmpKey(), null).filter((e) => e.reg !== "O");
    const byReg = new Map(A.map((e) => [e.reg, e]));
    const rest = A.filter((e) => !on.includes(e.reg) && (!q || e.label.toLowerCase().includes(q)));
    rest.sort(V.csort === "n" ? (a, b) => a.label.localeCompare(b.label, "id") : (a, b) => (a.row && b.row ? b.row.v - a.row.v : a.row ? -1 : b.row ? 1 : a.label.localeCompare(b.label, "id")));
    const row = (e, x) => {
      const sel = x >= 0, r = e.row;
      return '<button type="button" class="cmrow' + (sel ? " on" : "") + '" data-a="cmp" data-k="' + e.reg + '" aria-pressed="' + sel + '"><span class="cmbox">' + (sel ? '<span style="background:' + PALETTE[x % PALETTE.length] + '"></span>' : "") + "</span>" +
        '<span class="cmn">' + esc(e.label) + '</span><span class="cmv">' + (r ? fval(r.v) + "<small>" + r.y + "</small>" : "") + "</span></button>";
    };
    return on.map((k, x) => (byReg.has(k) ? row(byReg.get(k), x) : "")).join("") + (rest.length ? '<p class="cmsep">' + L("Wilayah lain", "Other areas") + "</p>" + rest.map((e) => row(e, -1)).join("") : "");
  }
  function cmpHtml() {
    const V = state.V; if (!V || !V.hasProv || V.single || V.tab !== "line") return "";
    const n = V.cmp && V.cmp.length > 1 ? V.cmp.length : 1;
    return '<div class="rail rcmp"><h3>' + L("Bandingkan wilayah", "Compare areas") + '</h3><p class="rnote">' + L("Centang sampai 8 wilayah untuk digambar berdampingan. Angka: nilai terbaru dan tahun nilai itu.", "Tick up to 8 areas to draw side by side. Figures: the latest value and its year.") + "</p>" +
      '<div class="cmtool"><label class="vh" for="cmq">' + L("Cari wilayah", "Search areas") + '</label><input id="cmq" type="search" data-a="cq" autocomplete="off" placeholder="' + L("Cari provinsi", "Search provinces") + '" value="' + esc(V.cq || "") + '">' +
      '<div class="seg" role="group" aria-label="' + L("Urutan", "Order") + '"><button type="button" data-a="csort" data-k="v" aria-pressed="' + (V.csort !== "n") + '">' + L("Nilai", "Value") + '</button><button type="button" data-a="csort" data-k="n" aria-pressed="' + (V.csort === "n") + '">' + L("Nama", "Name") + "</button></div></div>" +
      '<div class="cmlist" id="cmlist">' + cmpList() + "</div>" +
      (n > 1 ? '<button type="button" class="tl cmclear" data-a="cclear">' + L("Kembali ke satu wilayah", "Back to one area") + "</button>" : "") + "</div>";
  }
  // Batang: bars by year; for a one-year indicator, the area's breakdowns side by side or the provinces ranked
  function barMode() {
    const V = state.V;
    if (!V.single) return "year";
    return V.bmode === "prov" && V.hasProv ? "prov" : "bd";
  }
  // what the sidebar chooser picks: several lines, the one breakdown of the bars, or the breakdown on the map
  function chooserMode() {
    const V = state.V;
    if (V.tab === "map" || cmpOn()) return "prov";
    if (V.tab === "bar") { const m = barMode(); return m === "year" ? "lead" : m === "prov" ? "prov" : "none"; }
    return "multi";
  }
  const chooserSeries = () => (chooserMode() === "prov" ? provSeries() : seriesOf(state.V.g, state.V.region));
  function pickSeries(k) {
    const V = state.V, mode = chooserMode(), front = () => { V.sel = [k].concat(V.sel.filter((x) => x !== k)).slice(0, 6); };
    if (mode === "prov") { V.pk = k; if (seriesOf(V.g, V.region).some((s) => s.key === k)) front(); return; }
    if (mode === "lead") front();
    else { const x = V.sel.indexOf(k); if (x >= 0) { if (V.sel.length > 1) V.sel.splice(x, 1); } else { V.sel.push(k); if (V.sel.length > 6) V.sel.shift(); } }
    if (provSeries().some((s) => s.key === V.sel[0])) V.pk = V.sel[0];
  }
  // years of the breakdowns drawn in the area, for the range slider
  function rangeYears() {
    const V = state.V, ser = seriesOf(V.g, V.region), ys = new Set();
    if (cmpOn()) { keyRows(V.g, cmpKey()).forEach((r) => { if (r.y != null && r.v != null && V.cmp.includes(regionOf(r))) ys.add(r.y); }); return Array.from(ys).sort((a, b) => a - b); }
    V.sel.forEach((k) => { const s = ser.find((x) => x.key === k); if (s) s.rows.forEach((r) => { if (r.y != null && r.v != null) ys.add(r.y); }); });
    return Array.from(ys).sort((a, b) => a - b);
  }
  // the chosen year range clamped to the years drawn; null when it covers them all
  function yrSpan() {
    const V = state.V, ys = rangeYears();
    if (!V.yr || ys.length < 2) return null;
    const a = ys[0], b = ys[ys.length - 1], lo = Math.max(a, Math.min(V.yr[0], b)), hi = Math.min(b, Math.max(V.yr[1], lo));
    return lo <= a && hi >= b ? null : [lo, hi];
  }
  // the rows behind what the card shows now: the CSV of this view, its source tables and its citation
  function currentViewRows() {
    const V = state.V, g = V.g, ser = seriesOf(g, V.region), sp = V.sp;
    const ok = (r) => r.y != null && r.v != null && (!sp || (r.y >= sp[0] && r.y <= sp[1]));
    const rowsOf = (k) => { const s = ser.find((x) => x.key === k); return s ? s.rows : []; };
    const mapRows = () => {
      const pv = provView(); if (!pv) return [];
      const nat = keyRows(g, V.pk).find((r) => r.geo === 0 && r.y === +V.py && r.v != null);
      return (nat ? [nat] : []).concat(pv.yrRows);
    };
    if (V.tab === "map") return mapRows();
    if (V.tab === "bar") { const m = barMode(); return m === "prov" ? mapRows() : m === "bd" ? ser.flatMap((s) => s.rows).filter((r) => r.v != null) : rowsOf(V.sel[0]).filter(ok); }
    return V.sel.flatMap(rowsOf).filter(ok);
  }
  function tablesOf(rows) {
    const seen = new Map();
    rows.forEach((r) => { if (!seen.has(r.tab)) seen.set(r.tab, r); });
    return Array.from(seen.values()).map((r) => bookOf(state.V.g, r)).sort((a, b) => b.year - a.year || a.page - b.page);
  }

  /* breakdown chips (PI 22 Oct): grouped by what varies (age, residence, education ...), each group in its natural
     order; a label every series shares is said once above the chips, never repeated in each chip */
  const DIM_LABEL = { age: ["Umur", "Age"], kategori_usia: ["Kelompok umur", "Age group"], sex: ["Jenis kelamin", "Sex"], area: ["Tempat tinggal", "Residence"],
    education: ["Pendidikan", "Education"], education_hh: ["Pendidikan kepala rumah tangga", "Household head's education"], education_mother: ["Pendidikan ibu balita", "Mother's education"], work_mother: ["Status bekerja ibu", "Mother's work status"], occupation: ["Pekerjaan", "Occupation"], wealth: ["Kuintil kekayaan", "Wealth quintile"], institution: ["Institusi", "Institution"],
    kategori: ["Kategori", "Category"], kolom: ["Kolom", "Column"], baris: ["Baris", "Row"], period: ["Periode", "Period"], status: ["Status", "Status"], type: ["Jenis", "Type"],
    jenis: ["Jenis", "Type"], kelompok: ["Kelompok", "Group"], disease: ["Penyakit", "Disease"], facility_type: ["Jenis fasilitas", "Facility type"], employment: ["Status kepegawaian", "Employment status"],
    facility_class: ["Kelas fasilitas", "Facility class"], facility: ["Fasilitas", "Facility"], item: ["Butir", "Item"], country: ["Negara", "Country"], service: ["Layanan", "Service"], sumber: ["Sumber", "Source"],
    disaster: ["Bencana", "Disaster"], region: ["Wilayah", "Region"], specialty: ["Spesialisasi", "Specialty"], funding: ["Sumber dana", "Funding source"],
    commodity: ["Komoditas", "Commodity"], vaccine: ["Vaksin", "Vaccine"], target_group: ["Sasaran", "Target group"], ownership: ["Kepemilikan", "Ownership"],
    method: ["Metode", "Method"], remoteness: ["Keterpencilan", "Remoteness"], segment: ["Segmen", "Segment"], karakteristik: ["Karakteristik", "Characteristic"],
    cat: ["Kategori baris", "Row category"] };
  const dimLabel = (k) => (DIM_LABEL[k] ? DIM_LABEL[k][state.lang === "en" ? 1 : 0] : String(k).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()));
  // '<1', '1-4', '5-14', '15-24' ... by their first number; 'kuintil 1' before 'kuintil 2'; otherwise by name
  const natKey = (v) => { const t = String(v).toLowerCase(), m = t.match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(",", ".")) - (/^\s*(<|kurang)/.test(t) ? 0.5 : 0) : Infinity; };
  const natCmp = (a, b) => natKey(a) - natKey(b) || String(a).localeCompare(String(b), "id", { numeric: true });
  function seriesDims(F, s) {
    if (s._d) return s._d;
    const ix = s.key.lastIndexOf("."), c = +s.key.slice(0, ix), sid = +s.key.slice(ix + 1), d = {};
    if (c >= 0) d.cat = F.categories[c];
    if (sid >= 0) { try { Object.assign(d, JSON.parse(F._sstr[sid])); } catch (e) { d.bd = F._sstr[sid]; } }
    return (s._d = d);
  }
  function chipGroups(ser) {
    const F = state.V.g.F, dims = ser.map((s) => seriesDims(F, s)), common = {};
    if (ser.length > 1) Array.from(new Set(dims.flatMap((d) => Object.keys(d)))).forEach((k) => { const v = dims[0][k]; if (v != null && dims.every((d) => d[k] === v)) common[k] = v; });
    const groups = new Map();
    ser.forEach((s, j) => {
      const vary = Object.keys(dims[j]).filter((k) => !(k in common)).sort();
      const gk = vary.join("+");
      if (!groups.has(gk)) groups.set(gk, { key: gk, dims: vary, items: [] });
      groups.get(gk).items.push({ s, label: vary.map((k) => dims[j][k]).join(" \u00b7 ") || (ser.length > 1 ? L("Keseluruhan", "Overall") : s.label) });
    });
    const arr = Array.from(groups.values());
    arr.forEach((gp) => gp.items.sort((a, b) => (gp.dims.length === 1 ? natCmp(a.label, b.label) : b.s.n - a.s.n || a.label.localeCompare(b.label, "id", { numeric: true }))));
    arr.sort((a, b) => a.dims.length - b.dims.length || b.items.length - a.items.length);  // the overall value first, then one dimension at a time
    return { common, groups: arr };
  }
  const commonNote = (common) => (Object.keys(common).length ? '<p class="ccommon">' + L("Berlaku untuk semua rincian: ", "Applies to every breakdown: ") +
    Object.entries(common).map(([k, v]) => "<span>" + esc(dimLabel(k)) + " <b>" + esc(v) + "</b></span>").join("") + "</p>" : "");
  const groupHead = (gp) => (gp.dims.length ? gp.dims.map(dimLabel).join(" \u00d7 ") : L("Keseluruhan", "Overall"));
  // mode (chooserMode): "multi" up to six lines, "lead" the one breakdown of the bars, "prov" the breakdown on the map
  function chipsHtml(ser, mode) {
    const V = state.V, q = norm(V.chipq), on = mode === "prov" ? [V.pk] : mode === "lead" ? V.sel.slice(0, 1) : V.sel, sel = new Set(on);
    const sw = (k) => { const x = on.indexOf(k); return x < 0 || mode === "prov" ? "" : '<span class="sq sm" style="background:' + PALETTE[x % PALETTE.length] + '"></span>'; };
    const { common, groups } = chipGroups(ser);
    const fold = ser.length > 40 && !V.chipsAll && !q, sameN = ser.every((s) => s.n === ser[0].n);
    let hidden = 0;
    const body = groups.map((gp) => {
      let items = q ? gp.items.filter((it) => norm(it.label + " " + it.s.label).includes(q)) : gp.items;
      if (!items.length) return "";
      // folded, a group shows the ten series with the most years (27 Oct, MNC-01-012: in name order the ten shown were
      // one-year doses and BCG, Polio 4 and DPT-HB-Hib 3 sat behind "rincian lainnya"), still in name order
      if (fold && items.length > 10) {
        const top = new Set(items.slice().sort((a, b) => b.s.n - a.s.n).slice(0, 10).map((it) => it.s.key));
        const keep = items.filter((it) => top.has(it.s.key) || sel.has(it.s.key)); hidden += items.length - keep.length; items = keep;
      }
      return '<div class="cgrp"><p class="cglab">' + esc(groupHead(gp)) + '</p><div class="cgchips">' + items.map((it) => '<button type="button" class="chip" data-a="ser" data-k="' + it.s.key + '" aria-pressed="' + sel.has(it.s.key) + '" title="' + esc(it.s.label) + '">' + sw(it.s.key) + esc(trunc(it.label, 60)) +
        (sameN ? "" : " <small>" + it.s.n + " " + L("th", "yr") + "</small>") + "</button>").join("") + "</div></div>";
    }).join("");
    return commonNote(common) + (ser.length > 12 ? '<div class="chipsearch"><label class="vh" for="chipq">' + L("Cari rincian", "Search breakdowns") + '</label><input id="chipq" type="search" data-a="chipq" value="' + esc(V.chipq) + '" placeholder="' + L("Cari rincian", "Search breakdowns") + '"></div>' : "") +
      '<div class="cgroups" role="group" aria-label="' + L("Rincian yang digambar", "Breakdowns drawn") + '">' + body + "</div>" +
      (hidden ? '<button type="button" class="tl" data-a="chipsall">' + L("Tampilkan " + fint(hidden) + " rincian lainnya", "Show " + fint(hidden) + " more breakdowns") + "</button>" : "");
  }
  function valuesTable(rows, o) {
    const g = state.V.g, F = g.F, lang = state.lang === "en" ? 1 : 0;
    const head = (o.prov ? "<th>" + L("Provinsi", "Province") + "</th>" : "") + "<th>" + L("Tahun", "Year") + "</th>" + (o.series ? "<th>" + L("Rincian", "Breakdown") + "</th>" : "") + '<th class="r">' + L("Nilai", "Value") + "</th><th>" + L("Mutu", "Quality") + "</th><th>" + L("Buku", "Book") + '</th><th class="r">' + L("Hlm.", "Page") + "</th><th>" + L("Tabel sumber", "Source table") + '</th><th class="r">' + L("Baris, kolom", "Row, column") + "</th>";
    const body = rows.map((r) => {
      const b = bookOf(g, r), note = F.notes[r.note];
      return "<tr" + (o.me && r.geo === 0 ? ' class="me"' : "") + ">" + (o.prov ? '<td class="nw">' + (r.geo === 1 ? esc(F.provinces[r.prov]) : L("Nasional", "National")) + "</td>" : "") + '<td class="nw">' + (r.y == null ? L("tanpa tahun", "no year") : r.y) + "</td>" + (o.series ? "<td>" + esc(seriesLabel(F, r.cat, sidOf(F, r.bd))) + "</td>" : "") +
        '<td class="r"><b>' + fval(r.v) + "</b></td><td class=\"nw\">" + (r.ver ? '<span class="vr">' + L("terverifikasi", "verified") + "</span>" : '<span class="uv"><span class="sq sm hollow"></span>' + L("belum terverifikasi", "not yet verified") + "</span>") + (note && NOTE_LABEL[note] ? '<br><small class="nt">' + NOTE_LABEL[note][lang] + "</small>" : "") + "</td><td>" + esc(b.title) + '</td><td class="r">' + (b.page || "") + "</td><td>" + esc(b.table) + '</td><td class="r nw">' + r.row + ", " + r.col + "</td></tr>";
    }).join("");
    return '<div data-hint="' + swipeHint() + '" class="tw tscroll tw2" tabindex="0" aria-label="' + esc(o.aria) + '"><table class="t vt"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }
  /* sidebar (PI 21 Oct): a download box at the top (PI comment 22 Oct), the breakdown chooser, the related survey or
     Profil indicators. The source tables moved into a popup on the chart's source line, the quality note and the citation
     to the foot of the page. On phones the blocks keep their own order (styles.css, .ilay) */
  function railHtml(i) {
    const V = state.V && state.V.i === i ? state.V : null;
    return (V ? downloadHtml() : "") + (V ? cmpHtml() : "") + (V ? chooserHtml() : "") + defHtml(i) + sameSubHtml(i) + relatedBlock(i);
  }
  // the other indicators of the same subtheme and source, the most printed first (PI comment 22 Oct: "harusnya ada list
  // indikator terkait")
  function sameSubHtml(i) {
    if (!i.sub) return "";
    const L8 = state.catalog.indicators.filter((j) => j.sub === i.sub && j.id !== i.id && j.n > 0 && isRkd(j) === isRkd(i)).sort((a, b) => b._nb - a._nb).slice(0, 8);
    if (!L8.length) return "";
    const sb = subOf(i);
    return '<div class="rail relr rsub"><h3>' + L("Indikator terkait", "Related indicators") + '</h3><p class="rnote">' + esc(sb ? (state.lang === "en" ? sb.label_en : sb.label_id) : "") + '</p><ul class="rlist">' +
      L8.map((r) => '<li><a href="' + indHref(r.id) + '"><span class="rn">' + esc(indName(r)) + '</span><span class="ry">' + esc(yearsLabel(r)) + "</span></a></li>").join("") + "</ul>" +
      '<a class="tl ar" style="font-size:14px" href="' + hashFor("/jelajah", { t: i.topic, u: i.sub }) + '">' + L("Semua indikator subtema ini", "All indicators of this subtheme") + "</a></div>";
  }
  // the definition sits in the sidebar under the breakdowns (PI comments 22 Oct); its periods and its source share one row
  /* definition periods (PI comment 22 Oct, "ini apa maksudnya? kalau tidak jelas hapus saja"): the notes that only said a
     label came "from earlier books" lose that phrase, and periods sharing one note are listed once with all their years */
  function periodsHtml(i) {
    const clean = (t) => String(t || "").replace(/\s*(dalam|di) buku(-buku)? sebelumnya\s*\.?$/i, ".").replace(/\s*in earlier books\s*\.?$/i, ".");
    const groups = new Map();
    (i.periods || []).forEach((p) => {
      const note = clean(state.lang === "en" ? (p.note_en || p.note) : p.note);
      if (!groups.has(note)) groups.set(note, new Set());
      for (let y = p.from; y <= p.to; y++) groups.get(note).add(y);
    });
    const spans = (set) => {
      const ys = Array.from(set).sort((a, b) => a - b), out = [];
      ys.forEach((y) => { const l = out[out.length - 1]; if (l && y === l[1] + 1) l[1] = y; else out.push([y, y]); });
      return out.map((r) => (r[0] === r[1] ? r[0] : r[0] + " " + L("sampai", "to") + " " + r[1])).join(", ");
    };
    return Array.from(groups.entries()).map(([note, set]) => "<li><b>" + spans(set) + "</b>" + (note && note !== "." ? " " + esc(note) : "") + "</li>").join("");
  }
  function defHtml(i) {
    const lang = state.lang === "en" ? 1 : 0, t = i._topic, def = (state.lang === "en" ? i.def_en : i.def_id) || "";
    const periods = periodsHtml(i);
    const src = (i.sources || []).map((x) => "<li>" + esc(x) + "</li>").join("");
    return '<div class="rail rdef"><h3>' + L("Definisi dan ukuran", "Definition and measure") + "</h3>" + (def ? '<p class="deftxt">' + esc(def) + "</p>" : "") +
      '<dl class="dl1">' + dd(L("Pembilang", "Numerator"), esc(i.numerator)) + dd(L("Penyebut", "Denominator"), esc(i.denominator)) + dd(L("Satuan", "Unit"), esc(i.unit)) + dd(L("Jenis ukuran", "Measure type"), MEASURE[i.measure][lang]) +
      dd(L("Topik", "Topic"), '<span class="dom"><span class="sq" style="background:' + (TOPIC_COLOR[i.topic] || "#687487") + '"></span>' + esc(topicLabel(t)) + "</span>") + dd(L("Tipe indikator", "Indicator type"), IPOO[i.ipoo] ? IPOO[i.ipoo][lang] : "") +
      dd(L("Blok sistem kesehatan WHO", "WHO building block"), WHO[i.who] ? WHO[i.who][lang] : esc(i.who)) +
      dd(L("Keterbandingan", "Comparability"), esc(trendLabel(i.trend)) + (i.trend_note ? '<span class="tnote">' + esc(state.lang === "en" ? (i.trend_note_en || i.trend_note) : i.trend_note) + "</span>" : "")) + "</dl>" +
      (periods || src ? '<div class="dps">' + (periods ? '<div><p class="kk">' + L("Periode definisi", "Definition periods") + '</p><ul class="plist">' + periods + "</ul></div>" : "") +
        (src ? '<div><p class="kk">' + L("Sumber", "Source") + '</p><ul class="plist">' + src + "</ul></div>" : "") + "</div>" : "") + "</div>";
  }
  function chooserHtml() {
    const mode = chooserMode(), ser = chooserSeries();
    const T = {
      multi: [L("Rincian Subgroup", "Subgroup breakdowns"), L("Pilih sampai 6.", "Pick up to 6.")],
      lead: [L("Rincian Subgroup", "Subgroup breakdown"), L("Pilih satu.", "Pick one.")],
      prov: [L("Rincian Subgroup", "Subgroup breakdown"), L("Pilih satu.", "Pick one.")],
      none: [L("Rincian Subgroup", "Subgroup breakdowns"), ""]
    }[mode];
    const one = mode !== "none" && ser.length < 2;
    // a long list scrolls: what is drawn now is repeated on top, so it is never hidden down the list
    let picked = "";
    if (!one && mode !== "none" && ser.length > 12) {
      const V = state.V, on = mode === "prov" ? [V.pk] : mode === "lead" ? V.sel.slice(0, 1) : V.sel, short = shortLabels(ser);
      picked = '<div class="cpicked"><p class="cglab">' + (mode === "multi" ? L("Digambar", "Drawn") : L("Ditampilkan", "Shown")) + '</p><div class="cgchips">' + on.filter((k) => short.has(k)).map((k, x) => '<button type="button" class="chip" data-a="ser" data-k="' + k + '" aria-pressed="true" title="' + esc(ser.find((s) => s.key === k).label) + '">' +
        (mode === "prov" ? "" : '<span class="sq sm" style="background:' + PALETTE[x % PALETTE.length] + '"></span>') + esc(trunc(short.get(k), 60)) + "</button>").join("") + "</div></div>";
    }
    if (one) return "";  // no choice to make, no box (PI 22 Oct: fewer explanatory notes)
    return '<div class="rail rsel"><h3>' + T[0] + "</h3>" + (T[1] ? '<p class="rnote">' + T[1] + "</p>" : "") + picked +
      (mode === "none" || one ? "" : '<div id="chips">' + chipsHtml(ser, mode) + "</div>") + "</div>";
  }
  function downloadHtml() {
    const V = state.V, n = currentViewRows().length, what = { line: L("grafik garis", "the line chart"), bar: L("grafik batang", "the bar chart"), map: L("peta", "the map") }[V.tab];
    // the district tab (25 Oct: it read "15 baris pada undefined"): "this view" is the district values, as a district CSV
    const DK = V.tab === "kab" && V.g && V.g.F && V.g.F.district ? V.g.F.district[V.i.id] : null;
    if (!canDl()) return '<div class="rail rdl"><h3>' + L("Unduh", "Download") + '</h3><div class="railbtn">' + dlGate(V.i.id, "all") + "</div></div>";
    return '<div class="rail rdl"><h3>' + L("Unduh", "Download") + '</h3><div class="railbtn"><button type="button" class="btn sm" data-a="csv" data-w="all">' + ICON.dl + L("CSV semua nilai", "CSV of all values") + "</button>" +
      (DK ? '<button type="button" class="btn sm ol" data-a="csv" data-w="kab">' + ICON.dl + L("CSV nilai kabupaten/kota", "CSV of district values") + "</button></div>" :
        '<button type="button" class="btn sm ol" data-a="csv" data-w="view">' + ICON.dl + L("CSV tampilan ini", "CSV of this view") + "</button></div>") +
      '<p class="src">' + (DK ? L("Semua nilai: " + fint(V.g.rows.length) + " baris. Nilai kabupaten/kota: " + fint(DK.rows.length) + " baris, semua provinsi. Setiap baris membawa sumber dan halaman atau nomor baris sumber.",
        "All values: " + fint(V.g.rows.length) + " rows. District values: " + fint(DK.rows.length) + " rows, every province. Every row carries its source and its page or row.") :
        L("Semua nilai: " + fint(V.g.rows.length) + " baris. Tampilan ini: " + fint(n) + " baris pada " + what + ". Setiap baris membawa buku, halaman, tabel, baris dan kolom sumber.",
        "All values: " + fint(V.g.rows.length) + " rows. This view: " + fint(n) + " rows on " + what + ". Every row carries its book, page, table, row and column.")) + "</p></div>";
  }
  /* foot of the page, full width (PI 21 Oct): citation and data, the quality note, then the values with their book,
     page and table */
  function bottomHtml(i) {
    const V = state.V && state.V.i === i ? state.V : null, m = state.manifest;
    let cite = "";
    if (V) {
      const rows = currentViewRows().concat(currentSeriesRows());
      const latest = rows.filter((r) => r.y != null).sort((a, b) => b.y - a.y)[0] || rows[0] || V.g.rows[0];
      if (latest) {
        const b = bookOf(V.g, latest);
        cite = L("Kementerian Kesehatan RI. " + b.title + (b.page ? ", hlm. " + b.page : "") + ", tabel “" + b.table + "”. Dibaca melalui Atlas Indikator Profil Kesehatan Indonesia, ARC Institute, " + m.version + ". Kode indikator " + i.id + ".",
          "Ministry of Health of the Republic of Indonesia. " + b.title + (b.page ? ", p. " + b.page : "") + ", table “" + b.table + "”. Read through the Indonesia Health Profile Indicator Atlas, ARC Institute, " + m.version + ". Indicator code " + i.id + ".");
      }
    }
    if (i.district_only) {
      // no national figure exists: the citation names the provincial book, the note says what was checked
      const D = distOf(), last = D ? D.rows.filter((r) => r.length < 7).sort((a, b) => b[0] - a[0])[0] : null;
      if (last) {
        const sid = D.src[last[3]];
        cite = sid.startsWith("adm:") ? L(srcName(sid, D) + ". Dibaca melalui Atlas Indikator Profil Kesehatan Indonesia, ARC Institute, " + m.version + ". Kode indikator " + i.id + ".", srcName(sid, D) + ". Read through the Indonesia Health Profile Indicator Atlas, ARC Institute, " + m.version + ". Indicator code " + i.id + ".")
          : sid.startsWith("sdi:") ? L(srcName(sid, D) + ", data.go.id (Satu Data Indonesia). Dibaca melalui Atlas Indikator Profil Kesehatan Indonesia, ARC Institute, " + m.version + ". Kode indikator " + i.id + ".", srcName(sid, D) + ", data.go.id (One Data Indonesia). Read through the Indonesia Health Profile Indicator Atlas, ARC Institute, " + m.version + ". Indicator code " + i.id + ".")
          : L("Dinas Kesehatan Provinsi " + PROVCODE[sid.split("-")[1]] + ". " + bookName(sid) + ", hlm. " + last[4] + ". Dibaca melalui Atlas Indikator Profil Kesehatan Indonesia, ARC Institute, " + m.version + ". Kode indikator " + i.id + ".", "Provincial Health Office of " + PROVCODE[sid.split("-")[1]] + ". " + bookName(sid) + ", p. " + last[4] + ". Read through the Indonesia Health Profile Indicator Atlas, ARC Institute, " + m.version + ". Indicator code " + i.id + ".");
      }
    }
    const nv = Math.round((1 - i.verified_share) * i.n);
    const qual = i.district_only ? '<p class="note qnote warn"><span class="hic">' + ICON.alert + "</span><b>" + L("Mutu nilai.", "Quality of the values.") + "</b> " +
      L("Indikator ini hanya ada pada tingkat kabupaten/kota: buku nasional tidak mencetak indikator ini, jadi tidak ada angka nasional untuk pembanding. Untuk jumlah, nilai kabupaten/kota diperiksa terhadap total provinsi yang dicetak di tabel yang sama (selisih paling banyak 10%); persentase di atas 150 dan nilai yang jauh dari deret kabupaten/kota yang sama dikeluarkan.",
        "This indicator exists at district level only: the national book does not print it, so there is no national figure to compare with. For counts, district values are checked against the province total printed in the same table (at most 10% apart); percentages above 150 and values far from their district's series are left out.") +
      ' <a class="tl ar" href="#/metode/subnasional" style="font-size:14px">' + L("Data subnasional", "Subnational data") + "</a></p>"
      : i.n ? '<p class="note qnote ' + (i.verified_share >= 1 ? "ok" : "warn") + '"><span class="hic">' + (i.verified_share >= 1 ? ICON.check : ICON.alert) + "</span><b>" + L("Mutu nilai.", "Quality of the values.") + "</b> " + (i.verified_share >= 1 ? L("Semua " + fint(i.n) + " nilai indikator ini terverifikasi.", "All " + fint(i.n) + " values of this indicator are verified.") : L(fint(nv) + " dari " + fint(i.n) + " nilai belum terverifikasi (" + fpct(1 - i.verified_share, 0) + "%); pada grafik tampil sebagai titik kosong atau batang abu-abu, pada tabel diberi tanda.", fint(nv) + " of " + fint(i.n) + " values are not yet verified (" + fpct(1 - i.verified_share, 0) + "%); they appear as hollow points or grey bars in charts and are flagged in tables.")) +
      ' <a class="tl ar" href="#/metode" style="font-size:14px">' + L("Metode", "Method") + "</a></p>" : "";
    let prov = "";
    if (V && !i.district_only) {
      const sel = currentSeriesRows(), nShow = Math.min(V.nvals, sel.length);
      prov = '<figure class="fig vprov"><p class="ft2">' + L("Nilai menurut tahun", "Values by year") + '</p><p class="fs">' + esc(regionLabel(V.g, V.region)) + ".</p>" +
        valuesTable(sel.slice(0, nShow), { series: true, aria: L("Nilai menurut tahun, gulir tabel", "Values by year, scroll the table") }) +
        '<div class="more"><span>' + nShow + " " + L("dari", "of") + " " + fint(sel.length) + "</span>" + (nShow < sel.length ? '<button type="button" class="btn sm ol" data-a="morevals" data-auto="1">' + L("Tampilkan 24 berikutnya", "Show the next 24") + "</button>" : "") + (canDl() ? '<button type="button" class="btn sm" data-a="csv" data-w="series">' + ICON.dl + L("Unduh baris ini (CSV)", "Download these rows (CSV)") + "</button>" : "") + "</div></figure>";
    }
    return '<section class="vbot" id="kutip" aria-label="' + L("Kutip dan ambil data", "Cite and get the data") + '"><div class="cblk"><div><h2>' + L("Kutip dan ambil data", "Cite and get the data") + "</h2>" + (cite ? '<p class="cite" id="citetxt">' + esc(cite) + "</p>" : "") +
      '<p class="codeline">' + L("Kode indikator", "Indicator code") + ': <span class="mono">' + esc(i.id) + '</span></p></div><div class="railbtn">' +
      (cite ? '<button type="button" class="btn sm ol" data-a="copycite">' + ICON.copy + L("Salin kutipan", "Copy the citation") + "</button>" : "") +
      '<button type="button" class="btn sm ol" data-a="copylink">' + ICON.link + L("Salin tautan", "Copy the link") + "</button>" +
      (i.n && !i.district_only ? (canDl() ? '<button type="button" class="btn sm" data-a="csv" data-w="all">' + ICON.dl + L("Unduh semua nilai (CSV)", "Download all values (CSV)") + "</button>" : dlGate(i.id, "all")) : "") +
      '<a class="btn sm ol" href="#/akun">' + ICON.ext + L("Akses data", "Data access") + '</a><a class="btn sm ol" href="' + hashFor("/masukan", { i: i.id + " " + i.name_id }) + '">' + L("Laporkan angka ini", "Report a figure") + "</a></div></div>" + qual + prov + "</section>";
  }
  function renderBottom() { const V = state.V, b = $("#vbot"); if (V && b) b.innerHTML = bottomHtml(V.i); }
  function classify(vals) {
    const s = vals.slice().sort((a, b) => a - b), uniq = Array.from(new Set(s));
    if (uniq.length <= 1) return { edges: [s[0], s[0]], k: 1 };
    const k = Math.min(5, uniq.length), edges = [s[0]];
    for (let j = 1; j < k; j++) { const q = s[Math.min(s.length - 1, Math.floor((s.length * j) / k))]; if (q > edges[edges.length - 1]) edges.push(q); }
    if (s[s.length - 1] > edges[edges.length - 1]) edges.push(s[s.length - 1]);
    return { edges, k: edges.length - 1 };
  }
  const classOf = (c, v) => { for (let j = 0; j < c.k; j++) if (v <= c.edges[j + 1]) return j; return c.k - 1; };
  const colorOfClass = (c, j) => (c.k === 1 ? MAPRAMP[3] : MAPRAMP[Math.round((j / (c.k - 1)) * 4)]);
  // the map colours are continuous from the lowest to the highest value (PI comment 22 Oct), along the same five stops
  const hex2 = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  function rampAt(t) {
    t = Math.max(0, Math.min(1, t)) * (MAPRAMP.length - 1);
    const k = Math.min(MAPRAMP.length - 2, Math.floor(t)), f = t - k, a = hex2(MAPRAMP[k]), b = hex2(MAPRAMP[k + 1]);
    return "#" + a.map((x, j) => Math.round(x + (b[j] - x) * f).toString(16).padStart(2, "0")).join("");
  }
  // a skewed spread (one province 20 times another, as counts often are) is coloured on a log scale, or every other
  // province would look the same pale shade
  function scaleOf(c) {
    if (c._s) return c._s;
    const lo = c.edges[0], hi = c.edges[c.edges.length - 1], log = lo >= 0 && hi > 0 && (hi + 1) / (lo + 1) > 20;
    const f = log ? (v) => Math.log1p(Math.max(0, v)) : (v) => v, a = f(lo), b = f(hi);
    return (c._s = { lo, hi, log, t: (v) => (b > a ? (f(v) - a) / (b - a) : 1), at: (t) => (log ? Math.expm1(a + t * (b - a)) : a + t * (b - a)) });
  }
  const contColor = (c, v) => { const S = scaleOf(c); return S.hi > S.lo ? rampAt(S.t(v)) : MAPRAMP[3]; };

  /* the highlight box (PI 22 Oct: "terlalu flat"): the latest national value, its change, the highest and lowest
     province and the coverage. With the comparability status and the quality note these are the only blocks that
     carry an icon. */
  // a district-only indicator: the latest year with five or more districts, its highest and lowest district, coverage
  function hlDistHtml(i) {
    const D = distOf(); if (!D) return "";
    const rows = D.rows.filter((r) => r.length < 7), by = {};
    rows.forEach((r) => { (by[r[0]] = by[r[0]] || []).push(r); });
    const ys = Object.keys(by).map(Number).sort((a, b) => b - a), y = ys.find((x) => by[x].length >= 5) || ys[0];
    if (y == null) return "";
    const yr = by[y].slice().sort((a, b) => b[2] - a[2]), hi = yr[0], lo = yr[yr.length - 1], unit = i.unit ? " <span>" + esc(i.unit) + "</span>" : "";
    const nm = (r) => D.d[r[1]][1] + ", " + D.d[r[1]][2];
    // coverage counts every district value, subgroups included (the methods of KB participants cover 20 provinces
    // where the overall column covers two)
    const provs = new Set(D.rows.map((r) => D.d[r[1]][2])).size, dists = new Set(D.rows.map((r) => r[1])).size;
    return '<section class="hlb" aria-label="' + L("Sorotan", "Highlights") + '">' +
      // every district the same (a rare event with no case anywhere that year): one value, no highest and lowest
      (hi[2] === lo[2] ? '<div class="hlc hmain"><p class="hk">' + L("Semua kabupaten/kota", "Every district") + " · " + y + '</p><p class="hv">' + fval(hi[2]) + unit + '</p><p class="hs">' + L("nilai yang sama di " + yr.length + " kabupaten/kota", "the same value in " + yr.length + " districts") + "</p></div>" +
        '<div class="hlc"><p class="hk">' + L("Tahun terakhir dengan perbedaan", "Latest year with differences") + '</p><p class="hv2">' + (ys.find((x) => { const v = by[x].map((r) => r[2]); return Math.max(...v) !== Math.min(...v); }) || L("tidak ada", "none")) + '</p><p class="hs">' + L("nilai kabupaten/kota berbeda", "district values differ") + "</p></div>"
      : '<div class="hlc hmain"><p class="hk">' + L("Kabupaten/kota tertinggi", "Highest district") + " · " + y + '</p><p class="hv">' + fval(hi[2]) + unit + '</p><p class="hs">' + esc(nm(hi)) + "</p></div>" +
      '<div class="hlc"><p class="hk">' + L("Kabupaten/kota terendah", "Lowest district") + " · " + y + '</p><p class="hv2">' + fval(lo[2]) + (i.unit ? " " + esc(i.unit) : "") + '</p><p class="hs">' + esc(nm(lo)) + "</p></div>") +
      '<div class="hlc"><p class="hk">' + L("Tahun " + y, "Year " + y) + '</p><p class="hv2">' + fint(yr.length) + " " + L("kabupaten/kota", "districts") + '</p><p class="hs">' + L("tercantum pada tahun ini", "listed this year") + "</p></div>" +
      '<div class="hlc"><p class="hk">' + L("Cakupan data", "Data coverage") + '</p><p class="hv2">' + fint(dists) + " " + L("kabupaten/kota", "districts") + '</p><p class="hs">' + esc(yearsLabel(i)) + " · " + provs + " " + L("provinsi", "provinces") + "</p></div></section>";
  }
  function hlHtml() {
    const V = state.V; if (!V) return "";
    const { i, g } = V;
    if (i.district_only) return hlDistHtml(i);
    const regN = regionList(g).some((r) => r.key === "N" && r.n > 0) ? "N" : V.region;
    // the overall series leads; when it holds a single year (FIN-01-002 prints its national total once, its other years
    // only by programme: PI comment 22 Oct) the series on the chart, or else the longest one, carries the box
    const ser = seriesOf(g, regN), nyr = (x) => new Set(x.rows.filter((r) => r.y != null && r.v != null).map((r) => r.y)).size;
    const over = ser.find((x) => x.key === "-1.-1");
    // among equally long series the one with the fewest dimensions (24 Oct: a distribution without an overall value
    // showed "15-24 · Belum lahir" where "Belum lahir" for all ages exists)
    const dims = (x) => (x.label ? String(x.label).split(" · ").length : 9);
    const s = over && nyr(over) > 1 ? over : ser.find((x) => x.key === V.sel[0] && (nyr(x) > 1 || nyr(x) >= Math.max(...ser.map(nyr)))) || (over && nyr(over) >= Math.max(...ser.map(nyr)) ? over : ser.slice().sort((a, c) => nyr(c) - nyr(a) || dims(a) - dims(c))[0]);
    if (!s) return "";
    const pts = s.rows.filter((r) => r.y != null && r.v != null).sort((a, b) => a.y - b.y);
    const last = pts[pts.length - 1];
    if (!last) return "";
    const b = bookOf(g, last), unit = i.unit ? " <span>" + esc(i.unit) + "</span>" : "";
    const comparable = i.trend !== "no";  // "not yet assessed" still compares (PI comment 22 Oct), with a note below
    let prevs = pts.slice(0, -1).filter((r) => i.trend !== "within_period" || r.per === last.per), prev = prevs[prevs.length - 1];
    // the latest value opens a new definition period (PI comment 25 Oct on "Tidak dibandingkan antartahun": "ini jelas jelas
    // dibandingkan", the chart does compare inside each period): compare the last two values of the latest period that
    // has two, and say which years that pair covers
    let cur = last, older = "";
    if (comparable && !prev && i.trend === "within_period") {
      for (let k = pts.length - 2; k > 0 && !prev; k--) {
        const same = pts.slice(0, k).filter((r) => r.per === pts[k].per);
        if (same.length) { cur = pts[k]; prev = same[same.length - 1]; older = L(" (periode definisi sebelumnya; definisi berubah sesudah " + cur.y + ")", " (the earlier definition period; the definition changed after " + cur.y + ")"); }
      }
    }
    let chg;
    if (pts.length < 2) chg = ["flat", "one", L("Satu tahun pengamatan", "One year of observation"), L("Belum ada tahun pembanding.", "No year to compare with yet.")];
    else if (!comparable || !prev) chg = ["alert", "nc", L("Tidak dibandingkan antartahun", "Not compared across years"), esc(trendLabel(i.trend)) + "."];
    else {
      const last = cur;
      const d = last.v - prev.v, rel = prev.v ? (d / Math.abs(prev.v)) * 100 : null;
      const size = i.measure === "percent" ? fval(Math.round(Math.abs(d) * 10) / 10) + " " + L("poin persen", "percentage points") : rel == null ? fval(Math.abs(d)) : fval(Math.round(Math.abs(rel) * 10) / 10) + "%";
      const dir = Math.abs(d) < 1e-9 ? "flat" : d > 0 ? "up" : "down";
      chg = [dir, dir, (dir === "flat" ? L("tetap", "unchanged") : dir === "up" ? L("naik ", "up ") + size : L("turun ", "down ") + size), L("dari ", "from ") + fval(prev.v) + L(" pada ", " in ") + prev.y + (i.trend === "unknown" ? L("; keterbandingan belum dinilai", "; comparability not yet assessed") : "")];
      if (older) chg[3] = L("dari ", "from ") + fval(prev.v) + L(" pada ", " in ") + prev.y + L(" ke ", " to ") + fval(last.v) + L(" pada ", " in ") + last.y + older;
    }
    const pr = g.rows.filter((r) => r.geo === 1 && r.v != null && r.y != null && r.cat + "." + sidOf(g.F, r.bd) === s.key);
    const ys = Array.from(new Set(pr.map((r) => r.y))).sort((a, c) => c - a), py = ys.find((y) => new Set(pr.filter((r) => r.y === y).map((r) => r.prov)).size >= 5);
    let prov = "";
    if (py) {
      const seen = new Set(), yr = pr.filter((r) => r.y === py && !seen.has(r.prov) && seen.add(r.prov)).sort((a, c) => c.v - a.v);
      const hi = yr[0], lo = yr[yr.length - 1];
      prov = '<div class="hlc"><p class="hk">' + L("Provinsi, ", "Provinces, ") + py + "</p>" +
        '<p class="hrow"><i class="hb hi">' + L("tertinggi", "highest") + "</i>" + esc(g.F.provinces[hi.prov]) + "<b>" + fval(hi.v) + "</b></p>" +
        '<p class="hrow"><i class="hb lo">' + L("terendah", "lowest") + "</i>" + esc(g.F.provinces[lo.prov]) + "<b>" + fval(lo.v) + "</b></p></div>";
    }
    return '<section class="hlb" aria-label="' + L("Sorotan", "Highlights") + '">' +
      '<div class="hlc hmain"><p class="hk">' + L("Nilai terbaru", "Most recent value") + " · " + esc(regionLabel(g, regN)) + (s.key !== "-1.-1" ? " · " + esc(trunc(s.label, 40)) : "") + '</p><p class="hv">' + fval(last.v) + unit + '</p><p class="hs">' + last.y + " · " + esc(b.title) + (b.page ? ", " + L("hlm. ", "p. ") + b.page : "") + "</p></div>" +
      '<div class="hlc"><p class="hk">' + L("Perubahan", "Change") + '</p><p class="hv2"><span class="hchg ' + chg[1] + '">' + ICON[chg[0]] + "</span>" + chg[2] + '</p><p class="hs">' + chg[3] + "</p></div>" +
      prov +
      '<div class="hlc"><p class="hk">' + L("Cakupan data", "Data coverage") + '</p><p class="hv2">' + i._nb + " " + bookWord(i, i._nb) + '</p><p class="hs">' + esc(yearsLabel(i)) + (i.n_prov ? " · " + i.n_prov + " " + L("provinsi", "provinces") : "") + "</p></div></section>";
  }
  function renderViz() {
    const V = state.V; if (!V) return;
    fixView();
    const cg0 = $("#rail .cgroups"), top = cg0 ? cg0.scrollTop : 0;  // a long chip list keeps its scroll across a redraw
    $("#viz").innerHTML = cardHtml();
    $("#atab").innerHTML = V.tab === "kab" && V.kp ? kabTableHtml() : areaTableHtml();
    $("#rail").innerHTML = railHtml(V.i);
    const hl = $("#hl"); if (hl && !hl.firstChild) hl.innerHTML = hlHtml();  // the highlight does not follow the view
    const cg = $("#rail .cgroups"); if (cg) cg.scrollTop = top;
    renderBottom();
    drawCharts();
    if (V.tab === "map") drawMapNow();
    if (V.tab === "kab") drawKabMapNow();
    fillRelatedSparks();
    syncUrl();
  }
  const vhead = (t, s, ctl) => '<div class="vhead"><div><p class="ft2">' + t + '</p><p class="fs">' + s + "</p></div>" + (ctl || "") + "</div>";
  function regionSelect() {
    const V = state.V, regs = regionList(V.g).filter((r) => r.n > 0);
    if (regs.length < 2) return "";
    return '<label class="field vreg"><span class="lab">' + L("Wilayah", "Area") + '</span><select id="sel-region" data-a="region">' + regs.map((r) => '<option value="' + r.key + '"' + (r.key === V.region ? " selected" : "") + ">" + esc(r.label) + " (" + fint(r.n) + ")</option>").join("") + "</select></label>";
  }
  // two-handle year range under the line and the year bars (PI 22 Oct, as under the World Bank line view)
  function rangeHtml() {
    const V = state.V, ys = rangeYears();
    if (ys.length < 2) return "";
    const a = ys[0], b = ys[ys.length - 1], sp = V.sp || [a, b];
    return '<div class="yrange"><p class="yrv" id="yrtxt">' + sp[0] + " " + L("sampai", "to") + " " + sp[1] + '</p><div class="yrs" id="yrs" style="--a:' + ((sp[0] - a) / (b - a)).toFixed(4) + ";--b:" + ((sp[1] - a) / (b - a)).toFixed(4) + '"><span class="ytr"></span><span class="yfill"></span>' +
      '<input type="range" id="yr0" data-a="yr" min="' + a + '" max="' + b + '" step="1" value="' + sp[0] + '" aria-label="' + L("Tahun awal", "First year") + '">' +
      '<input type="range" id="yr1" data-a="yr" min="' + a + '" max="' + b + '" step="1" value="' + sp[1] + '" aria-label="' + L("Tahun akhir", "Last year") + '">' +
      '<span class="yends" aria-hidden="true"><span>' + a + "</span><span>" + b + "</span></span></div></div>";
  }
  // single-year slider under the map: only the years that have province values
  function pyHtml(pv) {
    const V = state.V, ys = pv.years, k = ys.indexOf(+V.py);
    if (ys.length < 2) return '<div class="yrange"><p class="yrv">' + V.py + '</p><p class="src yone">' + L("Satu-satunya tahun dengan nilai provinsi.", "The only year with province values.") + "</p></div>";
    // play (PI 26 Oct, after OWID's time-lapse): the map steps through the years
    return '<div class="yrange"><button type="button" class="yplay" data-a="pyplay" aria-label="' + (state._pyT ? L("Hentikan", "Stop") : L("Putar tahun demi tahun", "Play year by year")) + '" aria-pressed="' + !!state._pyT + '">' + (state._pyT ? "&#10074;&#10074;" : "&#9654;") + "</button>" +
      '<p class="yrv" id="pytxt">' + V.py + '</p><div class="yrs one"><span class="ytr"></span><input type="range" id="pyr" data-a="pyr" min="0" max="' + (ys.length - 1) + '" step="1" value="' + k + '" aria-label="' + L("Tahun pada peta", "Year on the map") + '" aria-valuetext="' + V.py + '">' +
      '<span class="yends" aria-hidden="true"><span>' + ys[0] + "</span><span>" + ys[ys.length - 1] + "</span></span></div></div>";
  }
  /* source tables of the view (PI 21 Oct: a hover popup, not a sidebar panel). Hover, keyboard focus or a tap opens it;
     a click pins it until the next click, Escape or a click elsewhere */
  function srcLine(text) {
    const list = tablesOf(currentViewRows());
    const pop = list.length ? '<div class="spw"><button type="button" class="spb" data-a="srcpop" aria-expanded="false" aria-controls="srcpop">' + fint(list.length) + " " + L("tabel sumber", list.length === 1 ? "source table" : "source tables") + "</button>" +
      '<div class="spop" id="srcpop" role="region" tabindex="0" aria-label="' + L("Tabel sumber tampilan ini", "Source tables of this view") + '"><ul>' +
      list.slice(0, 80).map((b) => "<li><b>" + esc(b.title) + "</b>" + (b.page ? ", " + L("halaman ", "page ") + b.page : "") + "<span>" + esc(b.table) + "</span></li>").join("") + "</ul>" +
      (list.length > 80 ? '<p class="src">' + L("dan " + fint(list.length - 80) + " tabel lain; semuanya ada di CSV.", "and " + fint(list.length - 80) + " more tables; all are in the CSV.") + "</p>" : "") + "</div></div>" : "";
    return '<div class="srcl" id="srcl"><p class="src">' + text + "</p>" + pop + "</div>";
  }
  function popSet(w, on) {
    if (!w) return;
    w.classList.toggle("open", on);
    if (!on) w.classList.remove("pin");
    const b = w.querySelector(".spb"); if (b) b.setAttribute("aria-expanded", on);
  }
  function mapLegend(vals, cls, names) {
    const g = state.V.g, S = scaleOf(cls), lo = S.lo, hi = S.hi;
    const stops = MAPRAMP.map((c, k) => c + " " + Math.round((k / (MAPRAMP.length - 1)) * 100) + "%").join(", ");
    const missing = 38 - names.filter((r) => g.F.provinces[r.prov] !== "Timor Timur").length;
    const mid = S.log && hi > lo ? '<em style="left:50%">' + fval(Math.round(S.at(0.5))) + "</em>" : "";
    return '<span class="mgrad"><b>' + fval(lo) + '</b><i style="background:linear-gradient(90deg, ' + stops + ')">' + mid + "</i><b>" + fval(hi) + "</b></span>" + (S.log ? '<span class="mlog">' + L("skala logaritmik", "log scale") + "</span>" : "") +
      (missing > 0 ? '<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="0.5" y="0.5" width="13" height="13" fill="#ffffff" stroke="#c5ccd4"/><path d="M0 14L14 0M-4 10L10-4M4 18L18 4" stroke="#c5ccd4" stroke-width="2"/></svg>' + L("Tidak tercantum", "Not listed") + " <b>" + missing + "</b></span>" : "");
  }
  const byNameOf = (pv) => { const m = new Map(); pv.yrRows.forEach((r) => m.set(state.V.g.F.provinces[r.prov], r)); return m; };
  // map title, note, the map itself and its legend in the map's corner; redrawn alone while the year slider moves
  function mapPanelHtml(pv) {
    const V = state.V, { i, g } = V, names = pv.yrRows, vals = names.map((r) => r.v), cls = classify(vals);
    const book = names[0] ? bookOf(g, names[0]) : null, lbl = pv.s.label !== L("Nilai utama", "Main value") ? pv.s.label : "";
    return '<p class="ft2">' + L("Nilai " + V.py + " menurut provinsi", "Values in " + V.py + " by province") + (lbl ? ": " + esc(trunc(lbl, 80)) : "") + '</p><p class="fs">' +
      L(fint(names.length) + " provinsi tercantum di tabel" + (book ? " " + book.title : "") + "; provinsi lain diarsir karena tidak tercantum, bukan nol.", fint(names.length) + " provinces are listed in the table" + (book ? " of " + book.title : "") + "; other provinces are hatched because they are not listed, not because they are zero.") + "</p>" +
      '<div class="mapwrap mbig"><div id="map">' + (state.topoPaths ? mapSvg(state.topoPaths, byNameOf(pv), cls, i.unit, "hatch", true) : '<p class="loading">' + L("Memuat peta...", "Loading the map...") + "</p>") + "</div>" +
      '<div class="mleg inmap">' + (i.unit ? '<p class="mlt">' + esc(trunc(i.unit, 36)) + "</p>" : "") + mapLegend(vals, cls, names) + "</div></div>";
  }
  function mapSrcText(pv) {
    const book = pv.yrRows[0] ? bookOf(state.V.g, pv.yrRows[0]) : null;
    return (book ? L("Sumber: ", "Source: ") + esc(book.title) + (book.page ? ", " + L("halaman ", "page ") + book.page : "") + ", " + esc(book.table) + ". " : "") + L("Batas provinsi: berkas peta atlas, 38 provinsi.", "Province boundaries: the atlas map file, 38 provinces.");
  }
  /* ------------------------------------------------------------------ DISTRICTS (PI 22 Oct, "agar layak digunakan"):
     values from the provincial health profiles, overall series and subgroups (a 7th row field indexing D.b), arrive with the indicator in F.district
     (pipeline/prov_district_data.py: only columns whose province total matched the national book, or that a review
     accepted). The national map draws assets/geo/id_kab.topo.json (514 kabupaten/kota with their Kemendagri codes) and a
     chosen province its own finer assets/geo/kab/<code>.topo.json: Kemendagri boundaries simplified for each scale with
     shared borders (pipeline/build_kab_geo.py; PI 24 Oct, the coarse map was "jelek sekali" at province scale). */
  const distOf = () => { const V = state.V; return V && V.g && V.g.F.district ? V.g.F.district[V.i.id] || null : null; };
  function parseKabTopo(t) {
    const sc = t.transform.scale, tr = t.transform.translate, K = 21.65, X0 = 94.9, Y0 = 6.3;
    const dp = sc[0] * K < 0.02 ? 3 : 2;   // a small province's file is finer than two decimals of the map unit
    const arcs = t.arcs.map((a) => { let x = 0, y = 0; return a.map((p) => { x += p[0]; y += p[1]; return [(x * sc[0] + tr[0] - X0) * K, (Y0 - (y * sc[1] + tr[1])) * K]; }); });
    const out = {};
    t.objects.kab.geometries.forEach((g) => {
      const polys = g.type === "Polygon" ? [g.arcs] : g.arcs || [];
      let d = "", x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      polys.forEach((poly) => poly.forEach((rg) => {
        const pts = [];
        rg.forEach((i) => { let a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; if (pts.length) a = a.slice(1); a.forEach((p) => pts.push(p)); });
        pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
        d += "M" + pts.map((p) => p[0].toFixed(dp) + " " + p[1].toFixed(dp)).join("L") + "Z";
      }));
      // f: the box of the district's largest part, which frames a province map (a far islet would shrink the mainland)
      const f = g.properties.f;
      out[String(g.properties.code)] = { d, b: [x0, y0, x1, y1], f: f ? [(f[0] - X0) * K, (Y0 - f[3]) * K, (f[2] - X0) * K, (Y0 - f[1]) * K] : null, s: !!g.properties.s };
    });
    return out;
  }
  // key "": the national file; a province code: that province's finer file, or the national one if it cannot load
  function loadKabTopo(key) {
    const C = state.kabTopo || (state.kabTopo = {});
    if (!C[key]) C[key] = (key ? getJson("assets/geo/kab/" + key + ".topo.json").then(parseKabTopo).catch(() => loadKabTopo(""))
      : getJson("assets/geo/id_kab.topo.json").then(parseKabTopo)).catch((e) => { delete C[key]; throw e; });
    return C[key];
  }
  const PROVCODE = {"52":"Nusa Tenggara Barat","73":"Sulawesi Selatan","65":"Kalimantan Utara","19":"Kepulauan Bangka Belitung","62":"Kalimantan Tengah","17":"Bengkulu","63":"Kalimantan Selatan","74":"Sulawesi Tenggara","15":"Jambi","36":"Banten","61":"Kalimantan Barat","14":"Riau","92":"Papua Barat","18":"Lampung","71":"Sulawesi Utara","51":"Bali","91":"Papua","72":"Sulawesi Tengah","81":"Maluku","53":"Nusa Tenggara Timur","34":"DI Yogyakarta","31":"DKI Jakarta","64":"Kalimantan Timur","13":"Sumatera Barat","32":"Jawa Barat","94":"Papua Tengah","76":"Sulawesi Barat","12":"Sumatera Utara","35":"Jawa Timur","95":"Papua Pegunungan","93":"Papua Selatan","16":"Sumatera Selatan","82":"Maluku Utara","21":"Kepulauan Riau","33":"Jawa Tengah","75":"Gorontalo","11":"Aceh","96":"Papua Barat Daya"};
  // an annex kept as an Excel workbook (Gorontalo 2017, 2018): its "page" is the sheet number
  const bookName = (sid) => { const p = sid.split("-"); return L("Profil Kesehatan Provinsi ", "Provincial Health Profile ") + (PROVCODE[p[1]] || p[1]) + " " + p[2] + (sid.endsWith("-lampiran") ? L(" (lampiran Excel; nomor halaman = nomor lembar)", " (Excel annex; page number = sheet number)") : ""); };
  // a data.go.id dataset (pipeline/sdi_extract.py): its title and publisher, and its page on the portal
  const srcName = (sid, D) => (sid.startsWith("sdi:") ? "data.go.id: " + ((D.srct && D.srct[sid] && D.srct[sid][0]) || sid.slice(4))
    : sid.startsWith("adm:") ? ((D.srct && D.srct[sid] && D.srct[sid][0]) || sid.slice(4)) : bookName(sid));
  // a source outside the books with its own page: data.go.id datasets and administrative data (adm:, SI-SDMK since 28 Oct)
  const extSrc = (sid) => sid.startsWith("sdi:") || sid.startsWith("adm:");
  // V.kp: "" is the whole country (the default, PI 22 Oct: "peta defaultnya peta kabupaten kota nasional"); a province
  // zooms the map to it and turns the area table under the chart into its districts
  function kabView() {
    const V = state.V, D = distOf(); if (!D) return null;
    const provOf = (r) => D.d[r[1]][2];
    // V.kb: the subgroup (plan step 4, 22 Oct): -1 the overall series, else an index into D.b; rows of other subgroups
    // never mix into the map
    const bOf = (r) => (r.length > 6 ? r[6] : -1), nb = {};
    D.rows.forEach((r) => { nb[bOf(r)] = (nb[bOf(r)] || 0) + 1; });
    // grouped by dimension (all causes together, then the age bands...), alphabetical within
    const dk = (s) => { try { return Object.keys(JSON.parse(s)).join(","); } catch (e) { return ""; } };
    const subs = (D.b || []).map((s, i) => ({ i, n: nb[i] || 0, label: bdText(s), dk: dk(s) })).filter((x) => x.n)
      .sort((a, b) => a.dk.localeCompare(b.dk) || a.label.localeCompare(b.label, "id", { numeric: true }));
    // districts per series: a book printing an indicator only by subgroup (Td coverage by dose, PI 23 Oct: "kenapa ini
    // sedikit sekali di level kabupaten kota") leaves the overall series thin; the panel then points to the fuller one
    const ndist = {}; D.rows.forEach((r) => { (ndist[bOf(r)] = ndist[bOf(r)] || new Set()).add(r[1]); });
    const nd = (i) => (ndist[i] ? ndist[i].size : 0);
    const fuller = subs.reduce((a, x) => (nd(x.i) > (a ? nd(a.i) : 0) ? x : a), null);
    // the series to open on when the viewer chose none: among the subgroups within 10% of the fullest, one without a
    // sex split (BCG before "BCG, laki-laki")
    const opener = fuller && (subs.filter((x) => nd(x.i) >= 0.9 * nd(fuller.i) && !/(^|,)sex(,|$)/.test(x.dk))
      .sort((a, b) => nd(b.i) - nd(a.i))[0] || fuller);
    const chosen = V.kb != null;
    let kb = chosen ? +V.kb : -1;
    if (kb >= 0 && !nb[kb]) kb = -1;
    // no overall series, or an overall series with less than half the districts of the fullest subgroup: open on the
    // fullest subgroup (PI 27 Oct, MNC-D1-023: "tab cuma district, itupun cuma Gorontalo"; immunisation counts by vaccine
    // have 72 overall values against thousands per vaccine)
    if (kb < 0 && opener && (!nb[-1] || (!chosen && nd(opener.i) > 2 * nd(-1)))) kb = opener.i;
    V.kb = String(kb);
    const rowsK = D.rows.filter((r) => bOf(r) === kb);
    const byProv = {};
    rowsK.forEach((r) => { (byProv[provOf(r)] = byProv[provOf(r)] || new Set()).add(r[0]); });
    const plist = Object.keys(byProv).sort((a, b) => a.localeCompare(b));
    if (V.kp && !byProv[V.kp]) V.kp = "";
    const pool = rowsK.filter((r) => !V.kp || provOf(r) === V.kp);
    const cnt = {};
    pool.forEach((r) => { cnt[r[0]] = (cnt[r[0]] || 0) + 1; });
    const years = Object.keys(cnt).map(Number).sort((a, b) => a - b);
    // "latest" (the default, PI 22 Oct "buatkan opsi latest year juga"): every district at its own most recent year,
    // so the map shows every district that has any value; or one chosen year
    if (V.ky !== "latest" && !years.includes(+V.ky)) V.ky = "latest";
    const latest = V.ky === "latest", y = latest ? null : +V.ky;
    const mk = (r) => ({ code: String(D.d[r[1]][0]), name: D.d[r[1]][1], prov: provOf(r), v: r[2], src: D.src[r[3]], page: r[4], st: r[5], y: r[0] });
    const lastOf = new Map();
    if (latest) pool.forEach((r) => { const c = lastOf.get(r[1]); if (!c || r[0] > c[0]) lastOf.set(r[1], r); });
    const rows = latest ? Array.from(lastOf.values()).map(mk) : pool.filter((r) => r[0] === y).map(mk);
    const sdiLinks = Array.from(new Set(rows.filter((r) => extSrc(r.src)).map((r) => r.src))).map((sid) => [srcName(sid, D), D.srct && D.srct[sid] ? D.srct[sid][1] : ""]);
    const nAny = new Set(pool.map((r) => r[1])).size;
    const tot = V.kp && !latest && kb < 0 ? D.tot.find((t) => t[0] === y && t[1] === V.kp) : null;
    const g = V.g, pi = V.kp && !latest && kb < 0 ? g.F.provinces.indexOf(V.kp) : -1;
    const nat = pi < 0 ? null : g.rows.find((r) => r.geo === 1 && r.prov === pi && r.y === y && r.v != null && r.cat + "." + sidOf(g.F, r.bd) === "-1.-1");
    const codes = V.kp ? new Set(D.d.filter((x) => x[2] === V.kp).map((x) => String(x[0]).slice(0, 2))) : null;
    const hint = kb === -1 && fuller && nd(fuller.i) > 2 * nd(-1)
      ? { i: fuller.i, label: fuller.label, n: nd(fuller.i), n0: nd(-1) } : null;
    return { D, plist, years, cnt, rows, all: pool.map(mk), codes, tot, nat, y, latest, nAny, sdiLinks, subs, kb, hint, nOverall: nb[-1] || 0,
      kbLabel: kb >= 0 ? bdText(D.b[kb]) : "" };
  }
  // a breakdown JSON as the chip text of the national chart: its values joined by a middle dot
  // the Rincian select groups its options under the dimension headings of the subgroup panel (24 Oct: the same wording
  // can stand in two dimensions, "bidan" as an occupation and as another kind, and looked like a duplicate)
  function kbGroups(subs) {
    const out = [];
    subs.forEach((x) => {
      const g = out[out.length - 1];
      if (g && g.dk === x.dk) g.items.push(x);
      else out.push({ dk: x.dk, head: x.dk ? x.dk.split(",").map(dimLabel).join(" \u00d7 ") : L("Lainnya", "Other"), items: [x] });
    });
    return out;
  }
  // the options of the Rincian select, narrowed by its search box (24 Oct: after the audit some indicators carry hundreds
  // of subgroups, health workers by occupation x facility x sex); the chosen one always stays in the list
  function kbOptions(K, V) {
    const q = norm(V.kbq || "");
    const opt = (v, lab) => '<option value="' + esc(v) + '"' + (String(v) === String(V.kb) ? " selected" : "") + ">" + esc(lab) + "</option>";
    const subs = K.subs.filter((x) => !q || norm(x.label).includes(q) || String(x.i) === String(V.kb));
    return (K.nOverall ? opt("-1", L("Keseluruhan", "Overall")) : "") + kbGroups(subs).map((g) => '<optgroup label="' + esc(g.head) + '">' + g.items.map((x) => opt(String(x.i), x.label)).join("") + "</optgroup>").join("");
  }
  function bdText(s) { try { return Object.values(JSON.parse(s)).join(" \u00b7 "); } catch (e) { return String(s); } }
  function kabMapSvg(paths, K, unit) {
    const sel = Object.keys(paths).filter((c) => !K.codes || K.codes.has(c.slice(0, 2)));
    if (!sel.length) return '<p class="src">' + L("Batas kabupaten/kota provinsi ini tidak ada di berkas peta.", "This province's district boundaries are not in the map file.") + "</p>";
    // a district of far, tiny islets (Kepulauan Seribu, `s` from pipeline/build_kab_geo.py) is drawn in an inset left of
    // its province: inside the frame it would shrink the mainland to a quarter and still show only specks
    const ins = K.codes ? sel.filter((c) => paths[c].s) : [], main = ins.length && ins.length < sel.length ? sel.filter((c) => !paths[c].s) : sel;
    const box = (cs) => { const q = [1e9, 1e9, -1e9, -1e9]; cs.forEach((c) => { const b = (K.codes && paths[c].f) || paths[c].b; q[0] = Math.min(q[0], b[0]); q[1] = Math.min(q[1], b[1]); q[2] = Math.max(q[2], b[2]); q[3] = Math.max(q[3], b[3]); }); return q; };
    let [x0, y0, x1, y1] = box(main), inset = null;
    if (main !== sel) {
      const ib = box(ins), e = Math.max(x1 - x0, y1 - y0), asp = (ib[3] - ib[1]) / Math.max(ib[2] - ib[0], 1e-9);
      // the label on lines of about ten letters without "Kab." (the tooltip keeps the full name), as large as the
      // frame's width allows: on a phone a one-line "Kab. Kepulauan Seribu" came out at 5 px
      const nm = ins.map((c) => { const x = K.D.d.find((d) => String(d[0]) === c); return x ? x[1] : c; }).join(", ");
      const lines = [];
      nm.replace(/^(Kab\.|Kabupaten)\s+/i, "").split(" ").forEach((wd) => { const l = lines.length - 1; if (l >= 0 && (lines[l] + " " + wd).length <= 11) lines[l] += " " + wd; else lines.push(wd); });
      const ml = Math.max(...lines.map((l) => l.length));
      let w = (x1 - x0) * 0.32, h = w * asp, fs = Math.min(e * 0.045, w / (0.56 * ml)), lab = fs * (1.2 * lines.length + 0.4);
      if (h > (y1 - y0) * 0.9 - lab) { h = (y1 - y0) * 0.9 - lab; w = h / asp; fs = Math.min(fs, w / (0.56 * ml)); lab = fs * (1.2 * lines.length + 0.4); }
      inset = { ib, x: x0 - w - e * 0.06, y: y0 + lab, w, h, nm, lines, fs, lab };
      x0 = inset.x;
    }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.02, sw = Math.max(x1 - x0, y1 - y0) / (K.codes ? 400 : 1600);
    const by = new Map(K.rows.map((r) => [r.code, r])), cls = classify(K.rows.map((r) => r.v));
    const tip = (r) => (r ? r.name + ": " + fval(r.v) + (unit ? " " + unit : "") + (K.latest ? " (" + r.y + ")" : "") : L("Tidak tercantum di tabel", "Not listed in the table"));
    const hs = (sw * (K.codes ? 6 : 3)).toFixed(3);
    let s = '<svg viewBox="' + (x0 - pad).toFixed(2) + " " + (y0 - pad).toFixed(2) + " " + (x1 - x0 + 2 * pad).toFixed(2) + " " + (y1 - y0 + 2 * pad).toFixed(2) + '" role="img" aria-label="' + esc(L("Peta nilai menurut kabupaten/kota", "Map of values by district") + (state.V.kp ? ", " + state.V.kp : "")) + '" class="pmap kmap' + (K.codes ? "" : " knat") + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><pattern id="khatch" width="' + hs + '" height="' + hs + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="' + hs + '" height="' + hs + '" fill="#f2f3f5"/><line x1="0" y1="0" x2="0" y2="' + hs + '" stroke="#c3c8cf" stroke-width="' + (sw * 1.5).toFixed(3) + '"/></pattern></defs>';
    main.forEach((c) => {
      const r = by.get(c);
      // nationally a click on a district opens its province
      s += '<path d="' + paths[c].d + '" fill="' + (r ? contColor(cls, r.v) : "url(#khatch)") + '" stroke="#ffffff" stroke-width="' + sw.toFixed(3) + '"' + (r && !K.codes ? ' data-a="kprov" data-k="' + esc(r.prov) + '"' : "") +
        ' data-t="' + esc(tip(r)) + '"/>';
    });
    if (inset) {
      // the islets keep their own scale inside a plain frame; a stroke in their own colour keeps them visible
      const ib = inset.ib, p = Math.max(ib[2] - ib[0], ib[3] - ib[1]) * 0.05, nm = inset.nm, fs = inset.fs;
      s += '<text font-size="' + fs.toFixed(3) + '" fill="#4a5361">' + inset.lines.map((l, i) => '<tspan x="' + inset.x.toFixed(3) + '" y="' + (inset.y - inset.lab + fs * (1.2 * i + 1)).toFixed(3) + '">' + esc(l) + "</tspan>").join("") + "</text>" +
        '<rect x="' + inset.x.toFixed(3) + '" y="' + inset.y.toFixed(3) + '" width="' + inset.w.toFixed(3) + '" height="' + inset.h.toFixed(3) + '" fill="none" stroke="#b9bfc7" stroke-width="' + sw.toFixed(3) + '"/>' +
        '<svg x="' + inset.x.toFixed(3) + '" y="' + inset.y.toFixed(3) + '" width="' + inset.w.toFixed(3) + '" height="' + inset.h.toFixed(3) + '" viewBox="' + (ib[0] - p).toFixed(3) + " " + (ib[1] - p).toFixed(3) + " " + (ib[2] - ib[0] + 2 * p).toFixed(3) + " " + (ib[3] - ib[1] + 2 * p).toFixed(3) + '">';
      ins.forEach((c) => {
        const r = by.get(c), fill = r ? contColor(cls, r.v) : "#c3c8cf";
        s += '<path d="' + paths[c].d + '" fill="' + fill + '" stroke="' + fill + '" stroke-width="2.5" stroke-linejoin="bevel" vector-effect="non-scaling-stroke" data-t="' + esc(r ? tip(r) : nm + ": " + tip(r)) + '"/>';
      });
      s += "</svg>";
    }
    return s + "</svg>";
  }
  function drawKabMapNow() {
    const V = state.V; if (!V || !$("#kmap")) return;
    const K0 = V.tab === "kab" ? kabView() : null; if (!K0) return;
    const keys = K0.codes ? Array.from(K0.codes).sort() : [""];
    Promise.all(keys.map(loadKabTopo)).then((ps) => {
      const el = $("#kmap"), K = state.V === V && V.tab === "kab" ? kabView() : null;
      // a later choice of province draws its own map; an earlier load finishing late must not overwrite it
      if (el && K && String(K.codes ? Array.from(K.codes).sort() : [""]) === String(keys)) el.innerHTML = kabMapSvg(Object.assign({}, ...ps), K, V.i.unit);
    })
      .catch(() => { const m = $("#kmap"); if (m) m.innerHTML = '<p class="src">' + L("Peta tidak dapat dimuat; nilai ada di tabel di bawah.", "The map could not be loaded; the values are in the table below.") + "</p>"; });
  }
  function kabPanelHtml() {
    const V = state.V, K = kabView(); if (!K) return "";
    const opt = (v, cur, lab) => '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + esc(lab) + "</option>";
    // each label stays with its select when the row wraps on a phone
    const ctl = '<div class="kabsel"><span class="kf"><label for="sel-kp">' + L("Provinsi", "Province") + '</label><select id="sel-kp" data-a="kp">' + opt("", V.kp, L("Semua provinsi", "All provinces")) + K.plist.map((p) => opt(p, V.kp, p)).join("") + "</select></span>" +
      '<span class="kf"><label for="sel-ky">' + L("Tahun", "Year") + '</label><select id="sel-ky" data-a="ky">' + opt("latest", V.ky, L("Tahun terbaru", "Latest year") + " (" + K.nAny + ")") + K.years.slice().reverse().map((y) => opt(y, V.ky, y + " (" + K.cnt[y] + ")")).join("") + "</select></span>" +
      (K.subs.length ? '<span class="kf"><label for="sel-kb">' + L("Rincian", "Breakdown") + '</label><select id="sel-kb" data-a="kb">' + kbOptions(K, V) + "</select></span>" : "") +
      (K.subs.length > 12 ? '<span class="kf"><label for="kbq">' + L("Cari rincian", "Search breakdowns") + '</label><input id="kbq" type="search" data-a="kbq" value="' + esc(V.kbq || "") + '" placeholder="' + L("Cari rincian", "Search breakdowns") + '"></span>' : "") + "</div>" +
      (K.hint ? '<p class="kbhint">' + L("Sebagian besar buku provinsi mencetak indikator ini menurut rincian. Keseluruhan tersedia untuk " + fint(K.hint.n0) + " kabupaten/kota; rincian " + esc(K.hint.label) + " untuk " + fint(K.hint.n) + ".",
        "Most provincial books print this indicator by breakdown. The overall series covers " + fint(K.hint.n0) + " districts; the " + esc(K.hint.label) + " breakdown covers " + fint(K.hint.n) + ".") +
        ' <button type="button" class="tl" data-a="kbgo" data-v="' + K.hint.i + '">' + L("Tampilkan " + esc(K.hint.label), "Show " + esc(K.hint.label)) + "</button></p>" : "");
    const st = new Set(K.rows.map((r) => r.st)), notes = [];
    if (K.tot) notes.push(L("Total provinsi di buku provinsi: ", "Province total in the provincial book: ") + fval(K.tot[2]) + (K.nat ? L("; di buku nasional: ", "; in the national book: ") + fval(K.nat.v) : "") + ".");
    if (st.has("a")) notes.push(L("Sebagian buku provinsi mencetak angka provinsi yang berbeda dari buku nasional; nilai kabupaten/kota ditampilkan seperti tercetak di buku provinsi.", "Some provincial books print a different province figure from the national book; district values are shown as printed in the provincial book."));
    if (st.has("s")) notes.push(L("Pada sebagian buku, tahun data digeser satu tahun dari tahun edisi, sesuai angka buku nasional.", "In some books the data year is one year from the edition year, as the national book shows."));
    if (st.has("f")) notes.push(L("Satuan disesuaikan dengan satuan indikator.", "The unit was converted to the indicator's unit."));
    if (st.has("t")) notes.push(L("Jumlah kabupaten/kota sama dengan total provinsi yang dicetak di tabel yang sama (selisih paling banyak 10%).", "The districts add up to the province total printed in the same table (at most 10% apart)."));
    if (st.has("o")) notes.push(L("Sebagian nilai tidak dapat diperiksa terhadap angka nasional atau total provinsi; ditampilkan seperti tercetak di buku provinsi.", "Some values cannot be checked against a national figure or a province total; they are shown as printed in the provincial book."));
    if (st.has("g") && V.i.district_only) notes.push(L("Sebagian nilai berasal dari data.go.id (Satu Data Indonesia), dari salinan dataset yang berisi angka yang sama; buku provinsi didahulukan bila mencetak kabupaten/kota dan tahun yang sama.", "Some values come from data.go.id (Satu Data Indonesia), from copies of a dataset that agree; the provincial book comes first where it prints the same district and year."));
    else if (st.has("g")) notes.push(L("Sebagian nilai berasal dari data.go.id (Satu Data Indonesia); dataset dipakai bila jumlah nilai kabupaten/kota sama dengan angka provinsi di buku nasional, dan buku provinsi tetap didahulukan.", "Some values come from data.go.id (Satu Data Indonesia); a dataset is used when its districts add up to the province figure in the national book, and the provincial book comes first."));
    const books = {};
    K.rows.forEach((r) => { (books[r.src] = books[r.src] || new Set()).add(r.page); });
    const bk = Object.keys(books);
    // a data.go.id dataset with a portal link is named once, as the link after the text
    const linked = (b) => extSrc(b) && K.D.srct && K.D.srct[b] && K.D.srct[b][1];
    const src = V.kp ? bk.filter((b) => !linked(b)).map((b) => srcName(b, K.D) + (extSrc(b) ? "" : ", " + L("hlm. ", "p. ") + Array.from(books[b]).sort((a, c) => a - c).join(", "))).join("; ")
      : bk.some((b) => !extSrc(b)) ? fint(bk.filter((b) => !extSrc(b)).length) + L(" buku Profil Kesehatan Provinsi; pilih provinsi untuk melihat buku dan halaman sumber", " provincial Health Profile books; pick a province for the books and pages") : "";
    const nprov = new Set(K.rows.map((r) => r.prov)).size;
    if (K.latest && K.rows.length) {
      const ys = K.rows.map((r) => r.y), a = Math.min(...ys), b = Math.max(...ys);
      notes.unshift(a === b ? L("Nilai terbaru tiap kabupaten/kota, semuanya tahun " + a + ".", "The most recent value of each district, all from " + a + ".")
        : L("Nilai terbaru tiap kabupaten/kota, tahun " + a + " sampai " + b + "; tahun setiap nilai ada di peta dan di tabel.", "The most recent value of each district, years " + a + " to " + b + "; each value's year is on the map and in the table."));
    }
    const when = K.latest ? L("terbaru", "most recent") : K.y;
    return vhead(V.kp ? L("Nilai " + when + " menurut kabupaten/kota, " + V.kp, (K.latest ? "Most recent values" : "Values in " + K.y) + " by district, " + V.kp) : L("Nilai " + when + " menurut kabupaten/kota", (K.latest ? "Most recent values" : "Values in " + K.y) + " by district"),
      V.kp ? L(fint(K.rows.length) + " kabupaten/kota tercantum; " + (K.kb >= 0 ? "rincian " + K.kbLabel : "keseluruhan" + (K.subs.length ? ", rincian dapat dipilih" : ", tanpa rincian")) + ". Daftar di bawah peta.", fint(K.rows.length) + " districts listed; " + (K.kb >= 0 ? "breakdown " + K.kbLabel : "overall" + (K.subs.length ? ", breakdowns can be chosen" : ", no breakdown")) + ". The list is below the map.")
        : L(fint(K.rows.length) + " kabupaten/kota dari " + nprov + " provinsi" + (K.kb >= 0 ? ", rincian " + K.kbLabel : "") + "; wilayah tanpa nilai diarsir. Pilih provinsi, atau ketuk kabupaten/kota di peta.", fint(K.rows.length) + " districts in " + nprov + " provinces" + (K.kb >= 0 ? ", breakdown " + K.kbLabel : "") + "; areas without a value are hatched. Pick a province, or tap a district on the map."), ctl) +
      '<div class="mapwrap kwrap"><div id="kmap"><p class="loading">' + L("Memuat peta...", "Loading the map...") + "</p></div>" +
      (K.rows.length ? '<div class="mleg inmap">' + (V.i.unit ? '<p class="mlt">' + esc(trunc(V.i.unit, 36)) + "</p>" : "") + kabLegend(K.rows.map((r) => r.v)) + "</div>" : "") + "</div>" +
      (notes.length ? '<p class="fs knote">' + notes.map(esc).join(" ") + "</p>" : "") +
      '<p class="src">' + L("Sumber: ", "Source: ") + (src ? esc(src) + ". " : "") + (K.sdiLinks.length ? K.sdiLinks.filter((x) => x[1]).map((x) => '<a href="' + esc(x[1]) + '" rel="noopener" target="_blank">' + esc(x[0]) + "</a>").join("; ") + (K.sdiLinks.some((x) => x[1]) ? ". " : "") : "") + L("Batas kabupaten/kota: 514 wilayah, kode Kemendagri.", "District boundaries: 514 areas, Ministry of Home Affairs codes.") + ' <a href="#/metode/subnasional">' + L("Data subnasional", "Subnational data") + "</a></p>";
  }
  // the colour scale of the district map, the province map's own legend without its province count
  function kabLegend(vals) {
    const S = scaleOf(classify(vals)), stops = MAPRAMP.map((c, k) => c + " " + Math.round((k / (MAPRAMP.length - 1)) * 100) + "%").join(", ");
    const mid = S.log && S.hi > S.lo ? '<em style="left:50%">' + fval(Math.round(S.at(0.5))) + "</em>" : "";
    return '<span class="mgrad"><b>' + fval(S.lo) + '</b><i style="background:linear-gradient(90deg, ' + stops + ')">' + mid + "</i><b>" + fval(S.hi) + "</b></span>" + (S.log ? '<span class="mlog">' + L("skala logaritmik", "log scale") + "</span>" : "") +
      '<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="0.5" y="0.5" width="13" height="13" fill="#ffffff" stroke="#c5ccd4"/><path d="M0 14L14 0M-4 10L10-4M4 18L18 4" stroke="#c5ccd4" stroke-width="2"/></svg>' + L("tidak tercantum", "not listed") + "</span>";
  }
  // under the chart: the districts of the chosen province, replacing the province list (PI 22 Oct)
  function kabTableHtml() {
    const V = state.V, K = kabView(); if (!K || !V.kp) return "";
    const series = {};
    K.all.forEach((r) => { (series[r.code] = series[r.code] || { name: r.name, pts: [] }).pts.push(r); });
    const cur = new Map(K.rows.map((r) => [r.code, r]));
    const list = Object.keys(series).map((c) => ({ c, name: series[c].name, pts: series[c].pts.sort((a, b) => a.y - b.y), r: cur.get(c) || null }));
    list.sort((a, b) => (a.r && b.r ? b.r.v - a.r.v : a.r ? -1 : b.r ? 1 : a.name.localeCompare(b.name, "id")));
    const xs = K.all.map((r) => r.y), xr = [Math.min.apply(null, xs), Math.max.apply(null, xs)], sp = xr[1] > xr[0];
    const head = "<tr><th>" + L("Kabupaten/kota", "District") + '</th><th class="r">' + L("Tahun", "Year") + '</th><th class="r">' + L("Nilai", "Value") + "</th>" + (sp ? "<th>" + L("Deret ", "Series ") + xr[0] + " " + L("sampai", "to") + " " + xr[1] + "</th>" : "") + "</tr>";
    const body = list.map((e) => '<tr class="arow"><td>' + esc(e.name) + '</td><td class="r">' + (e.r ? e.r.y : "") + '</td><td class="r nw">' + (e.r ? "<b>" + fval(e.r.v) + "</b>" : '<span class="no">' + L("tidak tercantum", "not listed") + "</span>") + "</td>" +
      (sp ? '<td class="sp">' + sparkSvg(e.pts.map((x) => ({ x: x.y, y: x.v, seg: 0 })), e.r ? e.r.y : null, 120, 26, xr, "all") + "</td>" : "") + "</tr>").join("");
    const sub = K.kb >= 0 ? " (" + K.kbLabel + ")" : "";
    return '<div class="ahd"><h2>' + (K.latest ? L("Nilai terbaru menurut kabupaten/kota, " + V.kp + sub, "Most recent values by district, " + V.kp + sub) : L("Nilai " + K.y + " menurut kabupaten/kota, " + V.kp + sub, "Values in " + K.y + " by district, " + V.kp + sub)) + '</h2><p class="fs">' + L("Diurutkan dari nilai tertinggi; deret menurut tahun data buku provinsi.", "Ranked from the highest value; series by the data year of the provincial books.") + "</p></div>" +
      '<div' + (sp ? ' data-hint="' + swipeHint() + '"' : "") + ' class="tw atw" tabindex="0"><table class="t at' + (sp ? "" : " nosp") + '"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }
  // the chart or map on screen as an image (PI 26 Oct, after OWID's Download): its title, the area, the source and the ARC
  // mark, as SVG or as PNG at twice the size; open to everyone, since the image holds only what the page already shows
  const imgMenu = () => '<details class="imgdd"><summary class="btn sm ol" title="' + L("Unduh gambar grafik atau peta", "Download the chart or map as an image") + '">' + ICON.dl + "<span>" + L("Gambar", "Image") + "</span></summary>" +
    '<div class="imgmenu" role="menu"><button type="button" role="menuitem" data-a="img" data-k="png">PNG <small>' + L("gambar, untuk slide dan dokumen", "picture, for slides and documents") + '</small></button>' +
    '<button type="button" role="menuitem" data-a="img" data-k="svg">SVG <small>' + L("vektor, dapat disunting", "vector, editable") + "</small></button></div></details>";
  async function logoData() {
    if (state._logo) return state._logo;
    try {
      const b = await (await fetch("assets/arc-logo.png")).blob();
      state._logo = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(""); r.readAsDataURL(b); });
    } catch (e) { state._logo = ""; }
    return state._logo;
  }
  const xesc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // words onto at most n lines of about c characters
  function wrapText(t, c, n) {
    const out = []; let line = "";
    String(t || "").split(/\s+/).filter(Boolean).forEach((w) => { if ((line + " " + w).trim().length > c && line) { out.push(line); line = w; } else line = (line + " " + w).trim(); });
    if (line) out.push(line);
    if (out.length > n) { out.length = n; out[n - 1] = out[n - 1].replace(/\s*\S*$/, "") + " ..."; }
    return out;
  }
  // a PNG with its resolution stated: a pHYs chunk (pixels per metre, both axes) right after IHDR
  function pngDpi(u8, dpi) {
    const ppm = Math.round(dpi / 0.0254), T = pngDpi.t || (pngDpi.t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
    const crc = (bytes) => { let c = 0xffffffff; for (const x of bytes) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const ch = new Uint8Array(21), dv = new DataView(ch.buffer);
    dv.setUint32(0, 9); ch.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); ch[16] = 1;
    dv.setUint32(17, crc(ch.subarray(4, 17)));
    const at = 33;   // 8-byte signature + IHDR (4 length + 4 type + 13 data + 4 crc)
    const out = new Uint8Array(u8.length + 21); out.set(u8.subarray(0, at)); out.set(ch, at); out.set(u8.subarray(at), at + 21);
    return out;
  }
  async function chartImage(fmt) {
    const V = state.V, p = $("#vpanel"); if (!V || !p) return;
    const sv = p.querySelector("#chart svg, #barbox svg, #bdbars svg, #map svg, #kmap svg");
    if (!sv) { toast(L("Grafik belum selesai dimuat.", "The chart has not finished loading.")); return; }
    const vb = (sv.getAttribute("viewBox") || "0 0 800 400").split(/\s+/).map(Number);
    const W = 1000, pad = 32, cw = W - pad * 2, chH = Math.round((vb[3] / vb[2]) * cw), isMap = !!sv.closest("#map, #kmap");
    const ft = p.querySelector(".ft2, .mt h3, h3"), fs = p.querySelector(".vhead .fs, .fs");
    const title = wrapText(indName(V.i), 70, 2), sub = wrapText([ft ? ft.textContent.trim() : "", fs ? fs.textContent.trim() : ""].filter(Boolean).join(" · "), 115, 2);
    let y = 48, g = "";
    title.forEach((t) => { g += '<text x="' + pad + '" y="' + y + '" font-family="Georgia,Times New Roman,serif" font-size="25" fill="#002147">' + xesc(t) + "</text>"; y += 31; });
    sub.forEach((t) => { g += '<text x="' + pad + '" y="' + (y - 4) + '" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#3f4b59">' + xesc(t) + "</text>"; y += 20; });
    y += 10;
    const clone = sv.cloneNode(true);
    clone.removeAttribute("style"); clone.removeAttribute("class");
    ["x", "y", "width", "height"].forEach((k, j) => clone.setAttribute(k, [pad, y, cw, chH][j]));
    // XML, not HTML: outerHTML writes the axis labels' no-break space as &nbsp;, which no SVG image accepts (PI 28 Oct:
    // the PNG of HRF-01-031, values in "rb", could not be downloaded)
    g += new XMLSerializer().serializeToString(clone);
    y += chH + 16;
    // the map's colour scale, drawn from the legend on the page
    const lg = isMap ? p.querySelector(".mleg") : null;
    if (lg) {
      const bs = lg.querySelectorAll(".mgrad b"), unit = lg.querySelector(".mlt"), log = lg.querySelector(".mlog");
      g += '<defs><linearGradient id="xg">' + MAPRAMP.map((c, k) => '<stop offset="' + Math.round((k / (MAPRAMP.length - 1)) * 100) + '%" stop-color="' + c + '"/>').join("") + "</linearGradient></defs>";
      let x = pad;
      if (unit) { g += '<text x="' + x + '" y="' + (y + 13) + '" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#3f4b59">' + xesc(unit.textContent.trim()) + "</text>"; y += 20; }
      if (bs.length >= 2) {
        g += '<text x="' + x + '" y="' + (y + 13) + '" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#162230">' + xesc(bs[0].textContent) + "</text>";
        x += 12 + bs[0].textContent.length * 7.5;
        g += '<rect x="' + x + '" y="' + (y + 2) + '" width="220" height="14" fill="url(#xg)"/>';
        x += 230;
        g += '<text x="' + x + '" y="' + (y + 13) + '" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#162230">' + xesc(bs[1].textContent) + "</text>";
        x += 20 + bs[1].textContent.length * 7.5;
        if (log) { g += '<text x="' + x + '" y="' + (y + 13) + '" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#3f4b59">' + xesc(log.textContent.trim()) + "</text>"; x += 20 + log.textContent.length * 7; }
        g += '<rect x="' + x + '" y="' + (y + 2) + '" width="14" height="14" fill="#ffffff" stroke="#c5ccd4"/><path d="M' + x + " " + (y + 16) + "l14 -14" + '" stroke="#c5ccd4" stroke-width="2"/>' +
          '<text x="' + (x + 20) + '" y="' + (y + 13) + '" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#3f4b59">' + xesc(L("tidak tercantum", "not listed")) + "</text>";
        y += 26;
      }
    }
    if (V.tab === "line") { g += '<text x="' + pad + '" y="' + (y + 12) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59">' + xesc(L("Titik penuh: terverifikasi. Titik kosong: belum terverifikasi.", "Filled point: verified. Hollow point: not yet verified.")) + "</text>"; y += 20; }
    y += 6;
    g += '<line x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '" stroke="#d8ded8"/>';
    y += 20;
    const srcs = V.i.sources && V.i.sources.length ? L("Sumber: ", "Source: ") + V.i.sources.join("; ") + "." : "";
    wrapText(srcs, 140, 2).forEach((t) => { g += '<text x="' + pad + '" y="' + y + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59">' + xesc(t) + "</text>"; y += 17; });
    const url = "arcinstitute.or.id/tools/profil-kesehatan-indonesia/app/indikator/" + V.i.id + "/";
    g += '<text x="' + pad + '" y="' + y + '" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#3f4b59">' + xesc(L("Atlas Indikator Profil Kesehatan Indonesia, ARC Institute · ", "Indonesia Health Profile Indicator Atlas, ARC Institute · ") + url + " · CC BY 4.0") + "</text>";
    const H = y + 22, logo = await logoData();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' +
      '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>' + (logo ? '<image href="' + logo + '" x="' + (W - pad - 54) + '" y="18" width="54" height="54"/>' : "") + g + "</svg>";
    const name = "profil-kesehatan_" + V.i.id + "_" + V.tab + (V.tab === "map" && V.py ? "_" + V.py : "");
    if (fmt === "svg") { saveBlob(svg, name + ".svg", "image/svg+xml;charset=utf-8"); return; }
    const img = new Image();
    // high resolution (PI 28 Oct: "download png harusnya high dpi"): drawn at 4x (4,000 px wide) and stamped 300 dpi
    // (a pHYs chunk), so Word, slides and print take it at full quality
    const SC = 4;
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = W * SC; c.height = H * SC;
      const cx = c.getContext("2d"); cx.scale(SC, SC); cx.drawImage(img, 0, 0, W, H);
      c.toBlob(async (b) => {
        let out = b;
        try { out = new Blob([pngDpi(new Uint8Array(await b.arrayBuffer()), 300)], { type: "image/png" }); } catch (e) { /* keep the plain PNG */ }
        const a = document.createElement("a"); a.href = URL.createObjectURL(out); a.download = name + ".png"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }, "image/png");
    };
    img.onerror = () => toast(L("Gambar PNG tidak dapat dibuat; coba SVG.", "The PNG could not be made; try SVG."));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function cardHtml() {
    const V = state.V, { i, g } = V, off = tabOff(), area = esc(regionLabel(g, V.region));
    const printed = i.sources && i.sources.length ? L("Sumber: ", "Source: ") + esc(i.sources.join("; ")) + ". " : "";
    const tabs = '<div class="vtabs"><div class="vtl" role="tablist" aria-label="' + L("Tampilan nilai", "View of the values") + '">' + TABS().filter(([k]) => !i.district_only || k === "kab").map(([k, lab]) => '<button type="button" role="tab" id="vt-' + k + '" data-a="tab" data-k="' + k + '" aria-controls="vpanel" aria-selected="' + (V.tab === k) + '" tabindex="' + (V.tab === k ? 0 : -1) + '"' +
      (off[k] ? ' aria-disabled="true" class="off" title="' + esc(off[k]) + '"' : k === "map" && (V.tab === "line" || V.tab === "bar") ? ' class="glow"' : "") + "><span>" + lab + "</span>" + (off[k] ? "<small>" + esc(off[k]) + "</small>" : "") + "</button>").join("") + "</div>" +
      '<span class="vtool">' + imgMenu() + (document.fullscreenEnabled ? '<button type="button" class="btn sm ol vfs" data-a="fs" title="' + L("Layar penuh", "Full screen") + '" aria-label="' + L("Layar penuh", "Full screen") + '">' + ICON.full + "</button>" : "") + '<button type="button" class="btn sm ol" data-a="copylink" title="' + L("Salin tautan tampilan ini", "Copy the link to this view") + '" aria-label="' + L("Salin tautan tampilan ini", "Copy the link to this view") + '">' + ICON.link + "<span>" + L("Salin tautan", "Copy the link") + "</span></button></span></div>";
    let body = "";
    if (V.tab === "line") {
      const noYear = currentSeriesRows().filter((r) => r.y == null).length;
      const cmpLab = cmpOn() ? (() => { const s = provSeries().find((x) => x.key === cmpKey()), lb = s && s.label !== L("Nilai utama", "Main value") ? s.label + ". " : ""; return lb + L("Membandingkan " + V.cmp.length + " wilayah: ", "Comparing " + V.cmp.length + " areas: ") + V.cmp.map((k) => regionLabel(g, k)).join(", ") + "."; })() : "";
      body = vhead(L("Deret menurut tahun pengamatan", "Series by year of observation"), cmpOn() ? esc(cmpLab) : area + ".", cmpOn() ? "" : regionSelect()) + '<div id="chart" class="chartbox"></div>' + rangeHtml() +
        '<div class="clegend"><span><span class="dot"></span>' + L("Titik penuh: terverifikasi", "Filled point: verified") + '</span><span><span class="dot hollow"></span>' + L("Titik kosong: belum terverifikasi", "Hollow point: not yet verified") + "</span></div>" +
        srcLine(printed + (noYear ? " " + L(fint(noYear) + " nilai tanpa tahun tercetak hanya ada di tabel nilai dan CSV.", fint(noYear) + " values without a printed year appear only in the values table and the CSV.") : ""));
    } else if (V.tab === "bar") {
      const m = barMode(), ser = seriesOf(g, V.region);
      if (m === "year") {
        const s = ser.find((x) => x.key === V.sel[0]), lbl = s && ser.length > 1 ? shortLabels(ser).get(s.key) || s.label : "";
        body = vhead(L("Nilai menurut tahun pengamatan", "Values by year of observation"), area + (lbl ? ", " + esc(lbl) : "") + ". " + L("Satu batang per tahun; batang abu-abu: nilai belum terverifikasi.", "One bar per year; a grey bar is a value not yet verified."), regionSelect()) +
          '<div id="barbox" class="chartbox"></div>' + rangeHtml() + srcLine(printed + L("Arahkan penunjuk ke batang, atau ketuk, untuk melihat nilai, buku dan halaman sumber.", "Hover over or tap a bar for its value, book and page."));
      } else {
        const seg = V.hasProv ? '<div class="seg bseg" role="group" aria-label="' + L("Isi grafik batang", "What the bars show") + '"><button type="button" data-a="bmode" data-k="bd" aria-pressed="' + (m === "bd") + '">' + L("Menurut rincian", "By breakdown") + '</button><button type="button" data-a="bmode" data-k="prov" aria-pressed="' + (m === "prov") + '">' + L("Provinsi berurutan", "Provinces ranked") + "</button></div>" : "";
        if (m === "bd") body = vhead(L("Nilai " + V.years[0] + " menurut rincian", "Values in " + V.years[0] + " by breakdown"), area + ". " + L("Indikator ini tercetak untuk satu tahun saja, jadi rincian indikator dibandingkan berdampingan, bukan sebagai deret.", "This indicator is printed for one year only, so its breakdowns are compared side by side, not as a series."), regionSelect()) +
          seg + '<div id="bdbars"></div>' + srcLine(printed + L("Batang abu-abu: nilai belum terverifikasi.", "A grey bar is a value not yet verified."));
        else {
          const pv = provView();
          body = vhead(L("Nilai " + V.py + " menurut provinsi, berurutan", "Values in " + V.py + " by province, ranked"), L(fint(pv.yrRows.length) + " provinsi tercantum; batang abu-abu: nilai belum terverifikasi.", fint(pv.yrRows.length) + " provinces listed; a grey bar is a value not yet verified.")) +
            seg + '<div id="barbox" class="chartbox"></div>' + srcLine(mapSrcText(pv));
        }
      }
    } else if (V.tab === "kab") {
      body = kabPanelHtml();
    } else {
      const pv = provView();
      body = '<div id="mpanel">' + mapPanelHtml(pv) + "</div>" + pyHtml(pv) + srcLine(mapSrcText(pv));
    }
    return '<section class="vcard" id="f-series" aria-label="' + L("Grafik dan peta nilai", "Chart and map of the values") + '"><span id="prov" class="anc"></span>' + tabs + '<div class="vpanel" id="vpanel" role="tabpanel" aria-labelledby="vt-' + V.tab + '">' + body + "</div></section>";
  }
  function shortLabels(ser) { const m = new Map(); chipGroups(ser).groups.forEach((gp) => gp.items.forEach((it) => m.set(it.s.key, it.label))); return m; }
  /* the national row and every province for one breakdown (PI 22 Oct, as the World Bank country table): most recent
     year and value, or the map's year on the Peta tab, and a sparkline of the area's years. A row opens that area */
  function areaRows(key, year) {
    const V = state.V, g = V.g, m = new Map();
    keyRows(g, key).forEach((r) => {
      if (r.y == null || r.v == null || (r.geo !== 0 && r.geo !== 1)) return;
      const reg = regionOf(r); let e = m.get(reg);
      if (!e) m.set(reg, (e = { reg, label: regionLabel(g, reg), rows: [] }));
      e.rows.push(r);
    });
    const out = Array.from(m.values());
    out.forEach((e) => { e.rows.sort((a, b) => a.y - b.y); e.row = year == null ? e.rows[e.rows.length - 1] : e.rows.find((r) => r.y === year) || null; });
    return out;
  }
  // the change column of the area table (PI 26 Oct, after OWID's Table tab): against the area's first year in the same
  // definition period, never across a change of definition
  function chgCell(rows, r) {
    if (!r) return "";
    const base = rows.find((x) => x.per === r.per && x.y < r.y && x.v != null);
    if (!base) return "";
    const d = Math.round((r.v - base.v) * 100) / 100;
    return (d > 0 ? "+" : d < 0 ? "\u2212" : "") + fval(Math.abs(d)) + "<small>" + L("sejak ", "since ") + base.y + "</small>";
  }
  function areaTableHtml() {
    const V = state.V, { i, g } = V, onMap = V.tab === "map", A = areaRows(V.pk, onMap ? +V.py : null);
    if (!A.length) return "";
    const dir = V.pdir, nat = A.filter((e) => e.reg === "N"), rest = A.filter((e) => e.reg !== "N");
    rest.sort(V.psort === "n" ? (a, b) => dir * a.label.localeCompare(b.label, "id")
      : (a, b) => (a.row && b.row ? dir * (a.row.v - b.row.v) || a.label.localeCompare(b.label, "id") : a.row ? -1 : b.row ? 1 : a.label.localeCompare(b.label, "id")));
    const xs = A.flatMap((e) => e.rows.map((r) => r.y)), xr = [Math.min.apply(null, xs), Math.max.apply(null, xs)], jm = joinMode(i);
    const sp = xr[1] > xr[0];  // one year only: no series to draw, so no sparkline column
    const allS = V.hasProv ? provSeries() : seriesOf(g, V.region), s = allS.find((x) => x.key === V.pk);
    const lbl = s && s.label !== L("Nilai utama", "Main value") ? s.label : "";
    // a series that stops years before the indicator's newest data (PI 27 Oct, MNC-01-012 "Keseluruhan": every
    // province's latest year read 2002 while the vaccines run to 2025): say so and offer the newest series
    const lastY = (x) => x.rows.reduce((m, r) => (r.y != null && r.v != null && r.y > m ? r.y : m), -Infinity);
    const newest = allS.reduce((a, x) => { const l = lastY(x); return !a || l > a.l || (l === a.l && x.n > a.s.n) ? { s: x, l } : a; }, null);
    const stale = !onMap && s && newest && newest.s.key !== s.key && newest.l - xr[1] >= 4 ? newest : null;
    const nm = (x) => (x.label === L("Nilai utama", "Main value") ? L("Keseluruhan", "Overall") : x.label);
    const arrow = (k) => (V.psort === k ? (V.pdir > 0 ? " ↑" : " ↓") : "");
    const asort = (k) => (V.psort === k ? ' aria-sort="' + (V.pdir > 0 ? "ascending" : "descending") + '"' : "");
    const head = "<tr><th" + asort("n") + '><button type="button" data-a="psort" data-k="n">' + L("Wilayah", "Area") + arrow("n") + '</button></th><th class="r">' + (onMap ? L("Tahun", "Year") : L("Tahun terbaru", "Most recent year")) + '</th><th class="r"' + asort("v") + '><button type="button" data-a="psort" data-k="v">' + (onMap ? L("Nilai " + V.py, "Value " + V.py) : L("Nilai terbaru", "Most recent value")) + arrow("v") + "</button></th>" +
      (sp ? '<th class="r" title="' + L("Selisih dengan tahun pertama wilayah itu dalam periode definisi yang sama", "Difference from the area's first year within the same definition period") + '">' + L("Perubahan", "Change") + "</th>" : "") +
      (sp ? "<th>" + L("Deret ", "Series ") + xr[0] + " " + L("sampai", "to") + " " + xr[1] + "</th>" : "") + "</tr>";
    // the highest and the lowest province carry a mark, whatever the sort
    const wv = rest.filter((e) => e.row && e.reg !== "O"), hiE = wv.length > 2 ? wv.reduce((a, c) => (c.row.v > a.row.v ? c : a)) : null, loE = wv.length > 2 ? wv.reduce((a, c) => (c.row.v < a.row.v ? c : a)) : null;
    const row = (e) => {
      const r = e.row, on = e.reg === V.region;
      return '<tr class="arow' + (on ? " on" : "") + (e.reg === "N" ? " nat" : "") + '" data-reg="' + e.reg + '"><td><button type="button" class="alink" data-a="area" data-k="' + e.reg + '"' + (on ? ' aria-current="true"' : "") + ">" + esc(e.label) + "</button>" + (e === hiE ? '<i class="hb hi">' + L("tertinggi", "highest") + "</i>" : e === loE && loE !== hiE ? '<i class="hb lo">' + L("terendah", "lowest") + "</i>" : "") + "</td>" +
        '<td class="r">' + (r ? r.y : "") + '</td><td class="r nw">' + (r ? "<b>" + fval(r.v) + "</b>" + (r.ver ? "" : ' <span class="sq sm hollow" title="' + L("belum terverifikasi", "not yet verified") + '"></span>') : '<span class="no">' + L("tidak tercantum", "not listed") + "</span>") + "</td>" +
        (sp ? '<td class="r nw chg">' + chgCell(e.rows, r) + "</td>" : "") +
        (sp ? '<td class="sp">' + sparkSvg(e.rows.map((x) => ({ x: x.y, y: x.v, seg: x.per })), r ? r.y : null, 120, 26, xr, jm) + "</td>" : "") + "</tr>";
    };
    return '<div class="ahd"><h2>' + (onMap ? L("Nilai " + V.py + " menurut wilayah", "Values in " + V.py + " by area") : L("Nilai terbaru menurut wilayah", "Most recent value by area")) + '</h2><p class="fs">' + (lbl ? esc(lbl) + ". " : "") +
      "</p>" + (stale ? '<p class="kbhint">' + L("Rincian " + esc(nm(s)) + " hanya sampai tahun " + xr[1] + ". Data terbaru indikator ini, tahun " + stale.l + ", ada pada rincian " + esc(nm(stale.s)) + ".",
        "The " + esc(nm(s)) + " series ends in " + xr[1] + ". This indicator's newest data, for " + stale.l + ", is in the " + esc(nm(stale.s)) + " series.") +
        ' <button type="button" class="tl" data-a="pkset" data-k="' + esc(stale.s.key) + '">' + L("Tampilkan " + esc(nm(stale.s)), "Show " + esc(nm(stale.s))) + "</button></p>" : "") + "</div>" +
      '<div' + (sp ? ' data-hint="' + swipeHint() + '"' : "") + ' class="tw atw" tabindex="0" aria-label="' + L("Nilai menurut wilayah, gulir tabel", "Values by area, scroll the table") + '"><table class="t at' + (sp ? "" : " nosp") + '"><thead>' + head + "</thead><tbody>" + nat.concat(rest).map(row).join("") + "</tbody></table></div>";
  }
  function mapSvg(paths, byName, cls, unit, hid, click) {
    let s = '<svg viewBox="0 0 1000 377" role="img" aria-label="' + esc(L("Peta nilai menurut provinsi; provinsi yang tidak tercantum di tabel diarsir", "Map of values by province; provinces not listed in the table are hatched")) + '" class="pmap" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="' + hid + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#c5ccd4" stroke-width="2"/></pattern></defs>';
    Object.keys(paths).forEach((name) => {
      const r = byName.get(name);
      const fill = r ? contColor(cls, r.v) : "url(#" + hid + ")";
      s += '<path d="' + paths[name] + '" fill="' + fill + '" stroke="#ffffff" stroke-width="0.6" data-prov="' + esc(name) + '"' + (click && r && r.prov != null ? ' data-a="area" data-k="P' + r.prov + '"' : "") + ' data-t="' + esc(name + ": " + (r ? fval(r.v) + (unit ? " " + unit : "") : L("tidak tercantum di tabel", "not listed in the table"))) + '"></path>';
    });
    return s + "</svg>";
  }
  function drawMapNow() {
    const V = state.V; if (!V || !$("#map") || state.topoPaths) return;
    loadTopo().then((paths) => {
      state.topoPaths = paths;
      const el = $("#map"), pv = state.V === V && V.tab === "map" ? provView() : null;
      if (el && pv) el.innerHTML = mapSvg(paths, byNameOf(pv), classify(pv.yrRows.map((r) => r.v)), V.i.unit, "hatch", true);
    }).catch(() => { const m = $("#map"); if (m) m.innerHTML = '<p class="src">' + L("Peta tidak dapat dimuat; nilai ada di tabel.", "The map could not be loaded; the values are in the table.") + "</p>"; });
  }
  function drawCharts() {
    const V = state.V; if (!V) return;
    const { i, g } = V, ser = seriesOf(g, V.region), sp = V.sp, inYr = (p) => !sp || (p.x >= sp[0] && p.x <= sp[1]);
    const box = $("#chart");
    if (box) {
      const short = shortLabels(ser);
      const ck = cmpOn() ? cmpKey() : null, crows = ck ? keyRows(g, ck) : null;
      const series = ck ? V.cmp.map((reg, x) => { const t = toSeries(g, { key: reg, label: regionLabel(g, reg), rows: crows.filter((r) => regionOf(r) === reg) }, PALETTE[x % PALETTE.length], i); t.pts = t.pts.filter(inYr); return t; }).filter((t) => t.pts.length)
        : V.sel.map((k, x) => { const s = ser.find((q) => q.key === k); if (!s) return null; const t = toSeries(g, s, PALETTE[x % PALETTE.length], i); t.pts = t.pts.filter(inYr); return t; }).filter(Boolean);
      // a line is named at its end: the breakdown, or the area when the indicator has no breakdowns or areas are compared
      const isAll = (s) => s.name === L("Nilai utama", "Main value") || short.get(s.key) === L("Keseluruhan", "Overall");
      const labels = series.map((s) => (ck ? s.name : ser.length === 1 || isAll(s) ? regionLabel(g, V.region) : short.get(s.key) || s.name));
      const w = Math.max(280, box.clientWidth || 700);
      // the province range (PI comment 25 Oct): on the national view of one series, each year that prints at least five
      // provinces gives its highest and lowest province; a band point takes the definition period of the national point
      let band = null;
      // not for counts or money totals: a province's count is a part of the national one, not a comparable level
      if (V.region === "N" && series.length === 1 && !["count", "currency"].includes(i.measure)) {
        const per = new Map(), segOf = new Map(series[0].pts.map((p) => [p.x, p.seg]));
        keyRows(g, V.sel[0]).forEach((r) => {
          if (r.geo !== 1 || r.y == null || r.v == null || !inYr({ x: r.y })) return;
          let e = per.get(r.y); if (!e) per.set(r.y, (e = new Map()));
          if (!e.has(r.prov)) e.set(r.prov, r);
        });
        const bp = [];
        per.forEach((m, y) => {
          if (m.size < 5) return;
          const rs = Array.from(m.values()).sort((a, b) => a.v - b.v), lo = rs[0], hi = rs[rs.length - 1];
          bp.push({ x: y, lo: lo.v, hi: hi.v, loN: g.F.provinces[lo.prov], hiN: g.F.provinces[hi.prov], seg: segOf.has(y) ? segOf.get(y) : "y" + y });
        });
        if (bp.length) band = bp;
      }
      // in full screen the chart takes the height the screen leaves
      const fh = document.fullscreenElement ? Math.max(400, Math.round(window.innerHeight - 330)) : 0;
      box.innerHTML = lineChart({ w, h: fh || (w < 520 ? 300 : 400), series, labels, band, xr: sp, join: joinMode(i), bounds: periodBounds(i), unit: i.unit, aria: indName(i) + ", " + regionLabel(g, V.region) });
    }
    const bb = $("#bdbars");
    if (bb) {
      const { common, groups } = chipGroups(ser);
      const w = Math.max(280, bb.clientWidth || 700);
      const val = (it) => it.s.rows.find((r) => r.v != null);
      const all = groups.flatMap((gp) => gp.items.map(val)).filter(Boolean).map((r) => r.v);
      const max = Math.max.apply(null, all.concat([0])) || 1;  // one scale for every group, so the groups compare
      const shown = groups.slice(0, 12);
      bb.innerHTML = commonNote(common) + shown.map((gp, k) => {
        const rows = gp.items.slice(0, 40).map((it) => { const r = val(it); return r ? { label: it.label, value: r.v, text: fval(r.v), color: r.ver ? "#002147" : "#9aa6b2" } : null; }).filter(Boolean);
        return rows.length ? '<div class="bdg"><p class="cglab">' + esc(groupHead(gp)) + "</p>" + barChart({ w, rows, max, xTitle: k === shown.length - 1 ? i.unit || "" : "", labelW: 170, rowH: 24, aria: indName(i) + ", " + groupHead(gp) }) + "</div>" : "";
      }).join("");
    }
    const cb = $("#barbox");
    if (cb) {
      const w = Math.max(280, cb.clientWidth || 700);
      if (barMode() === "prov") {
        const pv = provView(), rows = pv ? pv.yrRows.slice().sort((a, b) => b.v - a.v) : [];
        cb.innerHTML = barChart({ w, rows: rows.map((r) => ({ label: g.F.provinces[r.prov], value: r.v, text: fval(r.v), color: r.ver ? "#002147" : "#9aa6b2" })), xTitle: i.unit || "", labelW: 160, rowH: 22, aria: indName(i) + ", " + V.py });
      } else {
        const s = ser.find((q) => q.key === V.sel[0]), t = s ? toSeries(g, s, "#002147", i) : { pts: [] };
        cb.innerHTML = colChart({ w, h: w < 520 ? 300 : 380, pts: t.pts.filter(inYr), xr: sp, unit: i.unit, aria: indName(i) + ", " + regionLabel(g, V.region) });
      }
    }
  }
  // live updates while a slider moves: only the chart, or the map and the table, are redrawn so the drag continues
  function yrInput(a) {
    const V = state.V, r0 = $("#yr0"), r1 = $("#yr1"); if (!r0 || !r1) return;
    let lo = +r0.value, hi = +r1.value;
    if (lo > hi) { if (a === r0) { lo = hi; r0.value = lo; } else { hi = lo; r1.value = hi; } }
    const mn = +r0.min, mx = +r0.max;
    V.yr = V.sp = lo <= mn && hi >= mx ? null : [lo, hi];
    const t = $("#yrtxt"); if (t) t.textContent = lo + " " + L("sampai", "to") + " " + hi;
    const s = $("#yrs"); if (s) { s.style.setProperty("--a", (lo - mn) / (mx - mn)); s.style.setProperty("--b", (hi - mn) / (mx - mn)); }
    drawCharts();
  }
  function pyPlay() {
    const b = $(".yplay"), stop = () => { clearInterval(state._pyT); state._pyT = null; const x = $(".yplay"); if (x) { x.innerHTML = "&#9654;"; x.setAttribute("aria-pressed", "false"); x.setAttribute("aria-label", L("Putar tahun demi tahun", "Play year by year")); } syncUrl(); };
    if (state._pyT) { stop(); return; }
    const r = $("#pyr"); if (!r) return;
    if (+r.value >= +r.max) { r.value = 0; pyrInput(r); }
    if (b) { b.innerHTML = "&#10074;&#10074;"; b.setAttribute("aria-pressed", "true"); b.setAttribute("aria-label", L("Hentikan", "Stop")); }
    state._pyT = setInterval(() => {
      const s = $("#pyr");
      if (!s || !state.V || state.V.tab !== "map") { stop(); return; }
      if (+s.value >= +s.max) { stop(); return; }
      s.value = +s.value + 1; pyrInput(s);
    }, 900);
  }
  function pyrInput(a) {
    const V = state.V, pv0 = provView(); if (!pv0) return;
    V.py = String(pv0.years[+a.value]);
    a.setAttribute("aria-valuetext", V.py);
    const t = $("#pytxt"); if (t) t.textContent = V.py;
    const pv = provView(), mp = $("#mpanel"), sl = $("#srcl");
    if (mp) mp.innerHTML = mapPanelHtml(pv);
    if (sl) sl.outerHTML = srcLine(mapSrcText(pv));
    $("#atab").innerHTML = areaTableHtml();
    drawMapNow();
  }
  // a row of the area table (or its name) opens that area on the line, or on the bars for a one-year indicator
  function openArea(key) {
    const V = state.V;
    setArea(key);
    V.tab = tabOff().line ? "bar" : "line";
    renderViz();
    const c = $("#f-series"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
    const t = $("#vt-" + V.tab); if (t) t.focus({ preventScroll: true });
  }
  function refocus(sel) { const el = $(sel); if (el) el.focus({ preventScroll: true }); }

  /* ------------------------------------------------------------------ events */
  function onClick(e) {
    const s = e.target.closest("[data-s]");
    if (s && s.tagName === "A") {
      const id = s.getAttribute("data-s");
      if (location.hash.startsWith("#/metode")) { e.preventDefault(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth" }); }
      else state._scroll = id;
    }
    if (!e.target.closest(".hsearch")) { const sg = $("#sugg"); if (sg) sg.hidden = true; }
    if (!e.target.closest(".herosf")) { const sg = $("#hsugg"); if (sg) sg.hidden = true; }
    if (!e.target.closest(".spw")) $$(".spw.open").forEach((w) => popSet(w, false));
    const a = e.target.closest("[data-a]");
    if (!a) {
      // anywhere on a row of the area table opens that area, the same as its name button
      const tr = e.target.closest("tr[data-reg]");
      if (tr && state.V && !window.getSelection().toString()) openArea(tr.getAttribute("data-reg"));
      return;
    }
    const act = a.getAttribute("data-a"), V = state.V;
    switch (act) {
      case "lang": e.preventDefault(); state.lang = a.getAttribute("data-v"); try { localStorage.setItem("pk-lang", state.lang); } catch (x) { /* ignore */ } route(); break;
      case "mtoggle": { const hd = $(".hd"); const on = hd.classList.toggle("mopen"); a.setAttribute("aria-expanded", on); break; }
      case "stoggle": { const hd = $(".hd"); hd.classList.toggle("sopen"); if (hd.classList.contains("sopen")) $("#hq").focus(); break; }
      case "hm": { e.preventDefault(); const k = Number(String(a.getAttribute("data-t")).replace("hm-", "")) - 1; if (state._deckGo && k >= 0) state._deckGo(k); break; }
      case "more": state.shown += 12; pageSearch(parseHash(), true); break;
      case "pkset": if (V) { const k = a.getAttribute("data-k"); V.sel = [k]; V.pk = k; renderViz(); } break;
      case "kbgo": if (state.V) { state.V.kb = a.getAttribute("data-v"); state.V.ky = "latest"; renderViz(); refocus("#sel-kb"); } break;
      case "hx": hxClick(a); break;
      case "hxdemo": hxDemo(); break;
      case "dinav": { const tr = $("#ditrack"), c = tr && tr.querySelector(".dicard"); if (c) tr.scrollBy({ left: Number(a.getAttribute("data-d")) * (c.offsetWidth + 24), behavior: "smooth" }); break; }
      case "res":
        if (window.innerWidth > 900) { e.preventDefault(); const id = a.getAttribute("data-id"); state.preview = id; $$(".res").forEach((x) => x.classList.toggle("on", x === a)); renderPreview(id); }
        break;
      case "reset": state.shown = 12; break;
      case "csvind": csvIndicator(a.getAttribute("data-id"), "all"); break;
      case "csv": if (V) csvIndicator(V.i.id, a.getAttribute("data-w")); break;
      case "logout": signOut(); break;
      case "access": e.preventDefault(); state.pendingDl = a.getAttribute("data-dlid") ? { id: a.getAttribute("data-dlid"), w: a.getAttribute("data-dlw") || "all" } : null; openAccess(); break;
      case "accclose": { const d = $("#accdlg"); if (d && d.close) d.close(); else if (d) d.removeAttribute("open"); break; }
      case "copylink": copyText(location.href, L("Tautan disalin.", "Link copied.")); break;
      case "ptab": setPtab(a.getAttribute("data-k")); break;
      case "cmp": if (V) {
        const k = a.getAttribute("data-k"), cur = V.cmp && V.cmp.length > 1 ? V.cmp.slice() : [V.region], x = cur.indexOf(k);
        if (x >= 0) cur.splice(x, 1); else if (cur.length >= 8) { toast(L("Paling banyak 8 wilayah.", "At most 8 areas.")); break; } else cur.push(k);
        if (cur.length > 1) { V.cmp = cur; V.tab = "line"; } else if (cur.length === 1) setArea(cur[0]); else V.cmp = null;
        renderViz(); refocus('.cmrow[data-k="' + k + '"]');
      } break;
      case "csort": if (V) { V.csort = a.getAttribute("data-k"); renderViz(); refocus('[data-a="csort"][data-k="' + V.csort + '"]'); } break;
      case "cclear": if (V) { setArea(V.cmp && V.cmp.length ? V.cmp[0] : V.region); renderViz(); } break;
      case "pyplay": pyPlay(); break;
      // full screen (PI 26 Oct, after OWID): the chart card alone; the charts redraw at the new width
      case "fs": { const c = $(".vcard"); if (document.fullscreenElement) document.exitFullscreen(); else if (c && c.requestFullscreen) c.requestFullscreen(); break; }
      case "img": { const d = a.closest("details"); if (d) d.open = false; chartImage(a.getAttribute("data-k")); break; }
      case "copycite": { const c = $("#citetxt"); if (c) copyText(c.textContent, L("Kutipan disalin.", "Citation copied.")); break; }
      case "ser": if (V) { const k = a.getAttribute("data-k"); pickSeries(k); renderViz(); refocus('#chips [data-k="' + k + '"]'); } break;
      case "chipsall": if (V) { V.chipsAll = true; $("#chips").innerHTML = chipsHtml(chooserSeries(), chooserMode()); } break;
      case "morevals": if (V) { V.nvals += 24; renderBottom(); } break;
      case "psort": if (V) {
        const k = a.getAttribute("data-k");
        if (V.psort === k) V.pdir = -V.pdir; else { V.psort = k; V.pdir = k === "n" ? 1 : -1; }  // a second click turns the order round
        $("#atab").innerHTML = areaTableHtml(); refocus('#atab [data-a="psort"][data-k="' + k + '"]'); }
        break;
      case "tab": if (V) {
        const k = a.getAttribute("data-k"), why = tabOff()[k];
        if (why) { toast(L("Tidak tersedia: ", "Not available: ") + why + "."); break; }
        V.tab = k; renderViz(); refocus("#vt-" + k); }
        break;
      case "area": if (V) openArea(a.getAttribute("data-k")); break;
      case "kprov": if (V) { V.kp = a.getAttribute("data-k"); V.ky = "latest"; renderViz(); refocus("#sel-kp"); } break;
      case "bmode": if (V) { V.bmode = a.getAttribute("data-k"); renderViz(); refocus('[data-a="bmode"][data-k="' + V.bmode + '"]'); } break;
      case "srcpop": { const w = a.closest(".spw"); if (w.classList.contains("pin")) popSet(w, false); else { popSet(w, true); w.classList.add("pin"); } break; }
      default: break;
    }
  }
  function onChange(e) {
    const a = e.target.closest("[data-a]");
    if (!a) return;
    const act = a.getAttribute("data-a"), V = state.V;
    if (act === "f") {
      const P = state._P, f = a.getAttribute("data-f"), v = a.getAttribute("data-v");
      if (a.checked) P[f].add(v); else P[f].delete(v);
      applySearchState(P, a.id);
    } else if (act === "fy") { const P = state._P; P[a.getAttribute("data-f")] = a.value; applySearchState(P, a.id); }
    else if (act === "fs") { const P = state._P; P.sort = a.value; applySearchState(P, a.id); }
    else if (act === "region" && V) { setArea(a.value); renderViz(); refocus("#sel-region"); }
    else if ((act === "kp" || act === "ky" || act === "kb") && V) { V[act] = a.value; if (act !== "ky") V.ky = "latest"; renderViz(); refocus("#sel-" + act); }
    // a slider let go: redraw the whole view once (table, sources, download note, URL) and keep the focus on it
    else if ((act === "yr" || act === "pyr") && V) { const id = a.id; renderViz(); refocus("#" + id); }
  }
  let hxT = 0;
  function onInput(e) {
    const a = e.target.closest("[data-a]");
    if (e.target.id === "hq") { showSuggestions(); return; }
    if (e.target.id === "hero-q") { showHeroSuggestions(); return; }
    // the search box of the picker narrows the table as one types
    if (e.target.id === "hxq") {
      clearTimeout(hxT);
      const v = e.target.value;
      hxT = setTimeout(() => { const H = state.hx; if (!H) return; if (norm(v).length < 2 && norm(H.q || "").length < 2) { H.q = v; return; } H.q = v; H.lim = 40; state.hxSeen = true; const sec = $("#pilih"); if (sec) sec.classList.add("ready"); const box = $("#hx"); if (box) box.innerHTML = hxTable(); }, 220);
      return;
    }
    if (a && state.V && a.getAttribute("data-a") === "yr") { yrInput(a); return; }
    if (a && state.V && a.getAttribute("data-a") === "pyr") { pyrInput(a); return; }
    // the search box of the district Rincian select narrows its options as one types
    if (a && a.getAttribute("data-a") === "kbq" && state.V) {
      const V = state.V; V.kbq = a.value; const K = kabView(), s = $("#sel-kb");
      if (K && s) s.innerHTML = kbOptions(K, V);
      return;
    }
    if (a && a.getAttribute("data-a") === "cq" && state.V) { state.V.cq = a.value; const l = $("#cmlist"); if (l) l.innerHTML = cmpList(); return; }
    if (a && a.getAttribute("data-a") === "chipq" && state.V) {
      const V = state.V; V.chipq = a.value; const pos = a.selectionStart; $("#chips").innerHTML = chipsHtml(chooserSeries(), chooserMode()); const n = $("#chipq"); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
    }
  }
  function onSubmit(e) {
    const f = e.target;
    if (f.id === "sform") { e.preventDefault(); const P = state._P; P.q = $("#q").value.trim(); if (!P.sort || P.sort === "") P.sort = ""; applySearchState(P, "q"); }
    else if (f.id === "heroform") { e.preventDefault(); location.hash = hashFor("/telusuri", { q: $("#hero-q").value.trim() }); }
    else if (f.id === "exform") { e.preventDefault(); location.hash = hashFor("/telusuri", { q: $("#ex-q").value.trim() }); }
    else if (f.getAttribute("data-acf")) { e.preventDefault(); submitAccount(f); }
    else if (f.id === "fbform") { e.preventDefault(); submitFeedback(f); }
  }
  function onKey(e) {
    const sbox = e.target.closest && e.target.closest(".hsearch, .herosf");
    if (sbox && ["ArrowDown", "ArrowUp", "Escape"].includes(e.key) && suggKeys(e, sbox.querySelector(".sugg"))) return;
    if (e.target.id === "hq") {
      if (e.key === "Enter") { e.preventDefault(); const q = e.target.value.trim(); const sg = $("#sugg"); if (sg) sg.hidden = true; location.hash = hashFor("/telusuri", { q }); }
      if (e.key === "Escape") { const sg = $("#sugg"); if (sg) sg.hidden = true; }
      return;
    }
    if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { const h = $("#hq"); if (h) { e.preventDefault(); const hd = $(".hd"); if (window.innerWidth <= 900) hd.classList.add("sopen"); h.focus(); } }
    if (e.key === "Escape") $$(".spw.open").forEach((w) => popSet(w, false));
    // the chart tabs: arrow keys move between them, Enter or Space opens one
    const tab = e.target.closest && e.target.closest('.vtl [role="tab"], .ptabs [role="tab"]');
    if (tab && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) {
      const all = $$(tab.closest(".ptabs") ? '.ptabs [role="tab"]' : '.vtl [role="tab"]'), x = all.indexOf(tab);
      const n = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (x + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length;
      e.preventDefault(); all[n].focus();
    }
  }

  /* ------------------------------------------------------------------ start */
  let lastW = window.innerWidth;
  function init() {
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("submit", onSubmit);
    const tcRun = debounce(() => titleCaseAll(document), 30);
    new MutationObserver(tcRun).observe(document.body, { childList: true, subtree: true });
    // redraw only the charts: re-rendering the card would remove the element in full screen and end it
    document.addEventListener("fullscreenchange", () => { if (state.V && $("#viz")) setTimeout(drawCharts, 60); });
    document.addEventListener("pointermove", onChartHover);
    document.addEventListener("pointermove", onMapHover);
    document.addEventListener("pointerdown", onMapHover);
    document.addEventListener("pointerdown", onChartHover);
    document.addEventListener("keydown", onKey);
    // the source-table popup opens on mouse hover and on keyboard focus (a tap focuses and clicks, see "srcpop")
    const spwOf = (e) => (e.target && e.target.closest ? e.target.closest(".spw") : null);
    document.addEventListener("pointerover", (e) => { const w = spwOf(e); if (w && e.pointerType === "mouse") popSet(w, true); });
    document.addEventListener("pointerout", (e) => { const w = spwOf(e); if (w && e.pointerType === "mouse" && !w.contains(e.relatedTarget) && !w.classList.contains("pin")) popSet(w, false); });
    document.addEventListener("focusin", (e) => { const w = spwOf(e); if (w) popSet(w, true); });
    document.addEventListener("focusout", (e) => { const w = spwOf(e); if (w && !w.contains(e.relatedTarget)) popSet(w, false); });
    // a list that grows by "Show the next ..." loads its next rows by itself when the reader scrolls its button into
    // reach (PI 22 Oct); the button stays for keyboards and for a reader who stops scrolling
    let autoRaf = 0;
    // on a wide screen the results scroll inside their own panel: measure reach against that panel
    const scrollBox = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
      }
      return null;
    };
    const autoMore = () => {
      autoRaf = 0;
      $$("button[data-auto]").forEach((b) => {
        if (b.dataset.fired || !b.offsetParent) return;
        const r = b.getBoundingClientRect(), box = scrollBox(b);
        const reach = Math.min(window.innerHeight, box ? box.getBoundingClientRect().bottom : Infinity) + 320;
        // after a load the page may end before the new button leaves reach, and a page that cannot scroll fires no
        // scroll event: look again once the rows are in
        if (r.top < reach && r.bottom > 0) { b.dataset.fired = "1"; b.click(); setTimeout(autoMore, 80); }
      });
    };
    document.addEventListener("scroll", () => { if (!autoRaf) autoRaf = requestAnimationFrame(autoMore); }, { passive: true, capture: true });
    window.addEventListener("hashchange", () => route());
    window.addEventListener("resize", debounce(() => {
      const w = window.innerWidth;
      if (Math.abs(w - lastW) < 30) return;
      lastW = w;
      const p = parseHash().parts[0] || "";
      if (p === "indikator") drawCharts();
      else if (p === "metode") { const y = window.scrollY; pageMethod(); window.scrollTo(0, y); }
    }, 200));
    route();
  }
  init();
})();
