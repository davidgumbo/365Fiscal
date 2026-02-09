# Frontend Documentation (React + Vite)

This document describes the frontend application, development workflow, configuration, and how it integrates with the backend API.

## Stack

- React + TypeScript
- Vite dev server and build
- Tailwind CSS

## Layout

- `index.html`: Vite HTML entry.
- `src/main.tsx`: Application mount point.
- `src/App.tsx`: Root component.
- `src/api.ts`: HTTP client utilities for backend REST API.
- `src/components/`: Reusable UI components.
- `src/pages/`: Page-level views (dashboard, entities).
- `src/context/`: React contexts for app/global state.
- `src/hooks/`: Custom hooks (auth, data fetching).
- `styles.css`: Tailwind stylesheet.
- `vite.config.ts`: Vite configuration (server, proxy, build).
- `tailwind.config.cjs`, `postcss.config.cjs`: Tailwind setup.
- `tsconfig.json`: TypeScript config.

## Development (macOS, zsh)

```
cd 365Fiscal/frontend
npm install
npm run dev
```

Open the app at the printed dev URL (typically `http://localhost:5173`).

## Backend Integration

- API base URL configured in `src/api.ts`.
- Auth: client stores JWT from `POST /api/auth/password-login` and adds `Authorization: Bearer <token>` to requests.
- CORS: ensure backend `CORS_ORIGINS` includes your dev origin.

## Common Tasks

- Lint/format: use your preferred tooling; add eslint/prettier as needed.
- Build for production:

```
npm run build
```

- Preview production build locally:

```
npm run preview
```

## Troubleshooting

- CORS errors: fix backend `CORS_ORIGINS` or Vite proxy.
- 401 Unauthorized: ensure JWT is stored and attached; login first.
- API base URL: verify `src/api.ts` matches backend server host/port.

## Notes

- Tailwind is configured via `tailwind.config.cjs`; import `styles.css` in `main.tsx`.
- For environment-specific API URLs, use Vite env (`import.meta.env`) or a proxy in `vite.config.ts`.
