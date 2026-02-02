# Claude Console

**Enterprise-grade local UI for Claude Code** — Real-time streaming, session management, and a beautiful interface.

<p align="center">
  <img src="docs/screenshot.png" alt="Claude Console Screenshot" width="800" />
</p>

## Features

- **Real-time Streaming** — Watch Claude think and respond token-by-token
- **Session Management** — Create, rename, resume, and organize conversations
- **Tool Visualization** — See exactly what Claude is doing (file reads, edits, bash commands)
- **Syntax Highlighting** — Beautiful code blocks with language detection
- **Dark/Light Themes** — Easy on the eyes, day or night
- **Local-First** — Your data stays on your machine, sessions persist in SQLite
- **Docker Ready** — One command to deploy
- **Enterprise Architecture** — TypeScript, React, WebSockets, proper error handling

## Quick Start

### Prerequisites

- Node.js 18+
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Authenticated with Claude (`claude auth`)

### Development

```bash
# Clone and install
cd claude-console
npm install

# Start both frontend and backend
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001

### Production (Docker)

```bash
# Build and run
npm run docker:build
npm run docker:up
```

Access at http://localhost:3000

## Architecture

```
claude-console/
├── packages/
│   ├── backend/          # Express + Socket.io server
│   │   ├── src/
│   │   │   ├── config/       # Environment configuration
│   │   │   ├── db/           # SQLite with better-sqlite3
│   │   │   ├── services/     # Business logic
│   │   │   │   ├── claude.service.ts    # Claude CLI integration
│   │   │   │   └── session.service.ts   # Session CRUD
│   │   │   ├── socket/       # WebSocket handlers
│   │   │   └── types/        # TypeScript types
│   │   └── package.json
│   │
│   └── frontend/         # React + Vite application
│       ├── src/
│       │   ├── components/   # React components
│       │   │   ├── chat/         # Chat interface
│       │   │   ├── sidebar/      # Conversation list
│       │   │   ├── tools/        # Tool execution cards
│       │   │   ├── common/       # Buttons, inputs, etc.
│       │   │   └── layout/       # App layout
│       │   ├── services/     # Socket.io client
│       │   ├── store/        # Zustand state management
│       │   └── styles/       # Tailwind CSS
│       └── package.json
│
├── docker/               # Docker configuration
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── docker-compose.yml
│   └── nginx.conf
│
└── package.json          # Workspace root
```

## How It Works

1. **Frontend** connects to backend via WebSocket (Socket.io)
2. **Backend** spawns Claude CLI processes with `--output-format stream-json`
3. **Streaming events** are parsed and forwarded to the frontend in real-time
4. **Sessions** are persisted in SQLite with full message history
5. **Claude session IDs** are preserved for resume capability

```
┌─────────────────┐     WebSocket     ┌──────────────────┐     spawn     ┌─────────────┐
│  React Frontend │ <───────────────> │  Express Backend │ <──────────>  │  Claude CLI │
│   (Vite + TS)   │                   │  (Socket.io)     │               │  (stream)   │
└─────────────────┘                   └──────────────────┘               └─────────────┘
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │   SQLite DB  │
                                      │  (sessions)  │
                                      └──────────────┘
```

## Configuration

### Environment Variables

Create a `.env` file in the backend package:

```env
# Server
PORT=3001
HOST=0.0.0.0

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Database
DB_PATH=./data/claude-console.db

# Claude CLI path (if not in PATH)
CLAUDE_PATH=claude

# Logging
LOG_LEVEL=info

# Limits
MAX_CONCURRENT_SESSIONS=10
SESSION_TIMEOUT_MS=1800000
```

## API Reference

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `session:create` | `{ name?, workingDirectory? }` | Create new session |
| `session:list` | - | List all sessions |
| `session:get` | `sessionId` | Get session with messages |
| `session:delete` | `sessionId` | Delete session |
| `session:rename` | `{ sessionId, name }` | Rename session |
| `message:send` | `{ sessionId, content }` | Send message to Claude |
| `message:cancel` | `sessionId` | Cancel current response |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message:start` | `{ messageId, sessionId }` | Response started |
| `message:stream` | `{ delta, fullContent }` | Token streamed |
| `message:complete` | `{ message }` | Response complete |
| `message:error` | `{ error, code }` | Error occurred |
| `tool:start` | `{ tool }` | Tool execution started |
| `tool:complete` | `{ tool }` | Tool execution complete |

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api` | API info |

## Development

### Project Scripts

```bash
# Development (both packages)
npm run dev

# Development (individual)
npm run dev:backend
npm run dev:frontend

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Clean
npm run clean
```

### Tech Stack

**Backend:**
- Express 4
- Socket.io 4
- better-sqlite3
- TypeScript 5
- Zod (validation)
- Winston (logging)

**Frontend:**
- React 18
- Vite 5
- Tailwind CSS 3
- Zustand (state)
- Socket.io-client
- react-markdown + remark-gfm
- prism-react-renderer
- Lucide icons

## Customization

### Adding New Tool Visualizations

Edit `packages/frontend/src/components/tools/ToolCard.tsx`:

```tsx
const toolIcons: Record<string, React.ReactNode> = {
  // Add your custom tool icon
  MyTool: <MyIcon size={16} />,
};

const toolColors: Record<string, string> = {
  // Add your custom tool color
  MyTool: 'text-pink-400',
};
```

### Theming

Edit `packages/frontend/tailwind.config.js` to customize:
- Colors (`claude-orange`, `dark-*`)
- Fonts
- Animations

### Adding Features

The codebase is designed for extensibility:
- **New socket events**: Add to `types/index.ts`, handle in `socket/index.ts`
- **New UI components**: Create in `components/`, compose in layout
- **State management**: Add slices to `store/`

## Troubleshooting

### Claude CLI not found

```bash
# Ensure Claude is installed and in PATH
which claude
claude --version

# Or set CLAUDE_PATH environment variable
CLAUDE_PATH=/path/to/claude npm run dev:backend
```

### Connection issues

1. Check backend is running: `curl http://localhost:3001/health`
2. Check CORS origins match your frontend URL
3. Check browser console for WebSocket errors

### Database issues

```bash
# Reset database
rm -rf packages/backend/data/claude-console.db
npm run dev:backend
```

## License

MIT

## Credits

Built with [Claude Code](https://github.com/anthropics/claude-code) by Anthropic.
