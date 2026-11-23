'use client';

import type { NationalData, YearValue } from '../lib/data';
import { yearsToTarget } from '../lib/data';

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace(/\.0$/, '');
}

/** Simple SVG line chart: values over years, with a dashed 2030 target line. */
function TrendChart({ values, target }: { values: YearValue[]; target: number }) {
  const W = 520;
  const H = 220;
  const padL = 40;
  const padR = 14;
  const padT = 14;
  const padB = 28;
  const minV = Math.min(...values.map((v) => v.value), target) - 2;
  const maxV = Math.max(...values.map((v) => v.value), target) + 1;
  const x = (i: number) => padL + (i / (values.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (H - padT - padB);
  const points = values.map((v, i) => `${x(i)},${y(v.value)}`).join(' ');
  const yTicks = [85, 90, 95, 100].filter((t) => t >= minV && t <= maxV);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend of improved drinking-water access, 2018 to 2025">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e6eff3" strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5a6e78">
            {t}%
          </text>
        </g>
      ))}
      <line
        x1={padL}
        x2={W - padR}
        y1={y(target)}
        y2={y(target)}
        stroke="#c98a1b"
        strokeWidth="1.5"
        strokeDasharray="6 4"
      />
      <text x={W - padR} y={y(target) - 6} textAnchor="end" fontSize="11.5" fill="#7a4e08" fontWeight="700">
        SDG target 100% by 2030
      </text>
      <polyline points={points} fill="none" stroke="#0e6e8c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={v.year}>
          <circle cx={x(i)} cy={y(v.value)} r="3.5" fill="#0a4a66" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#5a6e78">
            {v.year}
          </text>
          {(i === 0 || i === values.length - 1) && (
            <text
              x={i === 0 ? x(i) + 4 : x(i) - 4}
              y={y(v.value) - 10}
              textAnchor={i === 0 ? 'start' : 'end'}
              fontSize="12.5"
              fontWeight="700"
              fill="#0a2e4d"
            >
              {fmt(v.value)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function BarRow({ label, value, color, max = 100 }: { label: string; value: number; color: string; max?: number }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="bar-value">{fmt(value)}%</span>
    </div>
  );
}

export default function Dashboard({ national }: { national: NationalData }) {
  const trend = national.improved_drinking_water_trend.values;
  const sm = national.safely_managed.values;
  const improvedYears = yearsToTarget(trend, 100, 2026);
  const smYears = yearsToTarget(sm, 100, 2026);
  const improvedPace = (trend[trend.length - 1].value - trend[0].value) / (trend[trend.length - 1].year - trend[0].year);
  const smPace = (sm[sm.length - 1].value - sm[0].value) / (sm[sm.length - 1].year - sm[0].year);

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h3>The national line is climbing — slowly</h3>
          <p className="card-sub">
            Households with access to improved drinking water, Indonesia, 2018–2025
          </p>
          <TrendChart values={trend} target={100} />
          <p className="footnote">
            Source: Profil Kesehatan Indonesia (Kemenkes RI), via the ARC Institute Health Profile Atlas.
            The series rose {fmt(trend[trend.length - 1].value - trend[0].value)} points in seven years — about{' '}
            {fmt(improvedPace, 2)} points a year. Definition changed between 2019 and 2020; read the
            series with care across that break.
          </p>
        </div>

        <div className="card">
          <h3>“Improved” is not the same as safe</h3>
          <p className="card-sub">Three ways of counting drinking water, Indonesia, 2024–2025</p>
          <BarRow label="Improved source (2025)" value={93.2} color="#147a9e" />
          <BarRow label="At least basic (2024)" value={national.basic_drinking_water_2024.value} color="#5ba8c2" />
          <BarRow label="Safely managed (2024)" value={30.5} color="#c98a1b" />
          <p className="footnote">
            “Safely managed” — the SDG 6.1.1 standard — means water that is accessible on premises,
            available when needed, and free from faecal and priority chemical contamination. Only{' '}
            <strong>30.5%</strong> of Indonesians had that in 2024, against 93.2% with an “improved”
            source. Sources: WHO/UNICEF JMP via World Bank WDI; Profil Kesehatan Indonesia 2025.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Where you live decides what you drink</h3>
          <p className="card-sub">Urban–rural split, two measures</p>
          <div className="split-bars">
            <div className="split">
              <h4>Improved drinking water (BPS 2024)</h4>
              <div className="split-row">
                <span className="split-label">Urban</span>
                <span className="big" style={{ color: '#0e6e8c' }}>{fmt(national.bps_2024.urban_2024)}%</span>
              </div>
              <div className="split-row">
                <span className="split-label">Rural</span>
                <span className="big" style={{ color: '#c98a1b' }}>{fmt(national.bps_2024.rural_2024)}%</span>
              </div>
              <p>A {fmt(national.bps_2024.urban_2024 - national.bps_2024.rural_2024)}-point gap between city and village.</p>
            </div>
            <div className="split">
              <h4>Safely managed water (JMP 2024)</h4>
              <div className="split-row">
                <span className="split-label">Urban</span>
                <span className="big" style={{ color: '#0e6e8c' }}>{fmt(national.safely_managed.urban_2024)}%</span>
              </div>
              <div className="split-row">
                <span className="split-label">Rural</span>
                <span className="big" style={{ color: '#c98a1b' }}>{fmt(national.safely_managed.rural_2024)}%</span>
              </div>
              <p>Even in cities, two in three people lack safely managed water.</p>
            </div>
          </div>
          <p className="footnote">
            And the water itself: in a 2020 Ministry of Health study of around 20,000 household
            drinking-water sources, nearly 70% were contaminated by faecal waste (UNICEF, 2022).
          </p>
        </div>

        <div className="card">
          <h3>Sanitation is moving — and it matters</h3>
          <p className="card-sub">SDG 6.2: sanitation and hygiene for all by 2030</p>
          <BarRow label="Basic sanitation 2020" value={82.3} color="#5ba8c2" />
          <BarRow label="Basic sanitation 2024" value={88.2} color="#0a4a66" />
          <BarRow label="Open defecation 2020" value={6.6} color="#d9a441" />
          <BarRow label="Open defecation 2024" value={2.3} color="#7a4e08" />
          <p className="footnote">
            Open defecation fell from 6.6% to 2.3% in four years — real progress, and the reason
            faecal contamination of water sources is a sanitation problem as much as a water problem.
            Source: WHO/UNICEF JMP via World Bank WDI.
          </p>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 22 }}>
        <div className="pace-box">
          <h3>At today&rsquo;s pace, when does Indonesia reach 100%?</h3>
          <p>
            Improved drinking water, at the 2018–2025 pace of about {fmt(improvedPace, 2)} points a
            year:
          </p>
          <p className="pace-num">
            ≈ {improvedYears !== null ? 2026 + improvedYears : '—'}
            <span> — roughly {improvedYears ?? '—'} more years</span>
          </p>
          <p>
            Safely managed water — the actual SDG 6.1 standard — at the 2020–2024 pace of about{' '}
            {fmt(smPace, 2)} points a year:
          </p>
          <p className="pace-num">
            ≈ {smYears !== null ? 2026 + smYears : '—'}
            <span> — roughly {smYears ?? '—'} more years</span>
          </p>
          <p className="pace-note">
            Simple linear extrapolations of the published series, shown to make the pace visible —
            not forecasts. The point they make is the point of SDG 6: the current pace on safely
            managed water is nowhere near enough, and the gap is the work.
          </p>
        </div>
        <div className="card">
          <h3>What “2030” actually promises</h3>
          <p className="card-sub">The two SDG 6 targets this tracker follows</p>
          <p style={{ fontSize: '15px', lineHeight: 1.65 }}>
            <strong>SDG 6.1</strong> — “By 2030, achieve universal and equitable access to safe and
            affordable drinking water for all.”
          </p>
          <p style={{ fontSize: '15px', lineHeight: 1.65 }}>
            <strong>SDG 6.2</strong> — “By 2030, achieve access to adequate and equitable sanitation
            and hygiene for all and end open defecation, paying special attention to the needs of
            women and girls and those in vulnerable situations.”
          </p>
          <p className="footnote">
            This page tracks the indicators, not the promises. Every number above comes from a
            published source listed at the bottom of the page — and every community report below
            comes from someone who drinks the water.
          </p>
        </div>
      </div>
    </>
  );
}
