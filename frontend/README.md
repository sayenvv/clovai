# Eleven Nodes frontend

Three separate Vite apps. Each has its own `package.json`, so install and run them one at a time.

| App | Folder | Dev URL | What it is |
|---|---|---|---|
| Workspace | `apps/workspace_app` | http://127.0.0.1:5173 | The main product: designer, Workflow AI chat, console |
| Admin Center | `apps/admin_center` | http://127.0.0.1:5174 | Workspace administration: users, workflows, access, activity |
| Admin Dashboard | `apps/admin_dashboard` | http://127.0.0.1:5175 | Application config documents and variables |

```bash
cd apps/<app>
npm install
npm run dev
```

All three proxy `/api` to the backend on http://127.0.0.1:8000.
