'use client';

import { useEffect, useState } from 'react';
import type { Report } from '../lib/reports';
import { CONDITIONS, addReport, conditionLabel, storageMode } from '../lib/reports';

interface Props {
  provinces: string[];
  reports: Report[];
  onNewReport: (r: Report) => void;
  selectedProvince: string | null;
}

export default function ReportSection({ provinces, reports, onNewReport, selectedProvince }: Props) {
  const [province, setProvince] = useState(selectedProvince || '');
  const [place, setPlace] = useState('');
  const [condition, setCondition] = useState<string>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // When a province is clicked on the map, pre-fill the form with it — once.
  // After that the select is the user's: changing it sticks until the next
  // map click. (The map selection must never permanently override the select.)
  useEffect(() => {
    if (selectedProvince) setProvince(selectedProvince);
  }, [selectedProvince]);

  const effectiveProvince = province;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(null);
    setErr(null);
    if (!effectiveProvince) {
      setErr('Please choose a province.');
      return;
    }
    if (!condition) {
      setErr('Please pick what the water is like.');
      return;
    }
    if (text.trim().length < 10) {
      setErr('Please describe the situation in a sentence or two (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      const { report, storedIn } = await addReport({
        province: effectiveProvince,
        place: place.trim() || effectiveProvince,
        condition: condition as Report['condition'],
        text: text.trim(),
      });
      onNewReport(report);
      setText('');
      setPlace('');
      setCondition('');
      setOk(
        storedIn === 'supabase'
          ? 'Thank you — your report is saved and visible to everyone.'
          : 'Thank you — your report is saved in this browser (demo storage; connect Supabase to share it).',
      );
    } catch {
      setErr('Something went wrong saving your report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="report-layout">
      <form className="card" onSubmit={submit} aria-label="Report your water condition">
        <h3>Report your water</h3>
        <p className="card-sub">
          Official figures describe sources. Your report describes the water itself — what comes
          out of the tap, the well, or the spring where you live.
        </p>
        {ok && <div className="form-ok" role="status">{ok}</div>}
        {err && <div className="form-err" role="alert">{err}</div>}
        <div className="field">
          <label htmlFor="r-province">Province</label>
          <select
            id="r-province"
            value={effectiveProvince}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="">Choose a province…</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-place">City, district, or village (optional)</label>
          <input
            id="r-place"
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Wamena, Jayawijaya"
            maxLength={80}
          />
        </div>
        <div className="field">
          <label id="r-cond-label">What is the water like?</label>
          <div className="chip-row" role="group" aria-labelledby="r-cond-label">
            {CONDITIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                className="chip"
                aria-pressed={condition === c.value}
                onClick={() => setCondition(c.value)}
                title={c.hint}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="r-text">What is happening with your water?</label>
          <textarea
            id="r-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. The tap runs two hours in the morning, then stops. We store water in jerry cans."
            maxLength={500}
          />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Send report'}
        </button>
        <p className="form-note">
          No account, no name, no email — a report is a place, a condition, and a sentence.
          Reports appear on the map and in the list below.
        </p>
      </form>

      <div className="card">
        <h3>Recent reports</h3>
        <p className="card-sub">
          {reports.length} report{reports.length === 1 ? '' : 's'} · newest first · reports marked
          “example” are built-in demos, clearly labelled
        </p>
        {reports.length === 0 ? (
          <p className="empty-state">
            No reports yet. Be the first to describe the water where you live — the form on the
            left takes under a minute.
          </p>
        ) : (
          <ul className="report-list">
            {reports.map((r) => (
              <li key={r.id} className="report-item">
                <div className="r-head">
                  <span className="r-prov">{r.province}</span>
                  <span className="r-place">{r.place}</span>
                  <span className={`tag ${r.condition}`}>{conditionLabel(r.condition)}</span>
                  {r.is_example && <span className="tag example">example</span>}
                  <span className="r-when">
                    {new Date(r.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="r-text">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="storage-note">
          Storage:{' '}
          {storageMode === 'supabase'
            ? 'shared Supabase database (reports are visible to every visitor).'
            : 'this browser only (demo mode — reports live in localStorage; see supabase/schema.sql to connect a shared database).'}
        </p>
      </div>
    </div>
  );
}
