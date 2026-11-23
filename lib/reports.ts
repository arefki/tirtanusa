// Community water-condition reports.
//
// Storage: Supabase (free tier) when NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are configured at build time; otherwise the
// browser's localStorage. The UI always says which one is active, so nobody
// mistakes a local demo for a shared database.
//
// No Supabase JS client is used — the PostgREST endpoint is called directly
// with fetch, which keeps the bundle small and the integration transparent.

export type Condition = 'good' | 'murky' | 'smelly' | 'dry' | 'intermittent';

export const CONDITIONS: { value: Condition; label: string; hint: string }[] = [
  { value: 'good', label: 'Clear & drinkable', hint: 'Water looks and tastes fine' },
  { value: 'murky', label: 'Murky / cloudy', hint: 'Discoloured or cloudy water' },
  { value: 'smelly', label: 'Smells bad', hint: 'Unusual smell from the tap or well' },
  { value: 'dry', label: 'No water', hint: 'Tap or source is dry' },
  { value: 'intermittent', label: 'Comes and goes', hint: 'Supply stops for hours or days' },
];

export interface Report {
  id: string;
  province: string;
  place: string;
  condition: Condition;
  text: string;
  created_at: string; // ISO
  is_example?: boolean;
}

const LS_KEY = 'tirtanusa-reports-v1';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const storageMode: 'supabase' | 'local' =
  SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'local';

// Example reports, clearly labelled as examples in the UI. They exist so a
// first-time visitor can see how the feature works; they are not real reports
// and are never presented as such.
const EXAMPLE_REPORTS: Report[] = [
  {
    id: 'example-1',
    province: 'Papua Pegunungan',
    place: 'Wamena, Jayawijaya',
    condition: 'intermittent',
    text: 'The communal tap runs for about two hours in the morning, then stops until the next day. Families store water in jerry cans.',
    created_at: '2026-11-20T07:12:00+07:00',
    is_example: true,
  },
  {
    id: 'example-2',
    province: 'Bengkulu',
    place: 'Kota Bengkulu',
    condition: 'murky',
    text: 'After heavy rain the well water turns brown for two or three days. We boil it before drinking.',
    created_at: '2026-11-18T16:40:00+07:00',
    is_example: true,
  },
  {
    id: 'example-3',
    province: 'DKI Jakarta',
    place: 'Penjaringan, Jakarta Utara',
    condition: 'good',
    text: 'Piped water is clear and runs all day here. A reminder that the gap is not about the country — it is about the neighbourhood.',
    created_at: '2026-11-15T09:05:00+07:00',
    is_example: true,
  },
];

async function supabaseList(): Promise<Report[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?select=*&order=created_at.desc&limit=100`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Supabase list failed (${res.status})`);
  return res.json();
}

async function supabaseInsert(r: Omit<Report, 'id' | 'created_at'>): Promise<Report> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(r),
  });
  if (!res.ok) throw new Error(`Supabase insert failed (${res.status})`);
  const rows = await res.json();
  return rows[0];
}

function localList(): Report[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      localStorage.setItem(LS_KEY, JSON.stringify(EXAMPLE_REPORTS));
      return [...EXAMPLE_REPORTS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...EXAMPLE_REPORTS];
  } catch {
    return [...EXAMPLE_REPORTS];
  }
}

function localInsert(r: Omit<Report, 'id' | 'created_at'>): Report {
  const report: Report = {
    ...r,
    id: `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    created_at: new Date().toISOString(),
  };
  const list = localList();
  list.unshift(report);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    // storage full or unavailable — the report is still shown in this session
  }
  return report;
}

export async function listReports(): Promise<Report[]> {
  if (storageMode === 'supabase') {
    try {
      return await supabaseList();
    } catch {
      // Supabase unreachable: fall back to local so the feature keeps working.
      return localList();
    }
  }
  return localList();
}

export async function addReport(
  r: Omit<Report, 'id' | 'created_at'>,
): Promise<{ report: Report; storedIn: 'supabase' | 'local' }> {
  if (storageMode === 'supabase') {
    try {
      const report = await supabaseInsert(r);
      return { report, storedIn: 'supabase' };
    } catch {
      return { report: localInsert(r), storedIn: 'local' };
    }
  }
  return { report: localInsert(r), storedIn: 'local' };
}

export function conditionLabel(c: Condition): string {
  return CONDITIONS.find((x) => x.value === c)?.label || c;
}
