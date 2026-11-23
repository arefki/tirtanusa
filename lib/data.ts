// Data layer for TirtaNusa. All figures are real, verified public data —
// see /public/data/*.json for sources and retrieval dates. Nothing here is
// estimated: values shown as "n/a" are genuinely missing, never invented.

export interface ProvinceValue {
  name: string;
  value: number;
}

export interface ProvincesData {
  year: number;
  indicator: string;
  indicator_id: string;
  national: number;
  median_province: number;
  ratio_highest_lowest: number;
  highest: { province: string; value: number };
  lowest: { province: string; value: number };
  source: string;
  source_url: string;
  note: string;
  provinces: ProvinceValue[];
}

export interface YearValue {
  year: number;
  value: number;
}

export interface NationalData {
  improved_drinking_water_trend: {
    indicator: string;
    source: string;
    source_url: string;
    note: string;
    values: YearValue[];
  };
  safely_managed: {
    indicator: string;
    source: string;
    source_url: string;
    urban_2024: number;
    rural_2024: number;
    values: YearValue[];
  };
  bps_2024: {
    indicator: string;
    source: string;
    source_url: string;
    national_2023: number;
    national_2024: number;
    urban_2024: number;
    rural_2024: number;
  };
  basic_drinking_water_2024: { indicator: string; source: string; value: number };
  sanitation: {
    indicator_basic: string;
    indicator_open_defecation: string;
    source_basic: string;
    source_open_defecation: string;
    basic_values: YearValue[];
    open_defecation_values: YearValue[];
  };
  contamination: { fact: string; source: string; source_url: string };
  targets_2030: { sdg_6_1: string; sdg_6_2: string };
}

export async function loadProvinces(basePath = ''): Promise<ProvincesData> {
  const res = await fetch(`${basePath}/data/provinces.json`);
  if (!res.ok) throw new Error('Failed to load provinces.json');
  return res.json();
}

export async function loadNational(basePath = ''): Promise<NationalData> {
  const res = await fetch(`${basePath}/data/national.json`);
  if (!res.ok) throw new Error('Failed to load national.json');
  return res.json();
}

export async function loadGeoJson(basePath = ''): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(`${basePath}/data/id-provinces.geojson`);
  if (!res.ok) throw new Error('Failed to load id-provinces.geojson');
  return res.json();
}

/** Rank of a province (1 = highest access), ties share the better rank. */
export function rankOf(provinces: ProvinceValue[], name: string): number | null {
  const sorted = [...provinces].sort((a, b) => b.value - a.value);
  const idx = sorted.findIndex((p) => p.name === name);
  if (idx < 0) return null;
  const value = sorted[idx].value;
  return sorted.findIndex((p) => p.value === value) + 1;
}

/** Simple linear extrapolation: years from `fromYear` until `target`, at the
 *  average annual change between the first and last point. Returns null when
 *  the trend is flat or moving away from the target. This is an illustration
 *  of pace, not a forecast. */
export function yearsToTarget(
  values: YearValue[],
  target: number,
  fromYear: number,
): number | null {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  const span = last.year - first.year;
  if (span <= 0) return null;
  const perYear = (last.value - first.value) / span;
  if (perYear <= 0) return null;
  const remaining = target - last.value;
  if (remaining <= 0) return 0;
  const targetYear = last.year + remaining / perYear;
  return Math.round(targetYear - fromYear);
}
