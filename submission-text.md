# Devpost submission text — TirtaNusa: SDG 6 Water Tracker for Indonesia

> Ready to paste into the Devpost submission form. Live URL and repo link are
> filled in by the parent agent after the GitHub repo + Pages deploy.
> Screenshots: `screenshots/01-hero-map.png`, `01b-map-full.png`,
> `02-province-selected.png`, `03-dashboard.png`, `04-reports.png`.

---

## Title

**TirtaNusa — Clean water, province by province (SDG 6 Water Tracker for Indonesia)**

## Tagline

An interactive atlas of drinking-water access across all 38 Indonesian
provinces — real data, community reports, and an honest look at the road to 2030.

## Description

### The problem

Indonesia's national clean-water figure looks like a success story: 93.2% of
households had an "improved" drinking-water source in 2025. But that number
hides two uncomfortable truths.

First, "improved" is a classification of the source, not a test of the water.
Only 30.5% of Indonesians had water that was actually *safely managed* in 2024
— on premises, available when needed, free from faecal and chemical
contamination. And in a 2020 Ministry of Health study of around 20,000
household drinking-water sources, nearly 70% were contaminated by faecal waste.

Second, the national figure hides a 3× gap between provinces. DKI Jakarta sits
at 100%. Papua Pegunungan sits at 32.9%. Twenty-four of 38 provinces are below
the national average. A single national number cannot show that — a map can.

### What TirtaNusa does

TirtaNusa ("tirta" is water in Sanskrit and Old Javanese; "nusa" is island)
is a single-page water atlas for Indonesia, built around three things:

1. **An interactive choropleth map of all 38 provinces**, coloured by
   households with improved drinking water in 2025. Click any province for its
   exact figure, its rank out of 38, and how far it sits from the national
   average. Provinces below the national figure show in amber, above it in
   blue, so the gap reads at a glance.
2. **A 2030 dashboard** that tracks SDG 6 honestly: the national trend
   2018–2025, the gap between "improved" (93.2%) and "safely managed" (30.5%)
   water, urban–rural splits, sanitation progress — and a simple linear
   extrapolation of the current pace. At the 2018–2025 pace, improved water
   reaches 100% around 2034. Safely managed water, at its 2020–2024 pace,
   would take roughly 395 more years. That number is labelled as an
   extrapolation, not a forecast — its job is to make the pace visible.
3. **Crowdsourced water-condition reports.** Official figures describe
   sources; people describe water. Anyone can report what comes out of their
   tap, well, or spring — clear, murky, smelly, dry, or intermittent — with no
   account and no personal data. Reports appear on the map as markers and in a
   list, newest first. Clicking a province on the map pre-fills the report
   form for it.

### Who it is for

- **Citizens and community groups** who want to see where their province
  stands and to record what their water is actually like.
- **Local governments, NGOs, and researchers** who need a fast, honest picture
  of the provincial gap before deciding where attention and funding should go.
- **Students and the SDG-curious** — the dashboard explains what "improved"
  and "safely managed" actually mean, in plain language, with every number
  sourced.

### SDG alignment

- **SDG 6.1** — safe and affordable drinking water for all by 2030. The app
  tracks both the headline indicator (improved access) and the standard that
  actually matters (safely managed access), and shows the pace gap openly.
- **SDG 6.2** — sanitation and hygiene for all, end open defecation. The
  dashboard tracks basic sanitation (82.3% → 88.2%, 2020–2024) and open
  defecation (6.6% → 2.3%), and explains why faecal contamination of water is
  a sanitation problem as much as a water problem.
- **SDG 6.b** — support local community participation in water and sanitation
  management. The reporting feature is exactly that: a way for the people who
  drink the water to put their experience on the same map as the official
  figures.

### Data — all real, all cited

Every number on the page comes from a published source, listed in the app's
footer and in the repository's data files. Nothing is estimated:

- Provincial access 2025 (all 38 provinces) and the 2018–2025 national trend:
  *Profil Kesehatan Indonesia 2025* (Kementerian Kesehatan RI), via the ARC
  Institute Health Profile Atlas (indicator ENV-01-096), cross-checked against
  BPS 2025 figures.
- Safely managed / basic drinking water, basic sanitation, open defecation:
  WHO/UNICEF Joint Monitoring Programme via World Bank World Development
  Indicators, retrieved 23 Nov 2026.
- Urban/rural split 2024: Badan Pusat Statistik (BPS).
- Faecal contamination: UNICEF Indonesia (2022), citing the 2020 Ministry of
  Health household drinking-water quality study.
- Province boundaries: ARC Institute atlas TopoJSON, converted to GeoJSON.

The three built-in reports are clearly labelled "example" demos, never
presented as real reports.

### Tech stack

- **Next.js 14** (App Router, static export) + React 18 + TypeScript
- **Leaflet 1.9** for the interactive map (no tile layer — the choropleth is
  drawn from local GeoJSON, so the map works fully offline)
- **Supabase** (free tier) for shared community reports, with a localStorage
  fallback: the app detects whether Supabase is configured at build time and
  tells the visitor which storage is active. Schema included
  (`supabase/schema.sql`).
- **Self-hosted everything**: fonts (Fraunces + Inter), data, map geometry —
  the deployed site makes zero external requests. First-load JS under 100 kB.
- **Hosting**: GitHub Pages (free), deployed by GitHub Actions on push.

### What I would do next

With more time: connect the live Supabase project so reports are shared
between visitors; add a district (kabupaten/kota) layer for the provinces with
the widest internal gaps; add an Indonesian-language version, since the people
most affected by the gap mostly read Indonesian; and add a simple
verification flow (photo of the water source) for reports.

### Honest notes

- The live demo stores community reports in the visitor's browser
  (localStorage) until a Supabase project is connected; the UI says so, and
  the schema plus the Supabase code path are already in the repo.
- The "years to 100%" figures are simple linear extrapolations of the
  published series, shown to make the pace visible — not forecasts. The app
  says that next to the numbers.

---

## Built With

Next.js, React, TypeScript, Leaflet, Supabase, GitHub Pages

## Links

- Live site: https://arefki.github.io/tirtanusa/ (GitHub Pages, deploy workflow run #1 re-run success 21:28 WIB; verified HTTP 200 + GeoJSON + fonts by parent)
- Repository: https://github.com/arefki/tirtanusa (push 8702e2e via connector 30 files; workflow + 10 fonts via browser web UI)
- Devpost project: https://devpost.com/software/tirtanusa-clean-water-province-by-province — SUBMITTED 2026-11-23 21:33 WIB to Acodemic X KeebsforWater Global SDG Hackathon, submission #1317452, account rahmatarefqi (solo). Title on Devpost: "TirtaNusa — Clean water, province by province" (45 chars; Devpost max 60 — full title kept as description line 1). 5 screenshots in gallery. Editable until deadline Dec 1, 2026 11:45 WIB.
- Demo video: optional — not included.
