# TirtaNusa — SDG 6 Water Tracker for Indonesia

An interactive atlas of clean-water access across Indonesia's 38 provinces,
built for the **Acodemic × KeebsforWater Global SDG Hackathon** (Devpost, 2026).

"Tirta" is water in Sanskrit and Old Javanese; "Nusa" is island — water across
the islands.

## What it does

- **Interactive choropleth map** — improved drinking-water access by province
  (2025, all 38 provinces), with click-to-inspect detail, rank, and comparison
  to the national figure. Community reports appear as markers on the map.
- **2030 dashboard** — the national trend 2018–2025, the gap between "improved"
  (93.2%) and "safely managed" (30.5%) water, urban–rural splits, sanitation
  progress, and an honest linear extrapolation of the current pace to 100%.
- **Crowdsourced water reports** — anyone can report their local water condition
  (clear, murky, smelly, dry, intermittent) with no account. Stored in Supabase
  when configured, otherwise in the visitor's browser (localStorage) — the UI
  always says which.

## Data — all real, all cited

Every number comes from a published source, listed in the app footer and in
`public/data/*.json`:

| Figure | Source |
|---|---|
| Provincial access 2025 (38 provinces) | Profil Kesehatan Indonesia 2025 (Kemenkes RI), via ARC Institute Health Profile Atlas, indicator ENV-01-096; cross-checked vs BPS 2025 |
| National trend 2018–2025 | Same source |
| Safely managed / basic water, sanitation, open defecation | WHO/UNICEF JMP via World Bank WDI, retrieved 23 Nov 2026 |
| Urban/rural split 2024 | BPS via GoodStats |
| ~70% of household sources faecally contaminated | UNICEF Indonesia (2022), citing the 2020 MoH study |
| Province boundaries | ARC Institute atlas TopoJSON, converted to GeoJSON |

No figure is estimated. The three built-in reports are clearly labelled
"example" demos, never presented as real reports.

## Stack

Next.js 14 (App Router, static export) + React 18 + TypeScript + Leaflet 1.9.
No build-time network calls, no tracking, no ads. Fonts (Fraunces + Inter) and
all data are self-hosted, so the site works fully offline once loaded.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → out/
```

## Deploy

See [DEPLOY.md](DEPLOY.md) — GitHub Pages (free, recommended) or any static host.
Optional Supabase: run `supabase/schema.sql`, then set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time.

## Project layout

```
app/            Next.js App Router (layout, page, globals.css)
components/     WaterMap (Leaflet), Dashboard (SVG charts), ReportSection
lib/            data.ts (typed loaders + pace math), reports.ts (Supabase/localStorage)
public/data/    provinces.json, national.json, id-provinces.geojson
public/fonts/   self-hosted Fraunces + Inter (woff2)
supabase/       schema.sql for the reports table
screenshots/    screenshots taken during testing
data/           working notes + raw downloads (not shipped to the site)
```
