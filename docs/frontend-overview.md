# AirOps Frontend Architecture & Overview

## Overview

The AirOps frontend is an enterprise-style B2B airline operations platform built with **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**. It connects directly to the Fastify REST backend API.

---

## Routes & Pages

| Route | Component File | Description |
| :--- | :--- | :--- |
| `/` | `apps/web/src/app/page.tsx` | Root entry point rendering the Operations Dashboard. |
| `/dashboard` | `apps/web/src/app/dashboard/page.tsx` | Executive operations dashboard displaying 8 primary KPI cards and network status distribution metrics. |
| `/flights` | `apps/web/src/app/flights/page.tsx` | Large operations data table supporting text search, status filtering, origin/destination airport filters, sorting, and pagination. |
| `/flights/[id]` | `apps/web/src/app/flights/[id]/page.tsx` | Detailed flight view showing airport hubs, aircraft specs, timing timeline, flight event history, incident reports, and status update form. |
| `/diagnostics` | `apps/web/src/app/diagnostics/page.tsx` | System health diagnostics page checking Fastify API reachability and PostgreSQL ping latency. |

---

## Shared UI Components

### 1. `Navigation` (`apps/web/src/components/Navigation.tsx`)
Sticky enterprise header bar providing brand identity, navigation links, and a live API online/offline status pill polling `/health` every 10 seconds.

### 2. `StatusBadge` & `SeverityBadge` (`apps/web/src/components/StatusBadge.tsx`)
Accessible badge components mapping flight statuses (`SCHEDULED`, `BOARDING`, `DEPARTED`, `DELAYED`, `ARRIVED`, `CANCELLED`) and incident severities (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) to consistent color tokens.

---

## Data Flow & API Integration

```
+--------------------------+                      +--------------------------+
|   Next.js App Router     |   HTTP REST Calls    |   Fastify Backend API    |
|                          | -------------------> |   Port 4000              |
|  - /dashboard            |  GET /api/dashboard  |                          |
|  - /flights              |  GET /api/flights    |  PostgreSQL 16 Database  |
|  - /flights/[id]         |  GET /api/airports   |  (Drizzle ORM)           |
|  - Status Update Modal   |  PATCH /api/status   |                          |
+--------------------------+                      +--------------------------+
```

### API Endpoint Dependencies

1. **`GET /api/dashboard`**: Invoked by `/dashboard` to load KPI metrics (Total Flights, Scheduled, Boarding, Delayed, Cancelled, Average Delay, Passengers Affected, Active Incidents).
2. **`GET /api/flights`**: Invoked by `/flights` with query parameters (`page`, `limit`, `search`, `status`, `origin`, `destination`, `sortBy`, `sortOrder`).
3. **`GET /api/airports`**: Invoked by `/flights` to populate Origin and Destination filter dropdown options.
4. **`GET /api/flights/:id`**: Invoked by `/flights/[id]` to fetch flight details, origin/destination hubs, aircraft details, chronological flight events, and incident logs.
5. **`PATCH /api/flights/:id/status`**: Invoked by the status update modal on `/flights/[id]` to submit flight status updates, delay minutes, and log messages.

---

## Intentionally Unoptimized Frontend Baseline Areas

Per the project workflow (**Build → Measure → Break → Identify Bottleneck → Optimize → Measure Again**), the frontend intentionally omits premature optimizations:

1. **No TanStack Query / Client Cache:** Pages use native React `useState`/`useEffect` hooks fetching directly from the REST API on every page navigation.
2. **No Windowing / Table Virtualization:** The operations table renders standard HTML `<tr>` elements for all returned rows in the DOM.
3. **No Optimistic UI Updates:** Status updates trigger a full server refetch of the target flight record to measure real round-trip API latency.
