# AirOps Baseline Backend API Documentation

## Overview

The AirOps API is a Node.js + Fastify service serving flight operations data, analytics, and status updates. All responses are returned as structured JSON.

- **Base URL:** `http://localhost:4000`
- **Content-Type:** `application/json`

---

## Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health check & PostgreSQL database latency ping |
| `GET` | `/api/airports` | List all global airports ordered by IATA code |
| `GET` | `/api/flights` | Paginated & filtered list of flights with origin, destination, and aircraft relations |
| `GET` | `/api/flights/:id` | Detailed flight record including origin, destination, aircraft, event history, and incidents |
| `PATCH` | `/api/flights/:id/status` | Update flight status, delay minutes, and automatically log a `FlightEvent` entry |
| `GET` | `/api/dashboard` | Live operational analytics metrics (status breakdowns, average delays, affected passengers) |

---

## Detailed Endpoint Specifications

### 1. System Health Check
`GET /health`

**Response (`HTTP 200 OK`):**
```json
{
  "status": "ok",
  "service": "airops-api",
  "timestamp": "2026-09-01T12:00:00.000Z",
  "uptimeSeconds": 142.5,
  "database": {
    "status": "connected",
    "latencyMs": 1.45
  }
}
```

---

### 2. Get Airports List
`GET /api/airports`

**Response (`HTTP 200 OK`):**
```json
{
  "data": [
    {
      "id": 1,
      "code": "AMS",
      "name": "Amsterdam Schiphol",
      "city": "Amsterdam",
      "country": "Netherlands",
      "timezone": "Europe/Amsterdam"
    },
    {
      "id": 2,
      "code": "ATL",
      "name": "Hartsfield-Jackson Intl",
      "city": "Atlanta",
      "country": "United States",
      "timezone": "America/New_York"
    }
  ]
}
```

---

### 3. Get Paginated Flights
`GET /api/flights`

#### Query Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | Integer | `1` | Page number (min 1) |
| `limit` | Integer | `20` | Results per page (min 1, max 100) |
| `search` | String | *None* | Substring match against flight number, airline code, or airport codes |
| `status` | String | *None* | Filter by status (e.g. `SCHEDULED`, `BOARDING`, `DEPARTED`, `DELAYED`, `ARRIVED`, `CANCELLED`) |
| `origin` | String | *None* | Airport code (e.g. `JFK`) or airport ID |
| `destination` | String | *None* | Airport code (e.g. `LAX`) or airport ID |
| `sortBy` | String | `scheduledDeparture` | Allowed values: `scheduledDeparture`, `scheduledArrival`, `flightNumber`, `status`, `delayMinutes` |
| `sortOrder` | String | `desc` | Sort direction: `asc` or `desc` |

#### Example Request
`GET /api/flights?page=1&limit=2&status=DELAYED&sortBy=scheduledDeparture&sortOrder=desc`

#### Response (`HTTP 200 OK`):
```json
{
  "data": [
    {
      "id": 8402,
      "flightNumber": "AA491",
      "airlineCode": "AA",
      "originAirport": {
        "id": 1,
        "code": "JFK",
        "name": "John F. Kennedy Intl",
        "city": "New York",
        "country": "United States",
        "timezone": "America/New_York"
      },
      "destinationAirport": {
        "id": 2,
        "code": "LAX",
        "name": "Los Angeles Intl",
        "city": "Los Angeles",
        "country": "United States",
        "timezone": "America/Los_Angeles"
      },
      "aircraft": {
        "id": 14,
        "registration": "N1014N",
        "model": "Boeing 737-800",
        "capacity": 180,
        "status": "ACTIVE"
      },
      "scheduledDeparture": "2026-09-01T14:30:00.000Z",
      "scheduledArrival": "2026-09-01T18:00:00.000Z",
      "actualDeparture": "2026-09-01T15:15:00.000Z",
      "actualArrival": "2026-09-01T18:45:00.000Z",
      "gate": "B12",
      "status": "DELAYED",
      "delayMinutes": 45,
      "passengerCount": 162,
      "createdAt": "2026-09-01T14:30:00.000Z",
      "updatedAt": "2026-09-01T15:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 2,
    "total": 6042,
    "totalPages": 3021
  }
}
```

---

### 4. Get Flight Details
`GET /api/flights/:id`

**Response (`HTTP 200 OK`):**
```json
{
  "data": {
    "id": 8402,
    "flightNumber": "AA491",
    "airlineCode": "AA",
    "originAirport": { ... },
    "destinationAirport": { ... },
    "aircraft": { ... },
    "scheduledDeparture": "2026-09-01T14:30:00.000Z",
    "status": "DELAYED",
    "events": [
      {
        "id": 34120,
        "flightId": 8402,
        "eventType": "DELAYED",
        "message": "Departure hold due to ground traffic congestion.",
        "eventTime": "2026-09-01T14:45:00.000Z"
      },
      {
        "id": 34119,
        "flightId": 8402,
        "eventType": "SCHEDULED",
        "message": "Flight schedule published in system.",
        "eventTime": "2026-09-01T14:30:00.000Z"
      }
    ],
    "incidents": [
      {
        "id": 412,
        "flightId": 8402,
        "severity": "MEDIUM",
        "type": "BAGGAGE",
        "status": "RESOLVED",
        "description": "Baggage sorting system belt jam causing loading delay.",
        "resolvedAt": "2026-09-01T15:10:00.000Z"
      }
    ]
  }
}
```

---

### 5. Update Flight Status
`PATCH /api/flights/:id/status`

#### Request Body
```json
{
  "status": "DELAYED",
  "delayMinutes": 60,
  "message": "Heavy crosswinds along arrival flight path."
}
```

#### Response (`HTTP 200 OK`):
```json
{
  "message": "Flight status updated successfully",
  "data": {
    "id": 8402,
    "flightNumber": "AA491",
    "airlineCode": "AA",
    "originAirport": { "id": 1, "code": "JFK", "name": "John F. Kennedy Intl" },
    "destinationAirport": { "id": 2, "code": "LAX", "name": "Los Angeles Intl" },
    "status": "DELAYED",
    "delayMinutes": 60,
    "updatedAt": "2026-09-01T12:05:00.000Z"
  }
}
```

---

### 6. Get Dashboard Analytics
`GET /api/dashboard`

**Response (`HTTP 200 OK`):**
```json
{
  "data": {
    "totalFlights": 100000,
    "scheduledFlights": 19840,
    "boardingFlights": 5012,
    "departedFlights": 5120,
    "delayedFlights": 6120,
    "cancelledFlights": 3980,
    "arrivedFlights": 59928,
    "averageDelayMinutes": 48.3,
    "affectedPassengers": 1642190,
    "activeIncidents": 752,
    "timestamp": "2026-09-01T12:00:00.000Z"
  }
}
```

---

## Error Response Format

Errors are returned with standard HTTP status codes:

```json
{
  "error": {
    "message": "Invalid request payload or query parameters",
    "statusCode": 400,
    "details": [
      {
        "field": "status",
        "message": "Invalid enum value. Expected 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'DELAYED' | 'ARRIVED' | 'CANCELLED'"
      }
    ],
    "timestamp": "2026-09-01T12:00:00.000Z"
  }
}
```

---

## Intentionally Unoptimized Baseline Areas for Benchmarking

As part of the AirOps experimentation process (**Build → Measure → Break → Identify Bottleneck → Optimize → Measure Again**), the following areas have been intentionally left unoptimized:

1. **Unindexed Filter & Sort Queries (`GET /api/flights`)**:
   - `WHERE status = 'DELAYED'` and `ORDER BY scheduled_departure DESC` perform sequential full-table scans across 100k-1M flight records because no indexes exist on `status` or `scheduled_departure`.
2. **Double Table Scan for Total Pagination Count**:
   - `GET /api/flights` executes `COUNT(*)` over the matching filtered set on every paginated request, doubling query overhead.
3. **On-Demand SQL Aggregate Scans (`GET /api/dashboard`)**:
   - `GET /api/dashboard` executes real-time SQL aggregates (`COUNT(*) FILTER(...)`, `AVG()`, `SUM()`) scanning all rows across `flights` and `incidents` without Redis caching or precomputed materialization.
