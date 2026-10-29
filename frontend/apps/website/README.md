# Eleven Nodes website

The marketing site for the agent workflow workspace. It is a static Vite + React + Tailwind app with no backend
of its own: every **Try now** and **Sign in** sends the visitor to the workspace app.

```bash
npm install
npm run dev      # http://127.0.0.1:5175
npm run build    # static files in dist/
```

## Pages

| Path          | Page        | Source                                                        |
| ------------- | ----------- | ------------------------------------------------------------- |
| `/`           | Product     | `src/pages/Home.tsx` (sections in `src/sections/`)            |
| `/docs/`      | Docs        | `src/pages/Docs.tsx`, content in `src/content/docs.tsx`       |
| `/pricing/`   | Pricing     | `src/pages/Pricing.tsx`, plans in `src/content/plans.ts`      |
| `/community/` | Community   | `src/pages/Community.tsx`                                     |

Each page is its own HTML file (`index.html`, `docs/index.html`, ...), so a static host serves every URL as it
is, with no rewrite rules. To add a page: add its HTML file, an entry in `src/entries/`, the page component, its
`build.rollupOptions.input` line in `vite.config.ts` and its link in `pages` in `src/config.ts`.

**Before launch:** the plans, prices, limits and billing answers in `src/content/plans.ts` are placeholders.

## Domains

Each piece is deployed on its own and has its own address. The domain is not bought yet, so `abc.com` stands in
for it; nothing in the code names the domain except the environment below.

| Address                   | What runs there                     | App in this repo / service         |
| ------------------------- | ----------------------------------- | ---------------------------------- |
| `www.abc.com` (and apex)  | This website                        | `apps/website` (static files)      |
| `cloud.abc.com`           | The workspace: canvas, assistant, runs | `apps/workspace_app` (static SPA) |
| `api.abc.com`             | The API                             | the backend (FastAPI)              |
| `admin.abc.com`           | Admin Center                        | `apps/admin_center`                |

`develop.abc.com` (or `cloud-dev.abc.com`) can host a staging build of the workspace the same way.

**Try now** opens `${VITE_APP_URL}/`, the workspace at its root. The workspace asks the visitor to sign in first if
they are not, then opens the canvas.

## Configuration

Set at build time (see `.env.example`; `.env.development` points at the local workspace dev server):

| Variable             | Example                  | Used for                              |
| -------------------- | ------------------------ | ------------------------------------- |
| `VITE_APP_URL`       | `https://cloud.abc.com`  | Try now, Sign in                      |
| `VITE_SITE_URL`      | `https://www.abc.com`    | The site's own address                |
| `VITE_CONTACT_EMAIL` | `hello@abc.com`          | "Talk to us" and Contact              |
| `VITE_COMMUNITY_DISCORD`, `_GITHUB`, `_X`, `_YOUTUBE` | channel URLs | Community page; a channel without one shows "Coming soon" |

Changing the domain later is a rebuild with new values, with no code change.

## Deploying

1. Build with the production values: `VITE_APP_URL=https://cloud.<domain> npm run build`.
2. Serve `dist/` from any static host or CDN at `www.<domain>`, and redirect the apex (`<domain>`) to it.
   Every page is its own HTML file, so no rewrites are needed.
3. Point `cloud.<domain>` at the workspace build, configured with the API at `api.<domain>`. The API must allow
   the workspace's origin (CORS). The website never calls the API, so it needs no CORS entry.

## Design

- **Restraint over decoration.** White page, ink type, one brand colour (forest green, `#163D2D`) for primary
  actions. Orange appears only inside product mockups, where the real product uses it for the assistant's
  reasoning dots. Change colours match the canvas: new in green, edited in amber, removed in red.
- **One grid.** Every section is a `Frame` (`src/components/Frame.tsx`): hairline rails at the sides of the content
  column, a hairline between sections and a small plus where they cross. Rows and cells inside are divided by the
  same hairlines.
- **Type.** Inter, tight tracking; headlines are two-tone (the second half in grey, via `<em>` in `Heading`);
  section labels are small mono caps with a green square. JetBrains Mono for figures and labels in mockups.
- **The product is the hero.** `FlowStage` plays the assistant building a draft and a run flowing through it; the
  feature rows use mockups drawn from the workspace (`src/components/mocks.tsx`): the assistant's reasoning, a
  draft on the canvas, a run trace and the model picker.
- **Quiet motion.** Sections fade up once as they scroll in; mockups animate once while on screen. Everything
  honours `prefers-reduced-motion`.
- Checked from 390px phones to 1920px desktops with no sideways scroll.

## Icons

Provider logos (`public/providers/`) are the real brand marks from LobeHub Icons (MIT); community channel marks
(`src/content/brands.tsx`) are from Simple Icons (CC0). See `public/providers/ATTRIBUTION.txt`. Only providers
the workspace supports are shown as built in; the outer ring of the models orbit shows examples reached through
an OpenAI-compatible model client.
