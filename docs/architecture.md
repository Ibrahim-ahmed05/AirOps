# AirOps Architecture & Technical Decisions

## Overview

AirOps is a deliberately lean but production-realistic airline operations application. Its primary purpose is to serve as a testbed for measuring backend throughput, database query execution, memory utilization, UI render performance, and failure recovery under intense concurrent user loads (up to 1,000 concurrent VUs) and large data volumes (up to 1,000,000 records).

## Directory Structure

```
/apps
  /web           # Next.js (TypeScript + Tailwind CSS)
  /api           # Node.js + Fastify backend (TypeScript + Drizzle ORM)
/load-tests      # k6 test scripts and benchmark runs
/docs            # System documentation and architecture decisions
docker-compose.yml # PostgreSQL 16 container definition
README.md        # Root documentation and setup guide
```

## System Topology & Architecture

```
+--------------------------+           +--------------------------+
|  Frontend (Next.js)      |  HTTP     |  Backend (Fastify)       |
|  Port 3000               | --------> |  Port 4000               |
|  Client / React SSR      |  (CORS)   |  Node.js + Pino Logger   |
+--------------------------+           +------------+-------------+
                                                    |
                                                    | Drizzle / pg Pool
                                                    v
                                       +--------------------------+
                                       |  PostgreSQL 16           |
                                       |  Port 5432 (Docker)      |
                                       +--------------------------+
```

## Technology Stack Rationale

### 1. Backend Framework: Fastify
- **Why Fastify?** Fastify provides exceptionally low overhead, low latency HTTP routing compared to Express.js (up to 2-3x higher throughput req/s). Its native JSON serialization engine (`fast-json-stringify`) and built-in structured logger (`pino`) minimize CPU overhead during high-concurrency benchmarks.

### 2. ORM & Query Layer: Drizzle ORM
- **Why Drizzle over Prisma?**
  - **Zero Engine Binary Overhead:** Prisma relies on a Rust query engine binary communicate via IPC/HTTP layer, introducing latency and memory overhead per request. Drizzle compiles directly to raw SQL JavaScript calls using `pg` native driver pools.
  - **Transparent SQL Control:** Drizzle functions as a type-safe SQL query builder. It does not hide query mechanics, joins, or pagination logic behind opaque magic methods.
  - **Benchmarking Precision:** For high-throughput load testing (up to 1,000 concurrent connections and 1M records), Drizzle provides maximum visibility into query execution plans, indexes, and connection pool behavior.

### 3. Database: PostgreSQL 16
- Standard relational engine running via Docker Compose for easy reproducibility and local testing.

### 4. Frontend: Next.js + Tailwind CSS
- Next.js App Router providing decoupled client rendering.
- Frontend and backend run on separate ports (`3000` vs `4000`) and can be benchmarked and scaled independently.

## Non-Goals & Architectural Constraints (Sprint 0)

To adhere strictly to the **Build → Measure → Break → Identify Bottleneck → Optimize → Measure Again** workflow, the following technologies are **explicitly excluded** until dedicated future sprints:

- ❌ Redis (No caching until caching sprint)
- ❌ Kafka / RabbitMQ (No message queues)
- ❌ Microservices / Load Balancers
- ❌ Premature Database Indexing
- ❌ Elasticsearch / Read Replicas
