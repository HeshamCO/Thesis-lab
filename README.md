# TanStack Start App

A cleaned TanStack Start starter. The generated demo features have been removed so the project can be used as a fresh application base.

## Stack

- TanStack Start
- TanStack Router with file-based routes
- TanStack Query wired into the router context
- React 19
- Vite
- Tailwind CSS 4
- shadcn-compatible UI primitives
- Biome
- Vitest

## Getting Started

Install dependencies:

```bash
bun install
```

Run the development server:

```bash
bun --bun run dev
```

The dev server uses port `3333`.

## Scripts

```bash
bun --bun run dev
bun --bun run build
bun --bun run preview
bun --bun run typecheck
bun --bun run lint
bun --bun run format
bun --bun run test
```

## Project Shape

- `src/routes/__root.tsx` owns the document shell, metadata, global CSS, layout, and devtools.
- `src/routes/index.tsx` is the home route.
- `src/routes/about.tsx` is a small second route for navigation examples.
- `src/router.tsx` creates the router and connects the TanStack Query SSR integration.
- `src/integrations/tanstack-query/root-provider.tsx` creates the per-router query context.
- `src/components/ui` contains reusable shadcn-style primitives.
- `src/styles.css` defines Tailwind CSS 4 and the CSS variable theme.

## Notes

The original scaffold included demo AI chat, form, table, store, guitar recommendation, and Prisma/Todo examples. Those were removed from the fresh starter. The practical template notes are captured in [`TEMPLATE_SUMMARY.md`](./TEMPLATE_SUMMARY.md).
