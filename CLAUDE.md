# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server at http://localhost:3000 (uses Turbopack)
npm run dev:daemon   # Start dev server in background, logs to logs.txt
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests (Vitest + jsdom)
npm run db:reset     # Reset database (destructive)
npx prisma migrate dev  # Run new migrations after schema changes
```

Run a single test file:
```bash
npx vitest src/lib/__tests__/file-system.test.ts
```

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude generates them via tool calls, and they render in a live preview.

### Data Flow

1. **Chat** (`src/lib/contexts/chat-context.tsx`): Uses Vercel AI SDK's `useChat` hook pointing to `/api/chat`. Sends the entire serialized virtual file system with each request.
2. **API Route** (`src/app/api/chat/route.ts`): Reconstructs the VFS, calls `streamText` with two tools: `str_replace_editor` and `file_manager`. On finish, saves to DB if user is authenticated.
3. **Tool Calls**: Streamed tool calls are intercepted on the client via `onToolCall`, which updates the VFS through `FileSystemContext.handleToolCall`.
4. **Preview** (`src/components/preview/PreviewFrame.tsx`): On every VFS change, transforms all JSX/TSX files via Babel Standalone, creates blob URLs, and writes an `importMap` into a sandboxed iframe. React/ReactDOM are loaded from `esm.sh`. Third-party imports are also resolved through `esm.sh`.

### Virtual File System

`src/lib/file-system.ts` — `VirtualFileSystem` is an in-memory tree; nothing is written to disk. It supports standard file operations plus text-editor commands (`replaceInFile`, `insertInFile`, `viewFile`) that the AI tools use directly. It serializes to/from plain JSON objects for persistence and network transport.

### AI Provider

`src/lib/provider.ts` — If `ANTHROPIC_API_KEY` is set, uses `claude-haiku-4-5` via `@ai-sdk/anthropic`. Without a key, `MockLanguageModel` returns static code (a counter/form/card component) to allow offline development.

### Authentication

Cookie-based JWT auth (`src/lib/auth.ts`, `server-only`). Sessions last 7 days. The middleware (`src/middleware.ts`) protects `/api/projects` and `/api/filesystem`. The `/api/chat` endpoint is open — anonymous users can generate components, with work tracked in `src/lib/anon-work-tracker.ts` (localStorage). Authenticated users have work persisted in the database.

### Database

Prisma with SQLite (`prisma/schema.prisma`). Two models: `User` and `Project`. `Project.messages` and `Project.data` store JSON as strings. The Prisma client is generated to `src/generated/prisma/`.

### JSX Transform Pipeline

`src/lib/transform/jsx-transformer.ts` — For each JS/JSX/TS/TSX file:
- Strips CSS imports (collected separately)
- Transforms via `@babel/standalone` with React automatic runtime + optional TypeScript preset
- Creates a blob URL from the transformed code
- Builds an ES import map covering local files, `@/` aliases, and third-party packages via `esm.sh`
- Missing local imports get placeholder stub modules instead of failing

### Key Contexts

- `FileSystemProvider` — manages VFS state, exposes `handleToolCall` which translates AI tool calls into VFS mutations
- `ChatProvider` — wraps Vercel AI SDK's `useChat`, routes tool calls to `FileSystemProvider`

Both contexts are provided in `src/app/main-content.tsx`.
