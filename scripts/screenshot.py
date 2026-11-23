"""TirtaNusa — screenshot + functional test script (Playwright, headless Chromium).

Runs against the static export served on http://127.0.0.1:8123/.
Saves screenshots to ../screenshots/ and prints a PASS/FAIL summary.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.expanduser('~/workspace/devpost/.pwfix'))  # working greenlet (wheelhouse one lacks the C ext)
sys.path.insert(1, os.path.expanduser('~/workspace/hermes/wheelhouse'))

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8123'
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, '..', 'screenshots')
os.makedirs(SHOTS, exist_ok=True)

CHROME = os.path.expanduser('~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome')

results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS' if ok else 'FAIL'), '-', name, ('| ' + detail) if detail else '')


def main():
    console_errors = []
    failed_requests = []
    all_requests = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: all_requests.append(r.url))
        page.on('requestfailed', lambda r: failed_requests.append(f'{r.url} :: {r.failure}'))
        page.on('response', lambda r: failed_requests.append(f'{r.url} :: HTTP {r.status}') if r.status >= 400 else None)

        page.goto(BASE + '/', wait_until='networkidle')
        page.wait_for_selector('path[data-province]', state='attached', timeout=20000)
        time.sleep(1.5)  # let the choropleth + markers settle

        # --- 1. Map renders with all 38 provinces ---
        n_paths = page.locator('path[data-province]').count()
        check('map renders 38 province polygons', n_paths == 38, f'found {n_paths}')
        check('hero headline visible', page.locator('h1', has_text='Clean water').count() == 1)
        check('stat band has 4 stats', page.locator('.stat').count() == 4)
        check('national figure shown', '93.2%' in page.locator('.province-bar').inner_text())

        # --- 2. Screenshot 1: hero + map (taller viewport so the whole map fits) ---
        page.set_viewport_size({'width': 1440, 'height': 1150})
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(SHOTS, '01-hero-map.png'))
        check('screenshot 01 saved', os.path.exists(os.path.join(SHOTS, '01-hero-map.png')))
        # Map element on its own (full frame incl. legend, for Devpost)
        page.locator('.map-shell').screenshot(path=os.path.join(SHOTS, '01b-map-full.png'))
        page.set_viewport_size({'width': 1440, 'height': 900})
        page.wait_for_timeout(400)

        # --- 3. Click Papua Pegunungan, verify province bar updates ---
        # The polygon's bounding-box centre can fall outside its irregular
        # shape, so dispatch the click on the path element itself.
        page.evaluate("""() => {
          const el = document.querySelector('path[data-province="Papua Pegunungan"]');
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }""")
        page.wait_for_timeout(600)
        bar = page.locator('.province-bar').inner_text()
        check('click selects Papua Pegunungan', 'Papua Pegunungan' in bar and '32.9%' in bar, bar.split('\n')[0])
        check('rank shown', 'Rank 38 of 38' in bar, bar)
        page.screenshot(path=os.path.join(SHOTS, '02-province-selected.png'))

        # --- 4. Dashboard ---
        page.evaluate("window.scrollTo({top: document.querySelector('#dashboard').offsetTop - 60, behavior: 'instant'})")
        page.wait_for_timeout(800)
        check('trend chart rendered', page.locator('#dashboard svg.chart').count() == 1)
        check('pace box present', 'At today' in page.locator('.pace-box').inner_text())
        pace = page.locator('.pace-box').inner_text()
        check('pace years computed', '≈' in pace, pace.replace('\n', ' | ')[:200])
        page.screenshot(path=os.path.join(SHOTS, '03-dashboard.png'))

        # --- 5. Reports: form + submit ---
        page.evaluate("window.scrollTo({top: document.querySelector('#reports').offsetTop - 60, behavior: 'instant'})")
        page.wait_for_timeout(500)
        check('3 example reports listed', page.locator('.report-item').count() == 3)
        page.select_option('#r-province', 'Jambi')
        page.fill('#r-place', 'Testville (automated test)')
        page.locator('.chip', has_text='Murky / cloudy').click()
        page.fill('#r-text', 'Automated test report: the well water turns brown after rain.')
        page.locator('button[type="submit"]', has_text='Send report').click()
        page.wait_for_selector('.form-ok', timeout=5000)
        check('report submit shows success', True)
        check('new report appears first in list', page.locator('.report-item').first.inner_text().find('Automated test report') >= 0)
        check('report count is 4', page.locator('.report-item').count() == 4)
        first = page.locator('.report-item').first.inner_text()
        check('submitted report is in Jambi (form select wins over map pre-fill)',
              first.startswith('Jambi'), first.split('\n')[0])
        # Real marker check: overlay paths = 38 provinces + 1 per report.
        overlay_paths = page.evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length")
        check('new report marker on map', overlay_paths == 38 + 4, f'{overlay_paths} overlay paths')
        page.screenshot(path=os.path.join(SHOTS, '04-reports.png'))

        # --- 6. Sources + footer ---
        page.evaluate("window.scrollTo({top: document.querySelector('#sources').offsetTop - 60, behavior: 'instant'})")
        page.wait_for_timeout(500)
        check('sources list has 7 entries', page.locator('.sources ol li').count() == 7)
        page.screenshot(path=os.path.join(SHOTS, '05-sources-footer.png'))

        # --- 7. Full page ---
        page.screenshot(path=os.path.join(SHOTS, '00-full-page.png'), full_page=True)

        # --- 8. No console errors / failed requests / external calls ---
        check('no console errors', len(console_errors) == 0, '; '.join(console_errors[:3]))
        check('no failed requests', len(failed_requests) == 0, '; '.join(failed_requests[:3]))
        external = [u for u in all_requests if not u.startswith(BASE)]
        check('fully self-contained (no external requests)', len(external) == 0, '; '.join(external[:3]))

        browser.close()

    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
    with open(os.path.join(SHOTS, 'test-results.json'), 'w') as f:
        json.dump([{'name': n, 'pass': ok, 'detail': d} for n, ok, d in results], f, indent=2)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
