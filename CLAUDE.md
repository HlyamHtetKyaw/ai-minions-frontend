# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test framework is configured.

## Stack

- **Next.js 16.2.2** with App Router — see AGENTS.md warning: this version has breaking changes vs training data. Read `node_modules/next/dist/docs/` before writing code.
- **React 19.2.4**
- **TypeScript** (strict mode, `moduleResolution: bundler`)
- **Tailwind CSS v4** via `@tailwindcss/postcss` — v4 has a different config model than v3 (no `tailwind.config.js`; configured via CSS `@theme` in `globals.css`)
- Path alias: `@/*` → project root

## Architecture

### Key Next.js 16 API change
`params` and `searchParams` in page/layout files are **Promises** — always `await params` in async Server Components:
```tsx
export default async function Page({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
}
```

### File layout
```
app/
  layout.tsx          # Root layout — wraps ThemeProvider + Header
  page.tsx            # Home: hero + 15-tool card grid
  not-found.tsx       # Global 404
  [tool]/page.tsx     # Dynamic tool route; reads TOOL_CONFIGS, renders ToolForm
components/
  Header.tsx          # Server Component — nav, CSS-only feature dropdown, ThemeToggle
  ThemeProvider.tsx   # 'use client' — dark/light context, writes .dark class to <html>
  ThemeToggle.tsx     # 'use client' — button that calls ThemeProvider.toggle()
  ToolForm.tsx        # 'use client' — generic form for all 15 tools; mock submit (1.5s)
  ResultDisplay.tsx   # 'use client' — renders json (pre), text (textarea), blob (disabled button)
lib/
  constants.ts        # FEATURES[] (15 tools, name/path/icon/description), LANGUAGES[]
  tool-config.ts      # TOOL_CONFIGS Record<slug, ToolConfig> — inputType, outputType, fields
```

### Data flow
All pages are Server Components (statically prerendered via `generateStaticParams`). The only client state lives in `ToolForm` (form fields, loading, result) and `ThemeProvider` (theme). No API calls — `ToolForm` runs a `setTimeout(1500ms)` mock on submit and calls `getMockResult()` for hardcoded output.

### Tailwind v4 dark mode
Dark mode uses a `.dark` class on `<html>` (applied by `ThemeProvider`). CSS variables are defined in `globals.css` under `:root` and `.dark`, then exposed as Tailwind tokens via `@theme inline`.
