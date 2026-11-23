'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Dashboard from '../components/Dashboard';
import ReportSection from '../components/ReportSection';
import { loadGeoJson, loadNational, loadProvinces, rankOf } from '../lib/data';
import type { NationalData, ProvincesData } from '../lib/data';
import { listReports } from '../lib/reports';
import type { Report } from '../lib/reports';

// Leaflet touches `window` at import time, so the map loads client-side only.
const WaterMap = dynamic(() => import('../components/WaterMap'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#5a6e78',
        background: '#dce9ef',
      }}
    >
      Loading the map…
    </div>
  ),
});

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace(/\.0$/, '');
}

export default function Home() {
  const [provinces, setProvinces] = useState<ProvincesData | null>(null);
  const [national, setNational] = useState<NationalData | null>(null);
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, n, g, r] = await Promise.all([
          loadProvinces(BASE_PATH),
          loadNational(BASE_PATH),
          loadGeoJson(BASE_PATH),
          listReports(),
        ]);
        if (cancelled) return;
        setProvinces(p);
        setNational(n);
        setGeojson(g);
        setReports(r);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load data');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedData = useMemo(() => {
    if (!selected || !provinces) return null;
    const found = provinces.provinces.find((p) => p.name === selected);
    if (!found) return null;
    return {
      ...found,
      rank: rankOf(provinces.provinces, selected),
      delta: found.value - provinces.national,
      reportCount: reports.filter((r) => r.province === selected).length,
    };
  }, [selected, provinces, reports]);

  const provinceNames = useMemo(
    () => (provinces ? [...provinces.provinces].map((p) => p.name).sort((a, b) => a.localeCompare(b)) : []),
    [provinces],
  );

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <a className="wordmark" href="#">
            Tirta<span>Nusa</span>
          </a>
          <span className="sdg-badge">SDG 6 · CLEAN WATER &amp; SANITATION</span>
          <nav>
            <a href="#map">Map</a>
            <a href="#dashboard">Dashboard</a>
            <a href="#reports">Reports</a>
            <a href="#sources">Sources</a>
          </nav>
        </div>
      </header>

      <div className="hero" id="map">
        <div className="wrap">
          <h1>Clean water, province by province.</h1>
          <p className="lede">
            In 2025, <strong>93.2%</strong> of Indonesian households had an improved drinking-water
            source — but only <strong>30.5%</strong> had water that was actually safely managed.
            And the highest province sits at <strong>100%</strong> while the lowest sits at{' '}
            <strong>32.9%</strong>. This atlas shows where the water is, where it isn&rsquo;t, and
            what the road to 2030 looks like.
          </p>
          <div className="map-shell">
            <div className="map-frame">
              <WaterMap
                geojson={geojson}
                provinces={provinces}
                selected={selected}
                onSelect={setSelected}
                reports={reports}
              />
              <div className="map-legend" aria-label="Map legend">
                <div className="legend-title">Households with improved drinking water, 2025</div>
                <div className="swatches" aria-hidden="true">
                  <i style={{ background: '#7a4e08' }} />
                  <i style={{ background: '#bf7f16' }} />
                  <i style={{ background: '#d9a441' }} />
                  <i style={{ background: '#5ba8c2' }} />
                  <i style={{ background: '#147a9e' }} />
                  <i style={{ background: '#0a4a66' }} />
                </div>
                <div className="scale-labels">
                  <span>32.9%</span>
                  <span>national 93.2%</span>
                  <span>100%</span>
                </div>
                <div className="note">
                  Amber = below the national figure. Blue = at or above it. Dots are community
                  water reports.
                </div>
              </div>
              <div className="map-hint">Drag to explore · click a province for details</div>
            </div>
          </div>
          <div className="province-bar">
            {selectedData ? (
              <>
                <span className="prov-name">{selectedData.name}</span>
                <span className="prov-value">{fmt(selectedData.value)}%</span>
                <span className="prov-meta">
                  of households with improved drinking water (2025) ·{' '}
                  <b>
                    {selectedData.delta >= 0 ? '+' : ''}
                    {fmt(selectedData.delta)} points
                  </b>{' '}
                  vs the national 93.2%
                </span>
                <span className="prov-rank">
                  Rank {selectedData.rank} of 38 · {selectedData.reportCount} community report
                  {selectedData.reportCount === 1 ? '' : 's'} ·{' '}
                  <a
                    href="#map"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelected(null);
                    }}
                  >
                    show all
                  </a>
                </span>
              </>
            ) : (
              <>
                <span className="prov-name">Indonesia</span>
                <span className="prov-value">{provinces ? fmt(provinces.national) : '…'}%</span>
                <span className="prov-meta">
                  of households with improved drinking water (2025) · median province{' '}
                  <b>{provinces ? fmt(provinces.median_province) : '…'}%</b> · highest{' '}
                  <b>DKI Jakarta 100%</b> · lowest <b>Papua Pegunungan 32.9%</b>
                </span>
                <span className="prov-rank">Click any province to see its detail</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stat-band">
        <div className="wrap">
          <div className="stat">
            <div className="num">93.2<small>%</small></div>
            <div className="label">
              <b>Improved drinking water</b> — households with an improved source, 2025 (Profil
              Kesehatan Indonesia)
            </div>
            <div className="delta">▲ from 87.8% in 2018</div>
          </div>
          <div className="stat">
            <div className="num">30.5<small>%</small></div>
            <div className="label">
              <b>Safely managed water</b> — the SDG 6.1.1 standard, 2024 (WHO/UNICEF JMP)
            </div>
            <div className="delta warn">▲ only 0.7 points since 2020</div>
          </div>
          <div className="stat">
            <div className="num">3.04<small>×</small></div>
            <div className="label">
              <b>The gap</b> — highest province (DKI Jakarta, 100%) vs lowest (Papua Pegunungan,
              32.9%), 2025
            </div>
            <div className="delta warn">24 of 38 provinces sit below the national figure</div>
          </div>
          <div className="stat">
            <div className="num">~70<small>%</small></div>
            <div className="label">
              <b>Contaminated at the source</b> — of ~20,000 household drinking-water sources
              tested in 2020 carried faecal contamination (MoH study, via UNICEF)
            </div>
            <div className="delta warn">An “improved” source is not a guarantee of safe water</div>
          </div>
        </div>
      </div>

      <main className="wrap">
        {loadError && (
          <div className="form-err" style={{ marginTop: 24 }} role="alert">
            Some data could not be loaded ({loadError}). Please reload the page.
          </div>
        )}

        <section className="block" id="dashboard">
          <h2>The road to 2030, in four charts.</h2>
          <p className="section-intro">
            SDG 6 promises safe water and sanitation for everyone by 2030. The national trend is
            real — but the standard that actually matters, <strong>safely managed</strong> water,
            is barely moving. These are the numbers that decide whether the promise holds.
          </p>
          {national ? (
            <Dashboard national={national} />
          ) : (
            <p style={{ color: '#5a6e78', marginTop: 28 }}>Loading the dashboard…</p>
          )}
        </section>

        <section className="block" id="reports">
          <h2>Numbers describe sources. People describe water.</h2>
          <p className="section-intro">
            A province can score 90% on paper while the tap in your street runs dry every
            afternoon. Community reports fill that gap — one place, one condition, one sentence at
            a time. Click a province on the map to pre-fill the form.
          </p>
          <ReportSection
            provinces={provinceNames}
            reports={reports}
            onNewReport={(r) => setReports((prev) => [r, ...prev])}
            selectedProvince={selected}
          />
        </section>

        <section className="sources" id="sources">
          <h3>Sources — every number on this page</h3>
          <ol>
            <li>
              Provincial access to improved drinking water, 2025 (all 38 provinces) —{' '}
              <a href="https://arcinstitute.or.id/tools/profil-kesehatan-indonesia/app/articles/improved-water-access-gaps/">
                Profil Kesehatan Indonesia 2025 (Kementerian Kesehatan RI), compiled by ARC
                Institute, Health Profile Atlas, indicator ENV-01-096
              </a>
              . Cross-checked against BPS 2025 figures (GoodStats, 24 Jun 2026).
            </li>
            <li>
              National trend 2018–2025 (improved drinking water) — same source, indicator
              ENV-01-096. Definition changed between 2019 and 2020.
            </li>
            <li>
              Safely managed drinking water, basic drinking water, basic sanitation, open
              defecation —{' '}
              <a href="https://data.worldbank.org/indicator/SH.H2O.SMDW.ZS?locations=ID">
                WHO/UNICEF Joint Monitoring Programme via World Bank World Development Indicators
              </a>
              , retrieved 23 Nov 2026.
            </li>
            <li>
              Urban/rural split, improved drinking water 2024 — Badan Pusat Statistik (BPS), via{' '}
              <a href="https://data.goodstats.id/statistic/akses-air-minum-layak-ri-2024-jakarta-tertinggi-papua-pegunungan-masih-tertinggal-CKnib">
                GoodStats
              </a>
              .
            </li>
            <li>
              Faecal contamination of household drinking-water sources —{' '}
              <a href="https://www.unicef.org/indonesia/press-releases/indonesia-nearly-70-cent-household-drinking-water-sources-contaminated-faecal-waste">
                UNICEF Indonesia (7 Feb 2022)
              </a>
              , citing the 2020 Ministry of Health household drinking-water quality study.
            </li>
            <li>
              Province boundaries — TopoJSON from the ARC Institute Health Profile Atlas
              (geo/id_prov.topo.json), converted to GeoJSON.
            </li>
            <li>
              SDG 6.1 and 6.2 target wording — United Nations Sustainable Development Goals.
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <div>
            <strong style={{ color: '#fff' }}>TirtaNusa</strong> — an SDG 6 water tracker for
            Indonesia.
            <br />
            Built for the Acodemic × KeebsforWater Global SDG Hackathon, 2026. “Tirta” is water in
            Sanskrit and Old Javanese; “Nusa” is island — water across the islands.
          </div>
          <div>
            Data is public and cited. Community reports are anonymous.
            <br />
            No account, no tracking, no ads.
          </div>
        </div>
      </footer>
    </>
  );
}
