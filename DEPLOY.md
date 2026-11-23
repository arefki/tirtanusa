# Deploy — TirtaNusa

The app is a **static export** (`output: 'export'` in `next.config.mjs`).
`npm run build` produces a plain `out/` folder that any static host can serve.
No server, no environment variables required (Supabase is optional).

## Option A — GitHub Pages (free, recommended)

The repo owner creates the repository and pushes this folder. Then:

1. In the repo: **Settings → Pages → Build and deployment → GitHub Actions**.
2. Add `.github/workflows/deploy.yml` (see below).
3. Push. The site goes live at `https://<username>.github.io/<repo>/`.

**Important:** for a project page (`<username>.github.io/<repo>/`), the build
must know the sub-path. The workflow below sets it automatically from the repo
name. For a user/org page (`<username>.github.io`) or a custom domain, leave
`NEXT_PUBLIC_BASE_PATH` empty.

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Option B — any static host (Netlify, Cloudflare Pages, Vercel)

- Build command: `npm run build`
- Publish directory: `out`
- No environment variables needed (unless Supabase is connected).

## Option C — local preview

```bash
npm run build
npx serve out        # or: python3 -m http.server 8000 -d out
```

## Optional: shared reports via Supabase (free tier)

1. Create a free project at https://supabase.com/dashboard.
2. Run `supabase/schema.sql` in the SQL editor.
3. Set build-time variables (GitHub Actions secrets, or your host's env settings):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<project>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the project's anon/public key
4. Rebuild. The app detects the configuration automatically; without it,
   reports stay in each visitor's browser and the UI says so.
