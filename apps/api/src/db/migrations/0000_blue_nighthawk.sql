CREATE TABLE IF NOT EXISTS "aircraft" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration" varchar(20) NOT NULL,
	"model" text NOT NULL,
	"capacity" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	CONSTRAINT "aircraft_registration_unique" UNIQUE("registration")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airports" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(3) NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"timezone" text NOT NULL,
	CONSTRAINT "airports_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flight_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_id" integer NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"message" text NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flights" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_number" varchar(10) NOT NULL,
	"airline_code" varchar(3) NOT NULL,
	"origin_airport_id" integer NOT NULL,
	"destination_airport_id" integer NOT NULL,
	"aircraft_id" integer NOT NULL,
	"scheduled_departure" timestamp with time zone NOT NULL,
	"scheduled_arrival" timestamp with time zone NOT NULL,
	"actual_departure" timestamp with time zone,
	"actual_arrival" timestamp with time zone,
	"gate" varchar(10),
	"status" varchar(20) NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"passenger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_id" integer NOT NULL,
	"severity" varchar(20) NOT NULL,
	"type" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flight_events" ADD CONSTRAINT "flight_events_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flights" ADD CONSTRAINT "flights_origin_airport_id_airports_id_fk" FOREIGN KEY ("origin_airport_id") REFERENCES "public"."airports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flights" ADD CONSTRAINT "flights_destination_airport_id_airports_id_fk" FOREIGN KEY ("destination_airport_id") REFERENCES "public"."airports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flights" ADD CONSTRAINT "flights_aircraft_id_aircraft_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
