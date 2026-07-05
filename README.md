# Clovai — AI Diagram Tools Platform

A production-grade, **configuration-driven** React application for an AI-powered diagram tools platform (flowcharts, architecture diagrams, UML, BPMN, ER diagrams, mind maps and more).

The entire UI — navbar, tools mega menu, landing page sections, pricing, footer, forms — is rendered from **versioned JSON configuration**, validated with Zod and managed from a built-in admin console. Adding tools, pages, tabs or sections requires **zero React code changes**.

## Stack

| Concern    | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | React 19 + TypeScript (strict) + Vite         |
| Styling    | Tailwind CSS + shadcn/ui-style primitives     |
| Icons      | Lucide (resolved at runtime from JSON names)  |
| Animation  | Framer Motion (respects reduced motion)       |
| Routing    | React Router v7 (lazy, code-split routes)     |
| Data       | TanStack Query (caching, invalidation)        |
| Validation | Zod (single source of truth for types)        |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

## Key routes

- `/` — JSON-driven landing page (hero, tools, features, workflow, templates, enterprise, pricing, testimonials, FAQ, CTA, contact form)
- `/tools` — searchable, filterable tools directory
- `/tools/:toolId` — **canvas designer workspace** (n8n-style): drag-and-drop shape palette, pan/zoom canvas, connections, inline renaming, JSON export, local autosave. Shape palettes are defined per tool in JSON (`designer.palette`); the Flowchart Generator ships with a full flowchart palette. AI generation (the multi-agent **Clovai Engine**) is surfaced as coming soon.
- `/admin/config` — **Configuration Console**: upload, edit, validate, preview, save, version, activate and delete configurations
- `/:slug` — any extra page defined purely in JSON config

## Architecture

```
config/                    # All JSON configuration modules (root level)
├── navbar.json            # Logo, nav items, action buttons
├── mega-menu.json         # Tool categories + all tools
├── landing-page.json      # Landing page sections
├── footer.json            # Footer columns, socials, legal links
└── theme.json             # Theme settings

src/
├── components/
│   ├── ui/                # shadcn-style primitives (button, card, tabs, dialog, ...)
│   ├── layout/            # AppLayout, Navbar, MegaMenu, MobileMenu, Footer
│   ├── sections/          # One component per JSON section type (all lazy-loaded)
│   ├── designer/          # Canvas designer: palette, nodes, edges, pan/zoom, toolbar
│   ├── shared/            # Icon resolver, CtaButton, Reveal, ErrorBoundary, ...
│   └── dynamic-renderer/  # section-registry, SectionRenderer, PageRenderer
├── config/
│   └── default-config.ts  # Assembles + validates the default config at startup
├── pages/                 # Route components (incl. pages/admin/* console)
├── routes/                # Router with lazy imports
├── services/              # config-api.ts (service functions) + config-store.ts (mock DB)
├── hooks/                 # use-config (React Query), use-app-config (context), use-theme
├── types/                 # All types inferred from Zod schemas
├── schemas/               # config.schema.ts — the JSON contract
├── utils/                 # cn, collection (order/visibility), format
└── constants/             # Routes, query keys, storage keys
```

### How the JSON-driven rendering works

1. `AppLayout` fetches the **active configuration** via React Query (`getActiveConfig`) and provides it through `AppConfigProvider`. A skeleton screen shows while loading; errors get a retry panel.
2. `PageRenderer` receives a page from config, sorts its sections by `order`, filters by `isVisible`, and delegates each to `SectionRenderer`.
3. `SectionRenderer` looks up the section `type` in the **section registry** — a map of lazy-loaded components — and renders it inside its own error boundary, so one bad section never breaks the page.
4. Supported section types: `hero`, `cardsGrid`, `toolGrid`, `steps`, `tabs`, `accordion`, `pricing`, `testimonials`, `split`, `cta`, `form`.

**Adding a new section type:** add a Zod variant in `schemas/config.schema.ts`, create a component in `components/sections/`, and register it in `dynamic-renderer/section-registry.ts`. Everything else (types, validation, rendering) follows automatically.

**Adding a new tool / nav item / page:** edit JSON only.

### Configuration lifecycle (admin flow)

1. Admin uploads a `.json` file (drag & drop or browse) or loads/downloads the sample at `/admin/config`.
2. The file is validated against the Zod schema; issues are listed with exact JSON paths.
3. Valid configs can be **previewed live** in a dialog using the same dynamic renderer as the real site.
4. Saving stores the config as a new **version** through the service layer; existing configs can be loaded, edited and updated.
5. Exactly **one configuration is active** at a time — activating a version re-renders the whole site from it. The active version cannot be deleted.

### Backend integration

All API access goes through `src/services/config-api.ts` — clean, typed service functions matching these assumed endpoints:

| Function             | Endpoint                          |
| -------------------- | --------------------------------- |
| `getActiveConfig()`  | `GET /api/configs/active`         |
| `listConfigs()`      | `GET /api/configs`                |
| `getConfig(id)`      | `GET /api/configs/:id`            |
| `validateConfig()`   | `POST /api/configs/validate`      |
| `saveConfig()`       | `POST /api/configs`               |
| `updateConfig(id)`   | `PUT /api/configs/:id`            |
| `activateConfig(id)` | `POST /api/configs/:id/activate`  |
| `deleteConfig(id)`   | `DELETE /api/configs/:id`         |

The current implementation is backed by a localStorage mock (`config-store.ts`) so the full flow works out of the box. Swap the function bodies for `fetch` calls and **nothing else in the app changes**.

## Performance

- Every route **and** every section component is lazy-loaded (`React.lazy` + Suspense fallbacks).
- Vendor code is split into cache-friendly chunks (react, motion, query, icons).
- List-rendering components are memoized; config lookups use `useMemo`.
- React Query caches the active config (5 min stale time) and invalidates on mutations.
- Framer Motion animations respect `prefers-reduced-motion`.
- Dark mode is applied pre-paint via an inline script (no flash).

## Sample JSON

The default configuration lives in the root-level `config/` folder (navbar, mega menu with 12 tools in 4 categories, footer, theme, and the full landing page). From the admin console you can also **Download JSON** to get the complete assembled sample file.
