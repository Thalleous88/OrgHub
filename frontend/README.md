# OrgHub Frontend

React, TypeScript, and Vite client for OrgHub.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Source Structure

```text
src/
├── assets/       Static images used by the application
├── components/   Reusable components grouped by feature
│   ├── layout/   Application shell, sidebar, and top bar
│   └── ui/       Generic UI primitives
├── context/      Application-wide React contexts
├── hooks/        Shared hooks and React Query integrations
├── lib/          API transport, errors, and query configuration
├── pages/        Route-level components grouped by feature
├── services/     Backend API operations grouped by resource
├── styles/       Global styles and design tokens
└── types/        Shared TypeScript types
```

Keep route-specific UI in its matching `pages/<feature>` or
`components/<feature>` directory. Components shared across features belong in
`components/ui` or `components/layout`; API calls and response types stay in
`services` and `types`.
