# Eleven Nodes — Admin Center

Standalone micro-app for workspace administration. Runs separately from the main `frontend` product.

## Develop

```bash
cd admin-center
npm install
npm run dev
```

Opens at **http://127.0.0.1:5174**

Main product (tools / marketing) stays on **http://127.0.0.1:5173**.

## Env

See `.env.example` for links back to the main app (`VITE_MAIN_APP_URL`, etc.).
