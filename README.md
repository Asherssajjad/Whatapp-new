# WhatsApp AI Bot v2.0

A production-grade, full-stack WhatsApp AI chatbot built with **TypeScript everywhere**, **GPT-4o**, multi-number support, advanced automation, and a modern real-time dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI** | OpenAI GPT-4o (chat, vision, tool calls), Whisper (voice), text-embedding-3-small (RAG) |
| **WhatsApp** | Meta WhatsApp Cloud API v21.0 |
| **Backend** | Node.js, Express 5, TypeScript (strict), Prisma ORM |
| **Database** | PostgreSQL + pgvector (semantic search) |
| **Realtime** | Socket.io |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **State** | Zustand + TanStack React Query |
| **Deployment** | Railway (or any Node.js host) |

---

## Features

- **GPT-4o AI replies** — Vision, voice, tool calls, RAG context
- **Multi-WhatsApp number** — Connect multiple numbers per organization  
- **RAG knowledge base** — Ingest URLs and manual text, semantic search with pgvector
- **Voice transcription** — Whisper with Urdu → Roman Urdu romanization
- **Lead scoring** — Keyword-based scoring, hot lead alerts
- **Human agent escalation** — AI detects when to hand off, notifies agent via WhatsApp
- **Broadcast campaigns** — Send to filtered contacts with rate limiting
- **Scheduled messages** — Deliver messages at future times
- **Automation flows** — Trigger-based actions (new contact, keyword match, etc.)
- **Real-time dashboard** — Live chat, analytics charts, contact management
- **Multi-tenant** — Multiple organizations on one instance
- **JWT auth** — Access + refresh tokens, role-based (SUPER_ADMIN, ORG_ADMIN, AGENT)
- **Dark mode** — Full dark/light theme support

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd "New whatsapp"
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your values
```

Required `.env` values:
- `DATABASE_URL` — PostgreSQL connection string
- `OPENAI_API_KEY` — Your OpenAI API key
- `VERIFY_TOKEN` — Any string you choose (used to verify Meta webhook)

### 3. Initialize Database

```bash
cd backend
npx prisma generate
npx prisma db push
```

### 4. Configure Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Edit if your backend runs on a different port
```

### 5. Run (Development)

```bash
# From root directory — starts both backend and frontend
npm run dev
```

Or separately:
```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 3000)
cd frontend && npm run dev
```

### 6. Log In

Visit `http://localhost:3000`  
Default credentials: set in `backend/.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)

---

## Meta Webhook Setup

1. Go to [Meta Developer Portal](https://developers.facebook.com)
2. Open your WhatsApp App → Configuration → Webhooks
3. Callback URL: `https://yourdomain.com/webhook`
4. Verify Token: same as `VERIFY_TOKEN` in your `.env`
5. Subscribe to: `messages`

---

## Deployment (Railway)

```bash
# Backend service — root directory: backend
# Frontend service — root directory: frontend

# Backend env vars needed in Railway:
DATABASE_URL, OPENAI_API_KEY, VERIFY_TOKEN, JWT_SECRET, JWT_REFRESH_SECRET
CORS_ORIGINS=https://your-frontend-domain.up.railway.app

# Frontend env vars:
NEXT_PUBLIC_API_URL=https://your-backend-domain.up.railway.app/api
NEXT_PUBLIC_SOCKET_URL=https://your-backend-domain.up.railway.app
```

---

## API Routes Reference

```
POST /webhook                    WhatsApp incoming messages
GET  /webhook                    Webhook verification

POST /api/auth/login             Login
POST /api/auth/refresh           Refresh token
GET  /api/auth/me                Get current user

GET  /api/contacts               List contacts (paginated, filterable)
PUT  /api/contacts/:phone        Update contact
POST /api/contacts/:phone/toggle-ai  Toggle AI on/off
GET  /api/contacts/:phone/messages   Get message history
POST /api/messages/send          Send manual message

GET  /api/analytics              Dashboard stats

GET  /api/knowledge              List knowledge bases
POST /api/knowledge/url          Ingest website URL
POST /api/knowledge/manual       Add manual knowledge

GET  /api/numbers                List WhatsApp numbers
POST /api/numbers                Add new number

GET  /api/campaigns              List campaigns
POST /api/campaigns              Create campaign
POST /api/campaigns/:id/launch   Launch campaign now

GET  /api/automations            List automations
POST /api/automations            Create automation

GET  /api/agents                 List human agents
POST /api/agents                 Add agent
```

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/          Environment config
│   │   ├── lib/             Prisma client
│   │   ├── middleware/      Auth, error handling
│   │   ├── services/        WhatsApp, OpenAI, Vector, Voice, AI, Socket, Automation
│   │   ├── controllers/     Webhook, Chat, Auth, Knowledge, Numbers, Automation, Admin
│   │   ├── routes/          All API routes
│   │   ├── types/           TypeScript types
│   │   ├── app.ts           Express app
│   │   └── server.ts        Entry point + DB seeding
│   └── prisma/schema.prisma Database schema
└── frontend/
    ├── app/
    │   ├── login/           Login page
    │   └── dashboard/       Chat, Analytics, Contacts, Knowledge, Automation, Numbers, Settings
    ├── components/
    │   ├── ui/              Button, Badge, Avatar, Input, Toast
    │   ├── chat/            ContactList, ChatWindow, ContactDetails
    │   └── dashboard/       Sidebar
    ├── services/            API client, Socket.io client
    ├── store/               Zustand (auth, ui)
    ├── hooks/               useSocket
    └── types/               TypeScript types
```
