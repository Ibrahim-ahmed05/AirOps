-- Apply after the baseline on the SAME isolated dataset; do not drop baseline indexes.
CREATE INDEX IF NOT EXISTS flights_departure_perf_idx ON flights (scheduled_departure);
CREATE INDEX IF NOT EXISTS flight_events_flight_perf_idx ON flight_events (flight_id, event_time DESC);
CREATE INDEX IF NOT EXISTS incidents_flight_perf_idx ON incidents (flight_id);
ANALYZE flights;
ANALYZE flight_events;
ANALYZE incidents;
