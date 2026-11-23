# Test report — TirtaNusa (Acodemic × KeebsforWater SDG Hackathon)

Date: 23 Nov 2026. Tester: yanti (automated Playwright run + manual visual
review of every screenshot). App: static export served on localhost
(`python3 -m http.server`, `out/` from `npm run build`).

## Method

- `scripts/screenshot.py` — Playwright 1.64 + headless Chromium 1255, viewport
  1440×900 (hero shot at 1440×1150). 20 automated checks per run, plus a
  full-page screenshot. The script was run after every fix; the final run is
  20/20.
- Manual review of all 7 screenshots (map geometry, layout, chart rendering,
  text wrapping) — this caught 3 real bugs the automated checks missed (see
  "Bugs found and fixed").

## Results — final run: 20/20 PASS

| # | Check | Result |
|---|---|---|
| 1 | Map renders 38 province polygons | PASS (38 found) |
| 2 | Hero headline visible | PASS |
| 3 | Stat band has 4 stats | PASS |
| 4 | National figure (93.2%) shown in province bar | PASS |
| 5 | Screenshot 01 saved | PASS |
| 6 | Click selects Papua Pegunungan | PASS |
| 7 | Rank shown (Rank 38 of 38, −60.3 pts vs national, 1 report) | PASS |
| 8 | Trend chart rendered | PASS |
| 9 | Pace box present | PASS |
| 10 | Pace years computed (≈2034 improved; ≈2421 safely managed) | PASS |
| 11 | 3 example reports listed | PASS |
| 12 | Report submit shows success message | PASS |
| 13 | New report appears first in list | PASS |
| 14 | Report count is 4 after submit | PASS |
| 15 | Submitted report is in Jambi (form select wins over map pre-fill) | PASS |
| 16 | New report marker appears on map (42 overlay paths = 38 + 4) | PASS |
| 17 | Sources list has 7 entries | PASS |
| 18 | No console errors | PASS |
| 19 | No failed requests | PASS |
| 20 | Fully self-contained (zero external requests) | PASS |

Raw results: `screenshots/test-results.json`.

## Bugs found and fixed during testing

1. **TopoJSON decoder bug (critical, caught by visual review).** Negative arc
   indices were decoded with `arcs[abs(i)]` instead of `arcs[~i]`, and ring
   joins dropped the wrong endpoint — producing a huge triangle from Java to
   Papua. Fixed in the decoder; re-validated (0 unclosed rings, max
   consecutive-point jump 2.23°). The map now renders Indonesia correctly.
2. **Chart bar fills invisible (caught by visual review).** `.bar-fill` spans
   were inline, so width/height were ignored. Fixed with `display: block`.
3. **Report form province override (caught by visual review).** The map's
   selected province permanently overrode the form select, so the province
   could not be changed while one was selected. Fixed: map click is now a
   one-time pre-fill; the select stays under the user's control.
4. **Pace math off by one year.** `yearsToTarget` double-counted the gap
   between the last data year and the current year (≈2036 → corrected ≈2034).
5. **`data-province` test hook set too early.** Leaflet SVG elements don't
   exist until the layer is added to the map; the attribute is now set after
   `addTo(map)`.
6. **Smooth-scroll vs screenshot timing.** `scroll-behavior: smooth` plus a
   follow-up `scrollBy` cancelled section scrolling in screenshots. The test
   now uses instant `scrollTo`; the site keeps smooth scrolling for users.
7. **Playwright wheelhouse greenlet broken.** The cached greenlet lacked its C
   extension; fixed by installing working greenlet + pyee wheels into
   `~/workspace/devpost/.pwfix` (outside the repo) and prepending it to
   `sys.path` in the test script.

## What was NOT tested

- **Supabase mode.** No Supabase project exists (creating one needs a sign-in
  the task forbids), so the Supabase code path is untested against a live
  database. The REST calls follow the standard PostgREST shape and the schema
  is included; the app falls back to localStorage if Supabase is unreachable.
  The localStorage path is fully tested.
- **GitHub Pages deploy.** The workflow file is included
  (`.github/workflows/deploy.yml`) but the repo doesn't exist yet — the parent
  agent creates it. The build itself is verified (static export, 49 files,
  2.4 MB), and the `NEXT_PUBLIC_BASE_PATH` handling is the standard Next.js
  approach for project pages. The live URL still needs a post-deploy check.
- **Mobile layout.** CSS includes a ≤860px breakpoint (2-column stat band,
  single-column grids, 420px map), but no mobile-viewport test run was done.
  Desktop (1440px) is fully verified.
- **Real-user report moderation.** There is none — reports are unmoderated by
  design in this demo (anonymous, no accounts). Noted as a "what's next" item.

## Performance (local)

- `npm run build`: ~30 s, clean (0 TypeScript errors).
- First Load JS: 97.8 kB. Static export: 2.4 MB total (GeoJSON 717 kB is the
  largest single asset).
- Page load on localhost: map + data ready in ~2 s (networkidle).
