# AirOps Local Setup Guide

Follow this guide to get AirOps running locally on your workstation.

## Prerequisites

- **Node.js**: v18.x or v20.x or higher
- **npm**: v9.x or higher
- **Docker & Docker Compose**: Required for running local PostgreSQL 16

## Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Review default ports and credentials in `.env`:
   ```env
   POSTGRES_USER=airops
   POSTGRES_PASSWORD=airops_password
   POSTGRES_DB=airops
   POSTGRES_PORT=5432
   DATABASE_URL=postgres://airops:airops_password@localhost:5432/airops
   PORT=4000
   HOST=0.0.0.0
   CORS_ORIGIN=http://localhost:3000
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

## Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Start PostgreSQL Container
```bash
npm run db:up
# Or using docker compose directly:
# docker compose up -d
```

Verify container status:
```bash
docker compose ps
```

### 3. Run Development Servers
Start both backend API and frontend Next.js app concurrently:
```bash
npm run dev
```

Alternatively, run each service independently in separate terminal windows:
```bash
# Terminal 1: Fastify Backend API (Port 4000)
npm run dev:api

# Terminal 2: Next.js Frontend App (Port 3000)
npm run dev:web
```

## Health Verification

1. **Backend API Health Check:**
   ```bash
   curl http://localhost:4000/health
   ```
   Expected Response (HTTP 200):
   ```json
   {
     "status": "ok",
     "service": "airops-api",
     "timestamp": "2026-09-01T11:45:00.000Z",
     "uptimeSeconds": 12.34,
     "database": {
       "status": "connected",
       "latencyMs": 2.15
     }
   }
   ```

2. **Frontend Visual Health Check:**
   Open [http://localhost:3000](http://localhost:3000) in your web browser. You will see live visual indicators for Fastify API reachability and PostgreSQL connectivity.
