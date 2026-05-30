# Frontend — Spring AI RAG Pipeline

React 18 + Vite frontend with 8 tabs for interacting with the RAG pipeline backend.

## Prerequisites

- Node.js 18+
- npm
- Backend running on `http://localhost:8080`

## Running

```bash
npm install
npm run dev
```

App starts on `http://localhost:5173`.

## Building for production

```bash
npm run build
```

Output goes to `dist/`.

## Tabs

| Tab | Backend call | Description |
|---|---|---|
| Upload | `POST /upload` | Upload a PDF and index it |
| Stream | `GET /api/ai/stream` | Real-time SSE streaming answer |
| Precise | `GET /api/ai/precise` | Fact-checked answer (waits for full response) |
| Chat | `GET /api/ai/chat` | Multi-turn conversation with memory |
| Compare | Both stream + precise | Side-by-side quality vs speed comparison |
| Evaluate | `GET /api/ai/evaluate` | Score an answer's groundedness manually |
| Manage | `DELETE /upload/clear` | Clear Chroma DB or a chat session |
| Metrics | `GET /actuator/metrics/*` | Live query counts and latency |

## Session identity

A `sessionId` is generated on first load and persisted in `sessionStorage`. It is used as `chatId` for the Stream, Chat, Compare, and Manage tabs to associate server-side chat history with the correct browser session. Opening a new tab starts a fresh session.

## SSE streaming

The `readStream()` helper in `App.jsx` is shared by Stream, Chat, and Compare. It reads the response body chunk by chunk, accumulates `data:` lines, and calls `onChunk(acc)` on every new token — producing the real-time typewriter effect.
