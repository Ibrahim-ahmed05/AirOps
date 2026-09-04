# AirOps — Scalability & Production Readiness Lab

AirOps is a deliberately small but production-realistic airline operations dashboard designed specifically for scalability, load-testing, frontend performance, database performance, failure-handling, and production-readiness experiments.

The purpose of this project is **NOT** to build a feature-rich airline product.

The purpose is to answer:
> *"How does the application behave as dataset size and concurrent usage increase, where does it break, what is the bottleneck, and what architectural changes improve its capacity?"*

## Scaling Goals & Experimentation Roadmap

AirOps will eventually be load-tested under:
- **Concurrent Users:** 50, 100, 150, 250, 500, and 1,000 VUs.
- **Dataset Volume:** 10,000, 100,000, 500,000, and 1,000,000 flight records.

We intentionally follow this methodology:
`Build` → `Measure` → `Break` → `Identify Bottleneck` → `Optimize` → `Measure Again`

---

## System Architecture & Monorepo Structure

AirOps uses an npm workspace monorepo layout keeping frontend and backend clearly separated so they can be measured and scaled independently:

```
.
├── apps/
│   ├── api/             # Fastify Backend API (TypeScript, Drizzle ORM, Pino)
│   └── web/             # Next.js Frontend Dashboard (TypeScript, Tailwind CSS)
├── docs/                # Architecture docs, setup guide, decisions
├── load-tests/          # k6 load testing scripts & scenarios
├── docker-compose.yml   # PostgreSQL 16 local database container
├── package.json         # Workspace root package definition & scripts
└── README.md            # Root project guide
```

---

## Chosen Technology Stack & ORM Rationale

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | **Next.js + TypeScript** | Modern SSR/Client rendering with clean TypeScript boundaries. |
| **UI** | **Tailwind CSS** | Utility-first styling for fast, responsive UI without runtime CSS-in-JS overhead. |
| **Backend** | **Node.js + Fastify** | High-performance HTTP server with `fast-json-stringify` and `pino` logger for high request throughput. |
| **Database** | **PostgreSQL 16** | Robust relational database running locally via Docker Compose. |
| **ORM / Query Layer** | **Drizzle ORM** | **Chosen over Prisma.** Drizzle compiles directly to raw SQL with zero Rust engine binary or IPC overhead. Under high concurrency (up to 1,000 users) and 1M records, Drizzle provides transparent control over SQL query generation, connection pooling, and indexing. |
| **Load Testing** | **k6** | Developer-centric load testing tool for benchmarking throughput, latency percentiles, and error rates. |

---

## Quick Start & Local Setup

### 1. Prerequisites
- Node.js v18+ and npm v9+
- Docker & Docker Compose

### 2. Environment Setup
Copy `.env.example` to create your local `.env`:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Local PostgreSQL Database
```bash
npm run db:up
```

### 5. Start Development Servers
Start both backend API and frontend Next.js app concurrently:
```bash
npm run dev
```

Or start each application independently:
```bash
# Start Fastify Backend API on port 4000
npm run dev:api

# Start Next.js Frontend App on port 3000
npm run dev:web
```

---

## API Endpoints (Sprint 0)

### `GET /health`
Returns system status and database connectivity.

**Sample Response (`HTTP 200 OK`):**
```json
{
  "status": "ok",
  "service": "airops-api",
  "timestamp": "2026-09-01T11:45:00.000Z",
  "uptimeSeconds": 45.2,
  "database": {
    "status": "connected",
    "latencyMs": 1.85
  }
}
```

---

## Non-Goals for Sprint 0

Per Sprint 0 rules, the following are **strictly omitted** to avoid premature optimization:
- No Redis caching
- No Authentication or queues (Kafka/RabbitMQ)
- No Microservices or load balancers
- No premature database indexing
