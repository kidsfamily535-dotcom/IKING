-- =====================================================================
-- I KING - full public-schema export (Supabase project "I KING", eu-west-1)
-- Generated from the live database on 2026-10-05. Structure only: NO data.
-- Order: extensions -> enums -> tables -> constraints -> indexes -> views
--        -> functions -> RLS + policies -> cron jobs.
-- Reference data (airports, aircraft_models, route_price_reference,
-- ref_icao_types, eye_decision_policy, activation_channels) is NOT included
-- here; export it separately as seed files (see README).
-- Review before running: functions/cron reference vault secrets and the
-- http extension; they must be recreated in the new project.
-- =====================================================================

-- 1. Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_stat_statements;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;
-- http lives in an isolated schema (functions reference private_ext.http_response / private_ext.http_*)
create schema if not exists private_ext;
create extension if not exists http schema private_ext;

-- 2. Enums
create type public.app_role as enum ('customer', 'operator', 'broker', 'partner', 'admin');
create type public.availability_status as enum ('PENDING_VERIFICATION', 'AVAILABLE', 'HELD', 'BOOKED', 'EXPIRED', 'CANCELLED');
create type public.booking_intent_status as enum ('INTENT_CREATED', 'STAFF_REVIEW', 'OPERATOR_CONFIRMED', 'BOOKED', 'FULFILLED', 'CANCELLED', 'FAILED');
create type public.demand_grade as enum ('A', 'B', 'C', 'D', 'E');
create type public.demand_segment as enum ('HOT', 'WARM', 'LATENT', 'DORMANT');
create type public.demand_signal_status as enum ('NEW', 'IN_REVIEW', 'APPROVED_FOR_FOLLOWUP', 'MONITORING', 'DISMISSED', 'EXPIRED');
create type public.learning_outcome as enum ('DELIVERED', 'OPENED', 'VIEWED', 'CLICKED', 'REPLIED', 'REQUESTED_QUOTE', 'SELECTED', 'BOOKED', 'IGNORED', 'REJECTED', 'EXPIRED');
create type public.opportunity_status as enum ('DETECTED', 'VALIDATED', 'MATCHED', 'ACTIVATION_PENDING', 'ACTIVATED', 'ENGAGED', 'INQUIRY', 'QUOTE', 'BOOKING_INTENT', 'BOOKED', 'FULFILLED', 'IGNORED', 'EXPIRED', 'CANCELLED', 'WITHDRAWN', 'REJECTED');
create type public.opportunity_trigger as enum ('LAST_MINUTE', 'TIME', 'AVAILABILITY');
create type public.quote_request_status as enum ('REQUESTED', 'OPERATOR_CONTACTED', 'QUOTE_RECEIVED', 'CANCELLED', 'EXPIRED', 'OPERATOR_DECLINED');
create type public.quote_status as enum ('BROKER_REVIEW', 'CLIENT_PRESENTED', 'CLIENT_ACCEPTED', 'CLIENT_REJECTED', 'EXPIRED', 'WITHDRAWN');
create type public.request_status as enum ('NEEDS_INFO', 'READY', 'CANCELLED');
create type public.truth_source as enum ('OFFICIAL_OPERATOR', 'OFFICIAL_AIRPORT', 'OFFICIAL_AUTHORITY', 'VERIFIED_PARTNER', 'INTERNAL_DATABASE', 'CUSTOMER_PROVIDED', 'UNVERIFIED_WEB', 'AI_INFERRED');

-- 3. Tables (columns only; constraints follow)
create table public.activation_channels (
  channel text not null,
  enabled boolean not null default false,
  note text
);
create table public.aircraft_availability (
  id uuid not null default gen_random_uuid(),
  operator_id uuid not null,
  aircraft_model text not null,
  origin_code text not null,
  destination_code text,
  departure_from timestamp with time zone not null,
  departure_until timestamp with time zone not null,
  seats integer not null,
  status availability_status not null default 'PENDING_VERIFICATION'::availability_status,
  source truth_source not null,
  confidence text not null default 'medium'::text,
  created_at timestamp with time zone not null default now(),
  verified_at timestamp with time zone,
  verified_by uuid,
  expires_at timestamp with time zone not null,
  status_reason text,
  updated_at timestamp with time zone not null default now(),
  is_demo boolean not null default false
);
create table public.aircraft_fetch_runs (
  id uuid not null default gen_random_uuid(),
  ran_at timestamp with time zone not null default now(),
  ok boolean not null,
  centers_ok integer not null default 0,
  centers_failed integer not null default 0,
  rows_new integer not null default 0,
  error text
);
create table public.aircraft_legs (
  id uuid not null default gen_random_uuid(),
  icao24 text not null,
  icao_type text,
  origin_airport text,
  dest_airport text,
  departed_at timestamp with time zone not null,
  arrived_at timestamp with time zone,
  status text not null,
  confidence text not null,
  basis text,
  source text not null default 'derived_from_adsb_sightings'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.aircraft_models (
  model text not null,
  category text not null,
  typical_pax integer not null,
  range_km integer not null,
  source text not null default 'Aircraft Knowledge Base V2 (capability only, not availability)'::text
);
create table public.aircraft_sightings (
  id uuid not null default gen_random_uuid(),
  icao24 text not null,
  registration text,
  callsign text,
  icao_type text not null,
  category text,
  lat double precision not null,
  lon double precision not null,
  alt_ft integer,
  gs_kt numeric,
  observed_at timestamp with time zone not null,
  fetched_at timestamp with time zone not null default now(),
  source truth_source not null default 'UNVERIFIED_WEB'::truth_source,
  source_name text not null,
  nearest_airport text,
  nearest_km integer
);
create table public.airports (
  iata_code text not null,
  name_ar text,
  country_code text not null,
  needs_review boolean not null default false,
  note text,
  created_at timestamp with time zone not null default now(),
  source_code text,
  icao_code text,
  lat double precision,
  lon double precision,
  coords_source text,
  name_en text
);
create table public.assistant_proposals (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  kind text not null,
  payload jsonb not null,
  status text not null default 'PROPOSED'::text,
  reject_reason text,
  applied_entity_id uuid,
  created_at timestamp with time zone not null default now(),
  decided_at timestamp with time zone
);
create table public.audit_logs (
  id uuid not null default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamp with time zone not null default now()
);
create table public.booking_intents (
  id uuid not null default gen_random_uuid(),
  quote_id uuid not null,
  customer_id uuid not null,
  availability_id uuid not null,
  opportunity_id uuid,
  match_id uuid,
  price_snapshot_usd numeric(12,2) not null,
  status booking_intent_status not null default 'INTENT_CREATED'::booking_intent_status,
  status_reason text,
  confirmed_at timestamp with time zone,
  booked_at timestamp with time zone,
  fulfilled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.contact_controls (
  customer_id uuid not null,
  channel_preference text,
  max_activations_per_week integer not null default 2,
  opted_out boolean not null default false,
  last_contacted_at timestamp with time zone,
  activations_count integer not null default 0,
  updated_at timestamp with time zone not null default now()
);
create table public.conversations (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  channel text not null default 'in_app'::text,
  status text not null default 'open'::text,
  created_at timestamp with time zone not null default now(),
  last_message_at timestamp with time zone
);
create table public.customer_preferences (
  customer_id uuid not null,
  preferred_departure_period text,
  prefers_nonstop boolean,
  preferred_cabin_category text,
  ground_transport_note text,
  source truth_source not null default 'CUSTOMER_PROVIDED'::truth_source,
  updated_at timestamp with time zone not null default now()
);
create table public.customer_trips (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null default auth.uid(),
  origin_code text not null,
  destination_code text not null,
  departure_at timestamp with time zone,
  operator_name text,
  note text,
  source text not null default 'CUSTOMER_PROVIDED'::text,
  created_at timestamp with time zone not null default now(),
  companions text[] not null default '{}'::text[]
);
create table public.demand_fetch_runs (
  id uuid not null default gen_random_uuid(),
  ran_at timestamp with time zone not null default now(),
  source_name text not null,
  ok boolean not null,
  rows_seen integer not null default 0,
  rows_new integer not null default 0,
  error text
);
create table public.demand_signals (
  id uuid not null default gen_random_uuid(),
  grade demand_grade not null,
  source_kind text not null,
  source_name text not null,
  source_url text,
  source_truth truth_source not null default 'UNVERIFIED_WEB'::truth_source,
  title text not null,
  evidence text not null,
  evidence_date date not null,
  est_origin text,
  est_destination text,
  est_event_start date,
  est_pax integer,
  demand_confidence text not null default 'LOW'::text,
  recommended_action text,
  status demand_signal_status not null default 'NEW'::demand_signal_status,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  contact_approved_by uuid,
  contact_approved_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone
);
create table public.escalations (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  conversation_id uuid,
  quote_request_id uuid,
  booking_intent_id uuid,
  reason text not null,
  status text not null default 'OPEN'::text,
  created_at timestamp with time zone not null default now(),
  resolved_by uuid,
  resolved_at timestamp with time zone
);
create table public.eye_decision_policy (
  situation text not null,
  decision text not null,
  external_effect boolean not null default false,
  requires_human boolean not null default false,
  description_ar text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);
create table public.journey_briefs (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  quote_request_id uuid not null,
  booking_intent_id uuid,
  availability_id uuid not null,
  origin_code text not null,
  destination_code text not null,
  pickup_note text,
  dropoff_note text,
  ground_origin_min_est integer,
  ground_dest_min_est integer,
  distance_km integer,
  flight_min_est integer,
  fbo_origin_note text,
  fbo_dest_note text,
  transport_note text,
  value_status text not null default 'ESTIMATED'::text,
  source truth_source not null default 'INTERNAL_DATABASE'::truth_source,
  status text not null default 'DRAFT'::text,
  status_reason text,
  created_by uuid,
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.learning_events (
  id uuid not null default gen_random_uuid(),
  customer_id uuid,
  request_id uuid,
  availability_id uuid,
  outcome learning_outcome not null,
  channel text,
  details jsonb,
  created_at timestamp with time zone not null default now()
);
create table public.messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  role text not null,
  content text not null,
  structured jsonb,
  created_at timestamp with time zone not null default now()
);
create table public.opportunities (
  id uuid not null default gen_random_uuid(),
  availability_id uuid not null,
  origin_code text not null,
  destination_code text not null,
  status opportunity_status not null default 'DETECTED'::opportunity_status,
  trigger_type opportunity_trigger not null,
  detect_reason jsonb not null,
  source truth_source not null,
  verified_at timestamp with time zone not null,
  expires_at timestamp with time zone not null,
  score integer,
  score_parts jsonb,
  status_reason text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.opportunity_matches (
  id uuid not null default gen_random_uuid(),
  opportunity_id uuid not null,
  customer_id uuid not null,
  segment demand_segment not null,
  relation text not null,
  related_request_id uuid,
  explicit_before boolean not null,
  relevance integer not null,
  relevance_parts jsonb not null,
  reason jsonb not null,
  gate_decision text not null default 'PENDING'::text,
  gate_reason text,
  gate_checked_at timestamp with time zone,
  status text not null default 'MATCHED'::text,
  channel text,
  activated_at timestamp with time zone,
  last_outcome learning_outcome,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.owner_alerts (
  id uuid not null default gen_random_uuid(),
  opportunity_id uuid not null,
  channel text not null default 'email'::text,
  status text not null,
  error text,
  sent_at timestamp with time zone not null default now()
);
create table public.profiles (
  id uuid not null,
  role app_role not null default 'customer'::app_role,
  status text not null default 'active'::text,
  full_name text,
  email text,
  phone text,
  preferred_language text not null default 'ar'::text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  is_demo boolean not null default false
);
create table public.quote_requests (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  availability_id uuid not null,
  opportunity_id uuid,
  match_id uuid,
  request_id uuid,
  passengers integer not null,
  customer_note text,
  status quote_request_status not null default 'REQUESTED'::quote_request_status,
  status_reason text,
  operator_contacted_at timestamp with time zone,
  contacted_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.quotes (
  id uuid not null default gen_random_uuid(),
  quote_request_id uuid not null,
  availability_id uuid not null,
  operator_id uuid not null,
  operator_price_usd numeric(12,2) not null,
  client_price_usd numeric(12,2),
  currency text not null default 'USD'::text,
  price_source truth_source not null default 'OFFICIAL_OPERATOR'::truth_source,
  entered_via text not null,
  entered_by uuid,
  operator_note text,
  client_note text,
  valid_until timestamp with time zone not null,
  status quote_status not null default 'BROKER_REVIEW'::quote_status,
  created_at timestamp with time zone not null default now(),
  presented_at timestamp with time zone,
  decided_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);
create table public.ref_icao_types (
  icao_type text not null,
  category text not null,
  mapping_source truth_source not null default 'AI_INFERRED'::truth_source,
  needs_review boolean not null default true,
  note text
);
create table public.route_price_reference (
  id uuid not null default gen_random_uuid(),
  origin_code text not null,
  destination_code text not null,
  distance_km integer not null,
  category text not null,
  aircraft_label text not null,
  price_low_usd integer not null,
  price_mid_usd integer not null,
  price_high_usd integer not null,
  confidence text not null,
  price_status text not null default 'INDICATIVE'::text,
  source text not null default 'SkyKing Master Pricing DB'::text,
  needs_review boolean not null default false,
  note text,
  display_allowed boolean not null default true
);
create table public.travel_requests (
  id uuid not null default gen_random_uuid(),
  customer_id uuid not null,
  raw_text text,
  origin_code text,
  destination_code text,
  travel_date date,
  departure_period text,
  passengers integer,
  baggage_note text,
  return_requested boolean,
  status request_status not null default 'NEEDS_INFO'::request_status,
  missing_fields text[] not null default '{}'::text[],
  parsed_by text not null default 'human'::text,
  channel text not null default 'in_app'::text,
  referral_partner text,
  campaign text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
create table public.weather_fetch_runs (
  id uuid not null default gen_random_uuid(),
  ran_at timestamp with time zone not null default now(),
  ok boolean not null,
  metar_rows integer not null default 0,
  taf_rows integer not null default 0,
  error text
);
create table public.weather_snapshots (
  id uuid not null default gen_random_uuid(),
  airport_code text not null,
  icao_code text not null,
  report_type text not null,
  raw_text text not null,
  issued_at timestamp with time zone not null,
  valid_from timestamp with time zone,
  valid_to timestamp with time zone,
  flight_category text,
  wind_dir text,
  wind_speed_kt integer,
  visibility text,
  temp_c numeric,
  source truth_source not null default 'OFFICIAL_AUTHORITY'::truth_source,
  source_name text not null default 'aviationweather.gov'::text,
  fetched_at timestamp with time zone not null default now()
);

-- 4. Constraints (primary/unique/check first, foreign keys last)
alter table public.activation_channels add constraint activation_channels_pkey PRIMARY KEY (channel);
alter table public.aircraft_availability add constraint aircraft_availability_pkey PRIMARY KEY (id);
alter table public.aircraft_fetch_runs add constraint aircraft_fetch_runs_pkey PRIMARY KEY (id);
alter table public.aircraft_legs add constraint aircraft_legs_pkey PRIMARY KEY (id);
alter table public.aircraft_models add constraint aircraft_models_pkey PRIMARY KEY (model);
alter table public.aircraft_sightings add constraint aircraft_sightings_pkey PRIMARY KEY (id);
alter table public.airports add constraint airports_pkey PRIMARY KEY (iata_code);
alter table public.assistant_proposals add constraint assistant_proposals_pkey PRIMARY KEY (id);
alter table public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);
alter table public.booking_intents add constraint booking_intents_pkey PRIMARY KEY (id);
alter table public.contact_controls add constraint contact_controls_pkey PRIMARY KEY (customer_id);
alter table public.conversations add constraint conversations_pkey PRIMARY KEY (id);
alter table public.customer_trips add constraint customer_trips_companions_allowed check (companions <@ array['CHILDREN','LESS_WALKING','MEETING_AFTER']::text[]);
alter table public.customer_preferences add constraint customer_preferences_pkey PRIMARY KEY (customer_id);
alter table public.customer_trips add constraint customer_trips_pkey PRIMARY KEY (id);
alter table public.demand_fetch_runs add constraint demand_fetch_runs_pkey PRIMARY KEY (id);
alter table public.demand_signals add constraint demand_signals_pkey PRIMARY KEY (id);
alter table public.escalations add constraint escalations_pkey PRIMARY KEY (id);
alter table public.eye_decision_policy add constraint eye_decision_policy_pkey PRIMARY KEY (situation);
alter table public.journey_briefs add constraint journey_briefs_pkey PRIMARY KEY (id);
alter table public.learning_events add constraint learning_events_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.opportunities add constraint opportunities_pkey PRIMARY KEY (id);
alter table public.opportunity_matches add constraint opportunity_matches_pkey PRIMARY KEY (id);
alter table public.owner_alerts add constraint owner_alerts_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.quote_requests add constraint quote_requests_pkey PRIMARY KEY (id);
alter table public.quotes add constraint quotes_pkey PRIMARY KEY (id);
alter table public.ref_icao_types add constraint ref_icao_types_pkey PRIMARY KEY (icao_type);
alter table public.route_price_reference add constraint route_price_reference_pkey PRIMARY KEY (id);
alter table public.travel_requests add constraint travel_requests_pkey PRIMARY KEY (id);
alter table public.weather_fetch_runs add constraint weather_fetch_runs_pkey PRIMARY KEY (id);
alter table public.weather_snapshots add constraint weather_snapshots_pkey PRIMARY KEY (id);
alter table public.aircraft_legs add constraint aircraft_legs_icao24_departed_at_key UNIQUE (icao24, departed_at);
alter table public.aircraft_sightings add constraint aircraft_sightings_icao24_observed_at_key UNIQUE (icao24, observed_at);
alter table public.airports add constraint airports_icao_code_key UNIQUE (icao_code);
alter table public.booking_intents add constraint booking_intents_quote_id_key UNIQUE (quote_id);
alter table public.journey_briefs add constraint journey_briefs_quote_request_id_key UNIQUE (quote_request_id);
alter table public.opportunity_matches add constraint opportunity_matches_opportunity_id_customer_id_key UNIQUE (opportunity_id, customer_id);
alter table public.owner_alerts add constraint owner_alerts_opportunity_id_key UNIQUE (opportunity_id);
alter table public.quotes add constraint quotes_quote_request_id_key UNIQUE (quote_request_id);
alter table public.route_price_reference add constraint route_price_reference_origin_code_destination_code_key UNIQUE (origin_code, destination_code);
alter table public.weather_snapshots add constraint weather_snapshots_icao_code_report_type_issued_at_key UNIQUE (icao_code, report_type, issued_at);
alter table public.activation_channels add constraint activation_channels_channel_check CHECK ((channel = ANY (ARRAY['web'::text, 'in_app'::text, 'whatsapp'::text, 'email'::text, 'sms'::text])));
alter table public.aircraft_availability add constraint aircraft_availability_confidence_check CHECK ((confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
alter table public.aircraft_availability add constraint aircraft_availability_seats_check CHECK (((seats >= 1) AND (seats <= 40)));
alter table public.aircraft_availability add constraint expiry_valid CHECK ((expires_at > created_at));
alter table public.aircraft_availability add constraint route_valid CHECK (((destination_code IS NULL) OR (destination_code <> origin_code)));
alter table public.aircraft_availability add constraint verified_has_time CHECK (((status <> ALL (ARRAY['AVAILABLE'::availability_status, 'HELD'::availability_status, 'BOOKED'::availability_status])) OR (verified_at IS NOT NULL)));
alter table public.aircraft_availability add constraint window_valid CHECK ((departure_until >= departure_from));
alter table public.aircraft_legs add constraint aircraft_legs_confidence_check CHECK ((confidence = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text])));
alter table public.aircraft_legs add constraint aircraft_legs_status_check CHECK ((status = ANY (ARRAY['in_flight'::text, 'landed'::text, 'signal_lost'::text])));
alter table public.airports add constraint airports_country_code_check CHECK ((country_code = ANY (ARRAY['DZ'::text, 'BH'::text, 'KM'::text, 'DJ'::text, 'EG'::text, 'IQ'::text, 'JO'::text, 'KW'::text, 'LB'::text, 'LY'::text, 'MR'::text, 'MA'::text, 'OM'::text, 'PS'::text, 'QA'::text, 'SA'::text, 'SO'::text, 'SD'::text, 'SY'::text, 'TN'::text, 'AE'::text, 'YE'::text, 'TR'::text])));
alter table public.assistant_proposals add constraint assistant_proposals_kind_check CHECK ((kind = ANY (ARRAY['CREATE_TRAVEL_REQUEST'::text, 'REQUEST_QUOTE'::text, 'ESCALATE'::text])));
alter table public.assistant_proposals add constraint assistant_proposals_payload_check CHECK ((pg_column_size(payload) <= 4000));
alter table public.assistant_proposals add constraint assistant_proposals_status_check CHECK ((status = ANY (ARRAY['PROPOSED'::text, 'APPLIED'::text, 'REJECTED'::text])));
alter table public.contact_controls add constraint contact_controls_channel_preference_check CHECK ((channel_preference = ANY (ARRAY['web'::text, 'in_app'::text, 'whatsapp'::text, 'email'::text, 'sms'::text])));
alter table public.contact_controls add constraint contact_controls_max_activations_per_week_check CHECK (((max_activations_per_week >= 0) AND (max_activations_per_week <= 14)));
alter table public.conversations add constraint conversations_channel_check CHECK ((channel = ANY (ARRAY['web'::text, 'in_app'::text, 'whatsapp'::text, 'email'::text, 'sms'::text])));
alter table public.conversations add constraint conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])));
alter table public.customer_preferences add constraint customer_preferences_preferred_departure_period_check CHECK ((preferred_departure_period = ANY (ARRAY['morning'::text, 'noon'::text, 'evening'::text, 'night'::text])));
alter table public.customer_trips add constraint customer_trips_check CHECK ((origin_code <> destination_code));
alter table public.customer_trips add constraint customer_trips_note_check CHECK ((char_length(note) <= 300));
alter table public.customer_trips add constraint customer_trips_operator_name_check CHECK ((char_length(operator_name) <= 80));
alter table public.demand_signals add constraint demand_signals_demand_confidence_check CHECK ((demand_confidence = ANY (ARRAY['LOW'::text, 'MEDIUM'::text, 'HIGH'::text])));
alter table public.demand_signals add constraint demand_signals_est_pax_check CHECK (((est_pax IS NULL) OR (est_pax > 0)));
alter table public.demand_signals add constraint demand_signals_evidence_check CHECK ((length(TRIM(BOTH FROM evidence)) > 0));
alter table public.demand_signals add constraint demand_signals_source_kind_check CHECK ((source_kind = ANY (ARRAY['PUBLIC_EVENT'::text, 'PUBLIC_TENDER'::text, 'APPROVED_FEED'::text, 'MANUAL_STAFF'::text])));
alter table public.demand_signals add constraint demand_signals_source_name_check CHECK ((length(TRIM(BOTH FROM source_name)) > 0));
alter table public.demand_signals add constraint demand_signals_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0));
alter table public.escalations add constraint escalations_reason_check CHECK ((char_length(reason) <= 500));
alter table public.escalations add constraint escalations_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'RESOLVED'::text])));
alter table public.eye_decision_policy add constraint eye_decision_policy_check CHECK ((NOT (external_effect AND (NOT requires_human))));
alter table public.eye_decision_policy add constraint eye_decision_policy_decision_check CHECK ((decision = ANY (ARRAY['SILENT'::text, 'MONITOR'::text, 'INVESTIGATE'::text, 'RECOMMEND'::text, 'ACT_INTERNAL'::text, 'ASK_APPROVAL'::text, 'ESCALATE'::text, 'VERIFY_CONTINUE'::text])));
alter table public.journey_briefs add constraint jb_confirmed_has_actor CHECK (((status <> 'STAFF_CONFIRMED'::text) OR ((confirmed_by IS NOT NULL) AND (confirmed_at IS NOT NULL))));
alter table public.journey_briefs add constraint journey_briefs_dropoff_note_check CHECK ((char_length(dropoff_note) <= 300));
alter table public.journey_briefs add constraint journey_briefs_fbo_dest_note_check CHECK ((char_length(fbo_dest_note) <= 300));
alter table public.journey_briefs add constraint journey_briefs_fbo_origin_note_check CHECK ((char_length(fbo_origin_note) <= 300));
alter table public.journey_briefs add constraint journey_briefs_flight_min_est_check CHECK (((flight_min_est >= 1) AND (flight_min_est <= 1200)));
alter table public.journey_briefs add constraint journey_briefs_ground_dest_min_est_check CHECK (((ground_dest_min_est >= 0) AND (ground_dest_min_est <= 300)));
alter table public.journey_briefs add constraint journey_briefs_ground_origin_min_est_check CHECK (((ground_origin_min_est >= 0) AND (ground_origin_min_est <= 300)));
alter table public.journey_briefs add constraint journey_briefs_pickup_note_check CHECK ((char_length(pickup_note) <= 300));
alter table public.journey_briefs add constraint journey_briefs_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'STAFF_CONFIRMED'::text, 'WITHDRAWN'::text])));
alter table public.journey_briefs add constraint journey_briefs_transport_note_check CHECK ((char_length(transport_note) <= 300));
alter table public.journey_briefs add constraint journey_briefs_value_status_check CHECK ((value_status = 'ESTIMATED'::text));
alter table public.messages add constraint messages_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 4000)));
alter table public.messages add constraint messages_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'assistant'::text, 'staff'::text, 'system'::text])));
alter table public.opportunities add constraint opp_route_valid CHECK ((origin_code <> destination_code));
alter table public.opportunities add constraint opportunities_score_check CHECK (((score >= 0) AND (score <= 100)));
alter table public.opportunity_matches add constraint opportunity_matches_gate_decision_check CHECK ((gate_decision = ANY (ARRAY['PENDING'::text, 'ALLOWED'::text, 'BLOCKED'::text])));
alter table public.opportunity_matches add constraint opportunity_matches_relation_check CHECK ((relation = ANY (ARRAY['EXACT'::text, 'PARTIAL'::text, 'CORRIDOR'::text])));
alter table public.opportunity_matches add constraint opportunity_matches_relevance_check CHECK (((relevance >= 0) AND (relevance <= 100)));
alter table public.opportunity_matches add constraint opportunity_matches_status_check CHECK ((status = ANY (ARRAY['MATCHED'::text, 'ACTIVATED'::text, 'ENGAGED'::text, 'INQUIRY'::text, 'QUOTE'::text, 'BOOKING_INTENT'::text, 'BOOKED'::text, 'FULFILLED'::text, 'IGNORED'::text, 'REJECTED'::text, 'EXPIRED'::text, 'CANCELLED'::text])));
alter table public.owner_alerts add constraint owner_alerts_status_check CHECK ((status = ANY (ARRAY['SENT'::text, 'FAILED'::text])));
alter table public.profiles add constraint profiles_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['ar'::text, 'en'::text])));
alter table public.profiles add constraint profiles_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text])));
alter table public.quote_requests add constraint quote_requests_customer_note_check CHECK ((char_length(customer_note) <= 500));
alter table public.quote_requests add constraint quote_requests_passengers_check CHECK (((passengers >= 1) AND (passengers <= 40)));
alter table public.quotes add constraint quote_validity CHECK ((valid_until > created_at));
alter table public.quotes add constraint quotes_client_note_check CHECK ((char_length(client_note) <= 500));
alter table public.quotes add constraint quotes_client_price_usd_check CHECK ((client_price_usd > (0)::numeric));
alter table public.quotes add constraint quotes_currency_check CHECK ((currency = 'USD'::text));
alter table public.quotes add constraint quotes_entered_via_check CHECK ((entered_via = ANY (ARRAY['operator'::text, 'broker_on_behalf'::text])));
alter table public.quotes add constraint quotes_operator_note_check CHECK ((char_length(operator_note) <= 500));
alter table public.quotes add constraint quotes_operator_price_usd_check CHECK ((operator_price_usd > (0)::numeric));
alter table public.quotes add constraint quotes_price_source_check CHECK ((price_source = ANY (ARRAY['OFFICIAL_OPERATOR'::truth_source, 'VERIFIED_PARTNER'::truth_source])));
alter table public.route_price_reference add constraint route_price_reference_confidence_check CHECK ((confidence = ANY (ARRAY['very_high'::text, 'high'::text, 'medium'::text])));
alter table public.travel_requests add constraint req_route_valid CHECK (((origin_code IS NULL) OR (destination_code IS NULL) OR (origin_code <> destination_code)));
alter table public.travel_requests add constraint travel_requests_channel_check CHECK ((channel = ANY (ARRAY['web'::text, 'in_app'::text, 'whatsapp'::text, 'email'::text, 'sms'::text, 'human_broker'::text])));
alter table public.travel_requests add constraint travel_requests_departure_period_check CHECK ((departure_period = ANY (ARRAY['morning'::text, 'noon'::text, 'evening'::text, 'night'::text])));
alter table public.travel_requests add constraint travel_requests_parsed_by_check CHECK ((parsed_by = ANY (ARRAY['rule'::text, 'llm'::text, 'human'::text])));
alter table public.travel_requests add constraint travel_requests_passengers_check CHECK (((passengers >= 1) AND (passengers <= 40)));
alter table public.weather_snapshots add constraint weather_snapshots_report_type_check CHECK ((report_type = ANY (ARRAY['METAR'::text, 'TAF'::text])));
alter table public.aircraft_availability add constraint aircraft_availability_aircraft_model_fkey FOREIGN KEY (aircraft_model) REFERENCES aircraft_models(model);
alter table public.aircraft_availability add constraint aircraft_availability_destination_code_fkey FOREIGN KEY (destination_code) REFERENCES airports(iata_code);
alter table public.aircraft_availability add constraint aircraft_availability_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES profiles(id);
alter table public.aircraft_availability add constraint aircraft_availability_origin_code_fkey FOREIGN KEY (origin_code) REFERENCES airports(iata_code);
alter table public.aircraft_availability add constraint aircraft_availability_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES profiles(id);
alter table public.aircraft_legs add constraint aircraft_legs_dest_airport_fkey FOREIGN KEY (dest_airport) REFERENCES airports(iata_code);
alter table public.aircraft_legs add constraint aircraft_legs_origin_airport_fkey FOREIGN KEY (origin_airport) REFERENCES airports(iata_code);
alter table public.assistant_proposals add constraint assistant_proposals_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.booking_intents add constraint booking_intents_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES aircraft_availability(id);
alter table public.booking_intents add constraint booking_intents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.booking_intents add constraint booking_intents_match_id_fkey FOREIGN KEY (match_id) REFERENCES opportunity_matches(id);
alter table public.booking_intents add constraint booking_intents_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id);
alter table public.booking_intents add constraint booking_intents_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id);
alter table public.contact_controls add constraint contact_controls_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.conversations add constraint conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.customer_preferences add constraint customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.customer_trips add constraint customer_trips_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.customer_trips add constraint customer_trips_destination_code_fkey FOREIGN KEY (destination_code) REFERENCES airports(iata_code);
alter table public.customer_trips add constraint customer_trips_origin_code_fkey FOREIGN KEY (origin_code) REFERENCES airports(iata_code);
alter table public.escalations add constraint escalations_booking_intent_id_fkey FOREIGN KEY (booking_intent_id) REFERENCES booking_intents(id);
alter table public.escalations add constraint escalations_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id);
alter table public.escalations add constraint escalations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.escalations add constraint escalations_quote_request_id_fkey FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id);
alter table public.escalations add constraint escalations_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.journey_briefs add constraint journey_briefs_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES aircraft_availability(id);
alter table public.journey_briefs add constraint journey_briefs_booking_intent_id_fkey FOREIGN KEY (booking_intent_id) REFERENCES booking_intents(id) ON DELETE SET NULL;
alter table public.journey_briefs add constraint journey_briefs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.journey_briefs add constraint journey_briefs_destination_code_fkey FOREIGN KEY (destination_code) REFERENCES airports(iata_code);
alter table public.journey_briefs add constraint journey_briefs_origin_code_fkey FOREIGN KEY (origin_code) REFERENCES airports(iata_code);
alter table public.journey_briefs add constraint journey_briefs_quote_request_id_fkey FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE CASCADE;
alter table public.learning_events add constraint learning_events_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES aircraft_availability(id);
alter table public.learning_events add constraint learning_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.learning_events add constraint learning_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES travel_requests(id);
alter table public.messages add constraint messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
alter table public.opportunities add constraint opportunities_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES aircraft_availability(id);
alter table public.opportunities add constraint opportunities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.opportunities add constraint opportunities_destination_code_fkey FOREIGN KEY (destination_code) REFERENCES airports(iata_code);
alter table public.opportunities add constraint opportunities_origin_code_fkey FOREIGN KEY (origin_code) REFERENCES airports(iata_code);
alter table public.opportunity_matches add constraint opportunity_matches_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.opportunity_matches add constraint opportunity_matches_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;
alter table public.opportunity_matches add constraint opportunity_matches_related_request_id_fkey FOREIGN KEY (related_request_id) REFERENCES travel_requests(id);
alter table public.owner_alerts add constraint owner_alerts_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.quote_requests add constraint quote_requests_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES aircraft_availability(id);
alter table public.quote_requests add constraint quote_requests_contacted_by_fkey FOREIGN KEY (contacted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.quote_requests add constraint quote_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.quote_requests add constraint quote_requests_match_id_fkey FOREIGN KEY (match_id) REFERENCES opportunity_matches(id);
alter table public.quote_requests add constraint quote_requests_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id);
alter table public.quote_requests add constraint quote_requests_request_id_fkey FOREIGN KEY (request_id) REFERENCES travel_requests(id);
alter table public.quotes add constraint quotes_availability_id_fkey FOREIGN KEY (availability_id) REFERENCES aircraft_availability(id);
alter table public.quotes add constraint quotes_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.quotes add constraint quotes_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES profiles(id);
alter table public.quotes add constraint quotes_quote_request_id_fkey FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id);
alter table public.route_price_reference add constraint route_price_reference_aircraft_label_fkey FOREIGN KEY (aircraft_label) REFERENCES aircraft_models(model);
alter table public.route_price_reference add constraint route_price_reference_destination_code_fkey FOREIGN KEY (destination_code) REFERENCES airports(iata_code);
alter table public.route_price_reference add constraint route_price_reference_origin_code_fkey FOREIGN KEY (origin_code) REFERENCES airports(iata_code);
alter table public.travel_requests add constraint travel_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.travel_requests add constraint travel_requests_destination_code_fkey FOREIGN KEY (destination_code) REFERENCES airports(iata_code);
alter table public.travel_requests add constraint travel_requests_origin_code_fkey FOREIGN KEY (origin_code) REFERENCES airports(iata_code);
alter table public.weather_snapshots add constraint weather_snapshots_airport_code_fkey FOREIGN KEY (airport_code) REFERENCES airports(iata_code);

-- 5. Indexes
CREATE INDEX aircraft_availability_origin_code_destination_code_idx ON public.aircraft_availability USING btree (origin_code, destination_code);
CREATE INDEX aircraft_availability_operator_id_idx ON public.aircraft_availability USING btree (operator_id);
CREATE INDEX aircraft_availability_verified_by_idx ON public.aircraft_availability USING btree (verified_by);
CREATE INDEX aircraft_availability_status_expires_at_idx ON public.aircraft_availability USING btree (status, expires_at);
CREATE INDEX aircraft_availability_aircraft_model_idx ON public.aircraft_availability USING btree (aircraft_model);
CREATE INDEX aircraft_sightings_observed_idx ON public.aircraft_sightings USING btree (observed_at DESC);
CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX booking_intents_av_idx ON public.booking_intents USING btree (availability_id, status);
CREATE INDEX customer_trips_customer_id_departure_at_idx ON public.customer_trips USING btree (customer_id, departure_at);
CREATE INDEX demand_signals_status_idx ON public.demand_signals USING btree (status, grade);
CREATE UNIQUE INDEX demand_signals_source_url_uq ON public.demand_signals USING btree (source_url) WHERE (source_url IS NOT NULL);
CREATE INDEX journey_briefs_customer_idx ON public.journey_briefs USING btree (customer_id);
CREATE INDEX journey_briefs_availability_idx ON public.journey_briefs USING btree (availability_id);
CREATE INDEX learning_events_customer_id_created_at_idx ON public.learning_events USING btree (customer_id, created_at DESC);
CREATE INDEX learning_events_availability_id_idx ON public.learning_events USING btree (availability_id);
CREATE INDEX learning_events_request_id_idx ON public.learning_events USING btree (request_id);
CREATE INDEX messages_conv_idx ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX opportunities_status_idx ON public.opportunities USING btree (status);
CREATE UNIQUE INDEX opportunities_one_per_availability ON public.opportunities USING btree (availability_id);
CREATE INDEX opp_matches_customer_idx ON public.opportunity_matches USING btree (customer_id, status, activated_at);
CREATE UNIQUE INDEX quote_requests_one_active ON public.quote_requests USING btree (customer_id, availability_id) WHERE (status = ANY (ARRAY['REQUESTED'::quote_request_status, 'OPERATOR_CONTACTED'::quote_request_status, 'QUOTE_RECEIVED'::quote_request_status]));
CREATE INDEX quote_requests_av_idx ON public.quote_requests USING btree (availability_id, status);
CREATE INDEX route_price_reference_aircraft_idx ON public.route_price_reference USING btree (aircraft_label);
CREATE INDEX route_price_reference_destination_idx ON public.route_price_reference USING btree (destination_code);
CREATE INDEX travel_requests_destination_code_idx ON public.travel_requests USING btree (destination_code);
CREATE INDEX travel_requests_status_travel_date_idx ON public.travel_requests USING btree (status, travel_date);
CREATE INDEX travel_requests_origin_code_destination_code_idx ON public.travel_requests USING btree (origin_code, destination_code);
CREATE INDEX travel_requests_customer_id_created_at_idx ON public.travel_requests USING btree (customer_id, created_at DESC);
CREATE INDEX weather_latest_idx ON public.weather_snapshots USING btree (airport_code, report_type, issued_at DESC);

-- 6. Functions
CREATE OR REPLACE FUNCTION public._airport_tz(p_code text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case a.country_code when 'AE' then 'Asia/Dubai' else 'Asia/Riyadh' end from public.airports a where a.iata_code = p_code $function$;

CREATE OR REPLACE FUNCTION public._audit_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'opportunity_detected', 'opportunity', new.id,
      jsonb_build_object('trigger', new.trigger_type, 'reason', new.detect_reason, 'availability_id', new.availability_id));
  elsif new.status is distinct from old.status then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'opportunity_status', 'opportunity', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'reason', new.status_reason));
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public._audit_pipeline()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), tg_table_name || '_created', tg_table_name, new.id, jsonb_build_object('status', to_jsonb(new) ->> 'status'));
  elsif to_jsonb(new) ->> 'status' is distinct from to_jsonb(old) ->> 'status' then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), tg_table_name || '_status', tg_table_name, new.id,
            jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status', 'reason', to_jsonb(new) ->> 'status_reason'));
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public._eye_city_airports()
 RETURNS TABLE(city text, iata text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select * from (values ('abu dhabi','AUH'),('dubai','DXB'),('dubai','DWC'),('riyadh','RUH'),('jeddah','JED'),
    ('doha','DOH'),('cairo','CAI'),('istanbul','IST'),('muscat','MCT'),('bahrain','BAH'),('kuwait','KWI'),
    ('amman','AMM'),('marrakech','RAK'),('casablanca','CMN')) v(city, iata) $function$;

CREATE OR REPLACE FUNCTION public._fetch_aircraft()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c record; resp private_ext.http_response; j jsonb; x jsonb; n int; n_new int := 0; ok_c int := 0; bad_c int := 0; errs text := '';
        ty text; la double precision; lo double precision; seen numeric; nowms numeric; obs timestamptz; alt int; altt text; na record;
begin
  perform private_ext.http_set_curlopt('CURLOPT_CONNECTTIMEOUT','10');
  perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS','20000');
  for c in select iata_code, lat, lon from public.airports where iata_code in ('RUH','JED','DMM','DXB','TUU','CAI','AMM','BGW','IST') and lat is not null loop
    begin
      perform pg_sleep(4);
      resp := private_ext.http_get('https://api.adsb.lol/v2/point/' || c.lat || '/' || c.lon || '/250');
      if resp.status <> 200 then raise exception 'http %', resp.status; end if;
      j := resp.content::jsonb;
      nowms := (j->>'now')::numeric;
      for x in select jsonb_array_elements(coalesce(j->'ac','[]'::jsonb)) loop
        ty := upper(nullif(x->>'t',''));
        continue when ty is null or x->>'hex' is null or x->>'lat' is null or x->>'lon' is null;
        continue when not exists (select 1 from public.ref_icao_types r where r.icao_type = ty);
        la := (x->>'lat')::double precision; lo := (x->>'lon')::double precision;
        seen := coalesce((x->>'seen_pos')::numeric, (x->>'seen')::numeric, 0);
        obs := to_timestamp(nowms / 1000.0 - seen);
        altt := x->>'alt_baro';
        alt := case when altt = 'ground' then 0 when altt ~ '^-?[0-9]+(\.[0-9]+)?$' then altt::numeric::int else null end;
        select a.iata_code, public._hav_km(la, lo, a.lat, a.lon) as d into na
          from public.airports a where a.lat is not null order by public._hav_km(la, lo, a.lat, a.lon) limit 1;
        insert into public.aircraft_sightings(icao24, registration, callsign, icao_type, category, lat, lon, alt_ft, gs_kt, observed_at, source_name, nearest_airport, nearest_km)
        values (x->>'hex', nullif(x->>'r',''), nullif(trim(x->>'flight'),''), ty, (select category from public.ref_icao_types where icao_type = ty), la, lo, alt,
                nullif(x->>'gs','')::numeric, obs, 'adsb.lol', na.iata_code, round(na.d)::int)
        on conflict (icao24, observed_at) do nothing;
        get diagnostics n = row_count; n_new := n_new + n;
      end loop;
      ok_c := ok_c + 1;
    exception when others then
      bad_c := bad_c + 1; errs := errs || c.iata_code || ': ' || left(sqlerrm, 80) || '; ';
    end;
  end loop;
  delete from public.aircraft_sightings where observed_at < now() - interval '48 hours';
  insert into public.aircraft_fetch_runs(ok, centers_ok, centers_failed, rows_new, error)
  values (ok_c > 0, ok_c, bad_c, n_new, nullif(left(errs, 300), ''));
  return jsonb_build_object('ok', ok_c > 0, 'centers_ok', ok_c, 'centers_failed', bad_c, 'new', n_new, 'error', nullif(left(errs, 300), ''));
end $function$;

CREATE OR REPLACE FUNCTION public._fetch_demand_wikidata()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare resp private_ext.http_response; j jsonb; b jsonb; q text; seen int := 0; n_new int := 0; k int;
        v_label text; v_start date; v_end date; v_loc text; v_url text; v_dest text; v_country text;
begin
  q := 'SELECT ?e ?eLabel ?start ?end ?locLabel ?cLabel WHERE { VALUES ?c {wd:Q851 wd:Q878} ?e wdt:P17 ?c; wdt:P580 ?start. '
    || 'FILTER(?start >= "' || to_char(current_date, 'YYYY-MM-DD') || 'T00:00:00Z"^^xsd:dateTime && ?start <= "' || to_char(current_date + 150, 'YYYY-MM-DD') || 'T00:00:00Z"^^xsd:dateTime) '
    || 'OPTIONAL{?e wdt:P582 ?end} OPTIONAL{?e wdt:P276 ?loc} SERVICE wikibase:label {bd:serviceParam wikibase:language "en".} } ORDER BY ?start LIMIT 200';
  begin
    perform private_ext.http_set_curlopt('CURLOPT_CONNECTTIMEOUT','15');
    perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS','40000');
    perform private_ext.http_set_curlopt('CURLOPT_USERAGENT','IKingDemandSignals/0.1 (private aviation demand research)');
    resp := private_ext.http_get('https://query.wikidata.org/sparql?format=json&query=' || private_ext.urlencode(q));
    if resp.status <> 200 then raise exception 'wikidata http %', resp.status; end if;
    j := resp.content::jsonb;
    for b in select jsonb_array_elements(j->'results'->'bindings') loop
      seen := seen + 1;
      v_label := b->'eLabel'->>'value';
      v_url := b->'e'->>'value';
      continue when v_label is null or v_label ~ '^Q[0-9]+$' or v_url is null;
      continue when v_label ~* '(group [a-z0-9]|qualif|knockout|round of|qualifying|heat|matchday)';
      v_start := (b->'start'->>'value')::timestamptz::date;
      v_end := nullif(b->'end'->>'value','')::timestamptz::date;
      v_loc := nullif(b->'locLabel'->>'value','');
      v_country := b->'cLabel'->>'value';
      v_dest := case
        when coalesce(v_loc,'') ~* 'riyadh' then 'RUH' when coalesce(v_loc,'') ~* 'jeddah' then 'JED'
        when coalesce(v_loc,'') ~* 'dubai' then 'DXB' when coalesce(v_loc,'') ~* 'abu dhabi' then 'AUH'
        when coalesce(v_loc,'') ~* '(dammam|khobar|dhahran)' then 'DMM' when coalesce(v_loc,'') ~* 'medina' then 'MED'
        when coalesce(v_loc,'') ~* 'sharjah' then 'SHJ' else null end;
      insert into public.demand_signals(grade, source_kind, source_name, source_url, source_truth, title, evidence, evidence_date,
             est_destination, est_event_start, demand_confidence, recommended_action, expires_at)
      values ('D', 'PUBLIC_EVENT', 'Wikidata (CC0)', v_url, 'UNVERIFIED_WEB', v_label,
              'مدرج في Wikidata كحدث في ' || coalesce(v_country,'-') || ' يبدأ ' || v_start::text || coalesce(' في ' || v_loc, '') || '. إشارة سياقية فقط، لا تعني وجود طلب على طيران خاص.',
              current_date, v_dest, v_start, 'LOW',
              'مراجعة بشرية: هل يرجّح الحدث سفرًا خاصًا؟ لا تواصل قبل المراجعة',
              coalesce(v_end, v_start)::timestamptz + interval '2 days')
      on conflict (source_url) where source_url is not null do nothing;
      get diagnostics k = row_count; n_new := n_new + k;
    end loop;
    insert into public.demand_fetch_runs(source_name, ok, rows_seen, rows_new) values ('Wikidata (CC0)', true, seen, n_new);
    return jsonb_build_object('ok', true, 'seen', seen, 'new', n_new);
  exception when others then
    insert into public.demand_fetch_runs(source_name, ok, rows_seen, rows_new, error) values ('Wikidata (CC0)', false, seen, n_new, left(sqlerrm, 300));
    return jsonb_build_object('ok', false, 'error', left(sqlerrm, 300));
  end;
end $function$;

CREATE OR REPLACE FUNCTION public._fetch_weather()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ids text; resp private_ext.http_response; j jsonb; x jsonb; ap text; n_m int := 0; n_t int := 0; n int;
begin
  select string_agg(icao_code, ',' order by icao_code) into ids from public.airports where icao_code is not null;
  begin
    perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
    resp := private_ext.http_get('https://aviationweather.gov/api/data/metar?ids=' || ids || '&format=json&hours=3');
    if resp.status not in (200, 204) then raise exception 'METAR http %', resp.status; end if;
    j := case when coalesce(resp.content, '') = '' then '[]'::jsonb else resp.content::jsonb end;
    for x in select jsonb_array_elements(j) loop
      select iata_code into ap from public.airports where icao_code = x ->> 'icaoId';
      continue when ap is null or x ->> 'rawOb' is null or x ->> 'obsTime' is null;
      insert into public.weather_snapshots(airport_code, icao_code, report_type, raw_text, issued_at, flight_category, wind_dir, wind_speed_kt, visibility, temp_c)
      values (ap, x ->> 'icaoId', 'METAR', x ->> 'rawOb', to_timestamp((x ->> 'obsTime')::bigint), nullif(x ->> 'fltCat', ''),
              x ->> 'wdir', (nullif(x ->> 'wspd', ''))::numeric::int, x ->> 'visib', (nullif(x ->> 'temp', ''))::numeric)
      on conflict (icao_code, report_type, issued_at) do nothing;
      get diagnostics n = row_count; n_m := n_m + n;
    end loop;

    resp := private_ext.http_get('https://aviationweather.gov/api/data/taf?ids=' || ids || '&format=json');
    if resp.status not in (200, 204) then raise exception 'TAF http %', resp.status; end if;
    j := case when coalesce(resp.content, '') = '' then '[]'::jsonb else resp.content::jsonb end;
    for x in select jsonb_array_elements(j) loop
      select iata_code into ap from public.airports where icao_code = x ->> 'icaoId';
      continue when ap is null or x ->> 'rawTAF' is null or x ->> 'issueTime' is null;
      insert into public.weather_snapshots(airport_code, icao_code, report_type, raw_text, issued_at, valid_from, valid_to)
      values (ap, x ->> 'icaoId', 'TAF', x ->> 'rawTAF', (x ->> 'issueTime')::timestamptz,
              to_timestamp((nullif(x ->> 'validTimeFrom', ''))::bigint), to_timestamp((nullif(x ->> 'validTimeTo', ''))::bigint))
      on conflict (icao_code, report_type, issued_at) do nothing;
      get diagnostics n = row_count; n_t := n_t + n;
    end loop;

    delete from public.weather_snapshots where issued_at < now() - interval '7 days';
    insert into public.weather_fetch_runs(ok, metar_rows, taf_rows) values (true, n_m, n_t);
    return jsonb_build_object('ok', true, 'metar_new', n_m, 'taf_new', n_t);
  exception when others then
    insert into public.weather_fetch_runs(ok, metar_rows, taf_rows, error) values (false, n_m, n_t, left(sqlerrm, 300));
    return jsonb_build_object('ok', false, 'error', left(sqlerrm, 300));
  end;
end $function$;

CREATE OR REPLACE FUNCTION public._hav_km(a1 double precision, o1 double precision, a2 double precision, o2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select 6371 * 2 * asin(sqrt(power(sin(radians(a2 - a1) / 2), 2) + cos(radians(a1)) * cos(radians(a2)) * power(sin(radians(o2 - o1) / 2), 2)))
$function$;

CREATE OR REPLACE FUNCTION public._insert_quote(p_qr uuid, p_price numeric, p_valid timestamp with time zone, p_note text, p_via text, p_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests%rowtype; a public.aircraft_availability%rowtype; v_id uuid;
begin
  select * into q from public.quote_requests where id = p_qr for update;
  if not found then raise exception 'not found'; end if;
  if q.status not in ('REQUESTED','OPERATOR_CONTACTED') then raise exception 'quote request is not open'; end if;
  select * into a from public.aircraft_availability where id = q.availability_id;
  if a.status <> 'AVAILABLE' or a.expires_at <= now() then raise exception 'availability is not current'; end if;
  if p_price is null or p_price <= 0 or p_price > 10000000 then raise exception 'invalid price'; end if;
  if p_valid is null or p_valid < now() + interval '10 minutes' or p_valid > now() + interval '7 days' then raise exception 'invalid quote validity'; end if;
  insert into public.quotes(quote_request_id, availability_id, operator_id, operator_price_usd, entered_via, entered_by, operator_note, valid_until)
  values (p_qr, q.availability_id, a.operator_id, p_price, p_via, p_by, left(p_note, 500), p_valid) returning id into v_id;
  update public.quote_requests set status = 'QUOTE_RECEIVED' where id = p_qr;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public._learn(p_customer uuid, p_request uuid, p_av uuid, p_outcome learning_outcome, p_channel text, p_details jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.learning_events(customer_id, request_id, availability_id, outcome, channel, details)
  values (p_customer, p_request, p_av, p_outcome, p_channel, coalesce(p_details, '{}'::jsonb)) $function$;

CREATE OR REPLACE FUNCTION public._match_advance(p_match uuid, p_stage text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ord text[] := array['ACTIVATED','ENGAGED','INQUIRY','QUOTE','BOOKING_INTENT','BOOKED','FULFILLED'];
  m public.opportunity_matches%rowtype;
begin
  if p_match is null then return; end if;
  select * into m from public.opportunity_matches where id = p_match for update;
  if not found then return; end if;
  if array_position(ord, m.status) is not null and array_position(ord, m.status) < array_position(ord, p_stage) then
    update public.opportunity_matches set status = p_stage, updated_at = now() where id = p_match;
    perform public._opp_advance(m.opportunity_id, p_stage::public.opportunity_status);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public._opp_advance(p_opp uuid, p_target opportunity_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ord text[] := array['ACTIVATED','ENGAGED','INQUIRY','QUOTE','BOOKING_INTENT','BOOKED','FULFILLED'];
  cur public.opportunity_status; ci int; ti int;
begin
  ti := array_position(ord, p_target::text);
  loop
    select status into cur from public.opportunities where id = p_opp for update;
    ci := array_position(ord, cur::text);
    exit when ci is null or ci >= ti;
    update public.opportunities set status = ord[ci + 1]::public.opportunity_status, status_reason = 'STAGE_ADVANCED' where id = p_opp;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public._opp_expire()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n1 int; n2 int;
begin
  update public.opportunities o set status = 'EXPIRED', status_reason = 'TIME_EXPIRED'
   where (o.status in ('DETECTED','VALIDATED','MATCHED','ACTIVATION_PENDING','ACTIVATED','ENGAGED')
          and (o.expires_at <= now() or exists (select 1 from public.aircraft_availability a where a.id = o.availability_id and a.departure_until <= now())))
      or (o.status in ('INQUIRY','QUOTE','BOOKING_INTENT')
          and exists (select 1 from public.aircraft_availability a where a.id = o.availability_id and a.departure_until <= now()));
  get diagnostics n1 = row_count;
  with ex as (
    update public.opportunity_matches m set status = 'EXPIRED', last_outcome = 'EXPIRED', updated_at = now()
      from public.opportunities o
     where o.id = m.opportunity_id and o.status in ('EXPIRED','WITHDRAWN','CANCELLED')
       and m.status in ('ACTIVATED','ENGAGED')
       and coalesce(m.last_outcome, 'DELIVERED') in ('DELIVERED','OPENED','VIEWED','CLICKED','REPLIED')
    returning m.customer_id, m.related_request_id, o.availability_id, m.channel, m.opportunity_id)
  insert into public.learning_events(customer_id, request_id, availability_id, outcome, channel, details)
  select customer_id, related_request_id, availability_id, 'EXPIRED', channel, jsonb_build_object('opportunity_id', opportunity_id) from ex;
  get diagnostics n2 = row_count;
  return jsonb_build_object('opportunities_expired', n1, 'matches_expired', n2);
end $function$;

CREATE OR REPLACE FUNCTION public._opp_gate(p_match uuid, OUT o_decision text, OUT o_reason text, OUT o_channel text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.opportunity_matches%rowtype; op public.opportunities%rowtype; av public.aircraft_availability%rowtype;
  prof record; cc public.contact_controls%rowtype; wk int; mx int; thr int;
begin
  o_decision := 'BLOCKED';
  select * into m from public.opportunity_matches where id = p_match;
  select * into op from public.opportunities where id = m.opportunity_id;
  select * into av from public.aircraft_availability where id = op.availability_id;
  select p.role, p.status into prof from public.profiles p where p.id = m.customer_id;
  if prof.role is distinct from 'customer' or prof.status is distinct from 'active' then o_reason := 'CUSTOMER_NOT_ACTIVE'; return; end if;
  select * into cc from public.contact_controls where customer_id = m.customer_id;
  if cc.opted_out is true then o_reason := 'OPTED_OUT'; return; end if;
  o_channel := coalesce(cc.channel_preference, 'in_app');
  if not exists (select 1 from public.activation_channels ch where ch.channel = o_channel and ch.enabled) then
    o_reason := 'PREFERRED_CHANNEL_NOT_ENABLED'; return; end if;
  if op.status not in ('MATCHED','ACTIVATION_PENDING') or av.status <> 'AVAILABLE' or av.expires_at <= now()
     or av.departure_until < now() + interval '30 minutes' then
    o_reason := 'OPPORTUNITY_NOT_READY'; return; end if;
  mx := coalesce(cc.max_activations_per_week, 2);
  select count(*) into wk from public.opportunity_matches x
   where x.customer_id = m.customer_id and x.activated_at > now() - interval '7 days';
  if wk >= mx then o_reason := 'WEEKLY_LIMIT_REACHED'; return; end if;
  if exists (select 1 from public.learning_events le join public.aircraft_availability a2 on a2.id = le.availability_id
              where le.customer_id = m.customer_id and le.outcome in ('REJECTED','IGNORED')
                and le.created_at > now() - interval '14 days'
                and a2.origin_code = op.origin_code and a2.destination_code = op.destination_code) then
    o_reason := 'RECENT_REJECTION_SAME_ROUTE'; return; end if;
  thr := case m.segment when 'HOT' then 0 when 'WARM' then 40 when 'LATENT' then 45 else 60 end;
  if m.relevance < thr then o_reason := 'BELOW_RELEVANCE_THRESHOLD'; return; end if;
  if m.segment = 'DORMANT' then
    if op.trigger_type = 'AVAILABILITY' then o_reason := 'DORMANT_REQUIRES_URGENT_TRIGGER'; return; end if;
    if cc.last_contacted_at > now() - interval '30 days' then o_reason := 'DORMANT_CONTACT_GAP'; return; end if;
  end if;
  o_decision := 'ALLOWED'; o_reason := null;
end $function$;

CREATE OR REPLACE FUNCTION public._opp_match(p_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare op public.opportunities%rowtype; av public.aircraft_availability%rowtype;
  tz text; oc text; dc text; wstart date; wend date; dep_period text; cat text; n integer;
begin
  select * into op from public.opportunities where id = p_id;
  select * into av from public.aircraft_availability where id = op.availability_id;
  tz := public._airport_tz(op.origin_code);
  select country_code into oc from public.airports where iata_code = op.origin_code;
  select country_code into dc from public.airports where iata_code = op.destination_code;
  wstart := (av.departure_from at time zone tz)::date;
  wend := (av.departure_until at time zone tz)::date;
  dep_period := case when extract(hour from av.departure_from at time zone tz) between 5 and 10 then 'morning'
                     when extract(hour from av.departure_from at time zone tz) between 11 and 14 then 'noon'
                     when extract(hour from av.departure_from at time zone tz) between 15 and 19 then 'evening'
                     else 'night' end;
  select m.category into cat from public.aircraft_models m where m.model = av.aircraft_model;

  with reqs as (
    select r.id as rid, r.customer_id, r.passengers, r.status as rstatus, r.created_at, r.travel_date,
      case when r.origin_code = op.origin_code and r.destination_code = op.destination_code then 'EXACT'
           when r.origin_code in (op.origin_code, op.destination_code) or r.destination_code in (op.origin_code, op.destination_code) then 'PARTIAL'
           when ra.country_code = oc and rd.country_code = dc then 'CORRIDOR' end as rel
    from public.travel_requests r
    join public.profiles p on p.id = r.customer_id and p.role = 'customer' and p.status = 'active' and p.is_demo = av.is_demo
    join public.airports ra on ra.iata_code = r.origin_code
    join public.airports rd on rd.iata_code = r.destination_code
    where r.status <> 'CANCELLED' and (r.passengers is null or r.passengers <= av.seats)
  ), best as (
    select distinct on (customer_id) * from reqs where rel is not null
    order by customer_id, case rel when 'EXACT' then 1 when 'PARTIAL' then 2 else 3 end, created_at desc
  ), seg as (
    select b.*, extract(epoch from now() - b.created_at) / 86400.0 as age_d,
      case when b.rel = 'EXACT' and b.rstatus = 'READY' and b.created_at > now() - interval '3 days'
                and b.travel_date between wstart and wend then 'HOT'
           when b.created_at > now() - interval '30 days' then 'WARM'
           when b.created_at > now() - interval '120 days' then 'LATENT'
           when b.rel in ('EXACT','PARTIAL') then 'DORMANT' end as segment
    from best b
  ), pts as (
    select s.*,
      case s.rel when 'EXACT' then 40 when 'PARTIAL' then 25 else 15 end as pts_route,
      case when s.age_d <= 3 then 25 when s.age_d <= 30 then 15 when s.age_d <= 120 then 8 else 3 end as pts_recency,
      case when s.passengers is null then 5 when av.seats - s.passengers <= 2 then 15 else 8 end as pts_fit,
      case when cp.preferred_departure_period = dep_period then 10 else 0 end as pts_time,
      case when cp.preferred_cabin_category is not null and cp.preferred_cabin_category = cat then 10 else 0 end as pts_cabin
    from seg s left join public.customer_preferences cp on cp.customer_id = s.customer_id
  )
  insert into public.opportunity_matches
    (opportunity_id, customer_id, segment, relation, related_request_id, explicit_before, relevance, relevance_parts, reason)
  select p_id, x.customer_id, x.segment::public.demand_segment, x.rel, x.rid, (x.segment = 'HOT'),
    least(100, x.pts_route + x.pts_recency + x.pts_fit + x.pts_time + x.pts_cabin),
    jsonb_build_object('route', x.pts_route, 'recency', x.pts_recency, 'seat_fit', x.pts_fit, 'time_pref', x.pts_time, 'cabin_pref', x.pts_cabin),
    jsonb_build_object('segment', x.segment, 'relation', x.rel, 'request_id', x.rid,
      'request_age_days', round(x.age_d::numeric, 1), 'passengers_unknown', x.passengers is null,
      'text_ar', to_jsonb(array_remove(array[
        case x.rel when 'EXACT' then 'طلبت هذا المسار من قبل'
                   when 'PARTIAL' then 'سبق أن طلبت رحلة تمر بأحد مطاري هذا المسار'
                   else 'سبق أن طلبت رحلة بين البلدين نفسيهما' end,
        case when x.pts_time > 0 then 'وقت المغادرة يوافق تفضيلك' end,
        case when x.pts_cabin > 0 then 'فئة الطائرة توافق تفضيلك' end,
        case when x.pts_fit = 15 then 'السعة مناسبة لمجموعتك' end], null)))
  from pts x where x.segment is not null
  on conflict (opportunity_id, customer_id) do update set
    segment = excluded.segment, relation = excluded.relation, related_request_id = excluded.related_request_id,
    explicit_before = excluded.explicit_before, relevance = excluded.relevance,
    relevance_parts = excluded.relevance_parts, reason = excluded.reason, updated_at = now()
  where public.opportunity_matches.status = 'MATCHED';
  get diagnostics n = row_count;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public._opp_score(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.opportunities%rowtype; a public.aircraft_availability%rowtype; f int; s int; u int; c int; h numeric;
begin
  select * into o from public.opportunities where id = p_id;
  select * into a from public.aircraft_availability where id = o.availability_id;
  f := case when o.verified_at > now() - interval '1 hour' then 30 when o.verified_at > now() - interval '6 hours' then 20 else 10 end;
  s := case o.source when 'OFFICIAL_OPERATOR' then 20 when 'OFFICIAL_AIRPORT' then 20 when 'OFFICIAL_AUTHORITY' then 20
                     when 'VERIFIED_PARTNER' then 15 when 'INTERNAL_DATABASE' then 8 else 0 end;
  h := greatest(0, extract(epoch from a.departure_from - now()) / 3600.0);
  u := case when h <= 3 then 30 when h <= 12 then 20 when h <= 48 then 10 else 5 end;
  c := case a.confidence when 'high' then 20 when 'medium' then 12 else 5 end;
  return jsonb_build_object('total', f + s + u + c, 'freshness', f, 'source_strength', s, 'urgency', u, 'confidence', c);
end $function$;

CREATE OR REPLACE FUNCTION public._quote_expire()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n1 int; n2 int; n3 int; n4 int;
begin
  update public.quotes set status = 'EXPIRED' where status in ('BROKER_REVIEW','CLIENT_PRESENTED') and valid_until <= now();
  get diagnostics n1 = row_count;
  update public.quote_requests r set status = 'EXPIRED', status_reason = 'AVAILABILITY_ENDED'
   where r.status in ('REQUESTED','OPERATOR_CONTACTED','QUOTE_RECEIVED')
     and exists (select 1 from public.aircraft_availability a where a.id = r.availability_id
                  and (a.departure_until <= now() or a.status in ('EXPIRED','CANCELLED')));
  get diagnostics n2 = row_count;
  update public.booking_intents b set status = 'FAILED', status_reason = 'AVAILABILITY_LOST'
   where b.status in ('INTENT_CREATED','STAFF_REVIEW','OPERATOR_CONFIRMED')
     and exists (select 1 from public.aircraft_availability a where a.id = b.availability_id and a.status in ('EXPIRED','CANCELLED'));
  get diagnostics n3 = row_count;
  update public.opportunity_matches set status = 'CANCELLED', updated_at = now()
   where status = 'BOOKING_INTENT' and id in (select match_id from public.booking_intents where status = 'FAILED' and status_reason = 'AVAILABILITY_LOST');
  -- matches stuck mid-pipeline when the aircraft is gone and no open quote request remains
  update public.opportunity_matches m set status = 'EXPIRED', updated_at = now()
   where m.status in ('INQUIRY','QUOTE')
     and exists (select 1 from public.opportunities o join public.aircraft_availability a on a.id = o.availability_id
                  where o.id = m.opportunity_id and (a.departure_until <= now() or a.status in ('EXPIRED','CANCELLED','BOOKED')))
     and not exists (select 1 from public.quote_requests r where r.match_id = m.id and r.status in ('REQUESTED','OPERATOR_CONTACTED','QUOTE_RECEIVED'))
     and not exists (select 1 from public.quotes qq join public.quote_requests r on r.id = qq.quote_request_id
                      where r.match_id = m.id and qq.status = 'CLIENT_PRESENTED' and qq.valid_until > now());
  get diagnostics n4 = row_count;
  return jsonb_build_object('quotes_expired', n1, 'quote_requests_expired', n2, 'booking_intents_failed', n3, 'matches_expired', n4);
end $function$;

CREATE OR REPLACE FUNCTION public._request_quote(p_customer uuid, p_av uuid, p_pax integer, p_match uuid, p_req uuid, p_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.aircraft_availability%rowtype; m public.opportunity_matches%rowtype; v_opp uuid; v_rel uuid; v_id uuid; v_prof record;
begin
  select p.role, p.status into v_prof from public.profiles p where p.id = p_customer;
  if v_prof.role is distinct from 'customer' or v_prof.status is distinct from 'active' then raise exception 'customer not active'; end if;
  if p_pax is null or p_pax < 1 or p_pax > 40 then raise exception 'invalid passengers'; end if;
  select * into a from public.aircraft_availability where id = p_av;
  if not found or a.status <> 'AVAILABLE' or a.expires_at <= now() or a.departure_until < now() + interval '30 minutes' then
    raise exception 'availability is not current'; end if;
  if a.seats < p_pax then raise exception 'not enough seats'; end if;
  if p_match is not null then
    select * into m from public.opportunity_matches where id = p_match;
    if not found or m.customer_id <> p_customer or m.status not in ('ACTIVATED','ENGAGED') then raise exception 'match is not valid'; end if;
    select o.id into v_opp from public.opportunities o where o.id = m.opportunity_id and o.availability_id = p_av;
    if v_opp is null then raise exception 'match does not belong to this availability'; end if;
    v_rel := m.related_request_id;
  else
    select o.id into v_opp from public.opportunities o where o.availability_id = p_av;
  end if;
  if p_req is not null then
    if not exists (select 1 from public.travel_requests r where r.id = p_req and r.customer_id = p_customer) then raise exception 'request not found'; end if;
    v_rel := p_req;
  end if;
  if exists (select 1 from public.quote_requests q where q.customer_id = p_customer and q.availability_id = p_av
              and q.status in ('REQUESTED','OPERATOR_CONTACTED','QUOTE_RECEIVED')) then
    raise exception 'an active quote request already exists for this availability'; end if;
  insert into public.quote_requests(customer_id, availability_id, opportunity_id, match_id, request_id, passengers, customer_note)
  values (p_customer, p_av, v_opp, p_match, p_req, p_pax, left(p_note, 500)) returning id into v_id;
  perform public._match_advance(p_match, 'INQUIRY');
  perform public._learn(p_customer, v_rel, p_av, 'REQUESTED_QUOTE', 'in_app', jsonb_build_object('quote_request_id', v_id));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public._sync_airport_coords()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ids text; resp private_ext.http_response; j jsonb; x jsonb; n int := 0; k int;
begin
  select string_agg(icao_code, ',') into ids from public.airports where icao_code is not null;
  perform private_ext.http_set_curlopt('CURLOPT_CONNECTTIMEOUT','10');
  perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS','20000');
  resp := private_ext.http_get('https://aviationweather.gov/api/data/stationinfo?ids=' || ids || '&format=json');
  if resp.status <> 200 then raise exception 'stationinfo http %', resp.status; end if;
  j := resp.content::jsonb;
  for x in select jsonb_array_elements(j) loop
    continue when x->>'lat' is null or x->>'lon' is null;
    update public.airports set lat = (x->>'lat')::double precision, lon = (x->>'lon')::double precision,
           coords_source = 'aviationweather.gov stationinfo (OFFICIAL_AUTHORITY)'
     where icao_code = x->>'icaoId';
    get diagnostics k = row_count; n := n + k;
  end loop;
  return jsonb_build_object('updated', n);
end $function$;

CREATE OR REPLACE FUNCTION public._withdraw_opps_on_supply_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.opportunities
     set status = case when new.status = 'EXPIRED' then 'EXPIRED'::public.opportunity_status else 'WITHDRAWN'::public.opportunity_status end,
         status_reason = 'SUPPLY_' || new.status::text
   where availability_id = new.id
     and ((new.status in ('HELD','BOOKED') and status in ('DETECTED','VALIDATED','MATCHED','ACTIVATION_PENDING','ACTIVATED','ENGAGED'))
       or (new.status in ('CANCELLED','EXPIRED') and status in ('DETECTED','VALIDATED','MATCHED','ACTIVATION_PENDING','ACTIVATED','ENGAGED','INQUIRY','QUOTE','BOOKING_INTENT')));
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.accept_quote(p_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes%rowtype; r public.quote_requests%rowtype; a public.aircraft_availability%rowtype; v_bi uuid;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  select * into r from public.quote_requests where id = q.quote_request_id;
  if r.customer_id <> (select auth.uid()) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if q.status <> 'CLIENT_PRESENTED' or q.valid_until <= now() then raise exception 'quote is not open for acceptance'; end if;
  select * into a from public.aircraft_availability where id = q.availability_id;
  if a.status <> 'AVAILABLE' or a.expires_at <= now() then raise exception 'availability is no longer current'; end if;
  update public.quotes set status = 'CLIENT_ACCEPTED', decided_at = now() where id = p_quote_id;
  insert into public.booking_intents(quote_id, customer_id, availability_id, opportunity_id, match_id, price_snapshot_usd)
  values (p_quote_id, r.customer_id, q.availability_id, r.opportunity_id, r.match_id, q.client_price_usd) returning id into v_bi;
  perform public._match_advance(r.match_id, 'BOOKING_INTENT');
  perform public._learn(r.customer_id, r.request_id, q.availability_id, 'SELECTED', 'in_app', jsonb_build_object('quote_id', p_quote_id));
  return jsonb_build_object('status', 'BOOKING_INTENT_CREATED', 'booking_intent_id', v_bi,
    'notice_ar', 'تم تسجيل نيتك في الحجز. لا يوجد حجز مؤكد حتى يؤكد فريقنا والمشغّل.');
end $function$;

CREATE OR REPLACE FUNCTION public.activate_opportunity(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare op public.opportunities%rowtype; m record; g record; n_act int := 0; n_blk int := 0;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into op from public.opportunities where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if op.status <> 'ACTIVATION_PENDING' then
    return jsonb_build_object('status', 'NOT_READY_FOR_ACTIVATION', 'opportunity_status', op.status);
  end if;
  for m in select id, customer_id, related_request_id from public.opportunity_matches
            where opportunity_id = p_id and status = 'MATCHED' order by relevance desc loop
    select * into g from public._opp_gate(m.id);
    if g.o_decision = 'ALLOWED' then
      update public.opportunity_matches set status = 'ACTIVATED', gate_decision = 'ALLOWED', gate_reason = null,
        gate_checked_at = now(), channel = g.o_channel, activated_at = now(), last_outcome = 'DELIVERED', updated_at = now()
       where id = m.id;
      insert into public.contact_controls(customer_id, last_contacted_at, activations_count)
      values (m.customer_id, now(), 1)
      on conflict (customer_id) do update set last_contacted_at = now(),
        activations_count = public.contact_controls.activations_count + 1, updated_at = now();
      insert into public.learning_events(customer_id, request_id, availability_id, outcome, channel, details)
      values (m.customer_id, m.related_request_id, op.availability_id, 'DELIVERED', g.o_channel,
              jsonb_build_object('opportunity_id', p_id, 'surface', 'in_app_feed'));
      insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
      values ((select auth.uid()), 'match_activated', 'opportunity_match', m.id,
              jsonb_build_object('opportunity_id', p_id, 'channel', g.o_channel));
      n_act := n_act + 1;
    else
      update public.opportunity_matches set gate_decision = 'BLOCKED', gate_reason = g.o_reason, gate_checked_at = now() where id = m.id;
      n_blk := n_blk + 1;
    end if;
  end loop;
  if n_act = 0 then
    return jsonb_build_object('status', 'NO_ELIGIBLE_CUSTOMERS', 'blocked', n_blk);
  end if;
  update public.opportunities set status = 'ACTIVATED', status_reason = 'ACTIVATED_BY_STAFF' where id = p_id;
  return jsonb_build_object('status', 'ACTIVATED', 'activated', n_act, 'blocked', n_blk);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_role(target_user uuid, new_role app_role, new_status text DEFAULT 'active'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  old_role public.app_role;
  old_status text;
begin
  if not (select public.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if new_status not in ('pending','active','suspended') then
    raise exception 'invalid status';
  end if;
  select role, status into old_role, old_status from public.profiles where id = target_user;
  if not found then
    raise exception 'user not found';
  end if;
  update public.profiles set role = new_role, status = new_status where id = target_user;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'set_role', 'profile', target_user,
    jsonb_build_object('old_role', old_role, 'new_role', new_role, 'old_status', old_status, 'new_status', new_status));
end $function$;

CREATE OR REPLACE FUNCTION public.apply_assistant_proposal(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pr public.assistant_proposals%rowtype; cv public.conversations%rowtype; uid uuid := (select auth.uid());
  pl jsonb; v_id uuid; v_raw text; v_today date; v_status text;
begin
  select * into pr from public.assistant_proposals where id = p_id for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  select * into cv from public.conversations where id = pr.conversation_id;
  if not (cv.customer_id = uid or (select public.is_staff())) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if pr.status <> 'PROPOSED' then return jsonb_build_object('status', 'ALREADY_' || pr.status); end if;
  pl := pr.payload;
  begin
    if pr.kind = 'CREATE_TRAVEL_REQUEST' then
      if not exists (select 1 from public.airports where iata_code = pl ->> 'origin_code')
         or not exists (select 1 from public.airports where iata_code = pl ->> 'destination_code') then raise exception 'unknown airport'; end if;
      if (pl ->> 'origin_code') = (pl ->> 'destination_code') then raise exception 'origin equals destination'; end if;
      v_today := (now() at time zone public._airport_tz(pl ->> 'origin_code'))::date;
      if (pl ->> 'travel_date')::date < v_today then raise exception 'travel date is in the past'; end if;
      select content into v_raw from public.messages where conversation_id = cv.id and role = 'customer' order by created_at desc limit 1;
      insert into public.travel_requests(customer_id, raw_text, origin_code, destination_code, travel_date, departure_period, passengers,
                                         baggage_note, return_requested, channel, parsed_by)
      values (cv.customer_id, coalesce(v_raw, '(assistant)'), pl ->> 'origin_code', pl ->> 'destination_code', (pl ->> 'travel_date')::date,
              nullif(pl ->> 'departure_period', ''), (pl ->> 'passengers')::int, left(pl ->> 'baggage_note', 200),
              coalesce((pl ->> 'return_requested')::boolean, false), cv.channel, 'llm') returning id into v_id;
      select status::text into v_status from public.travel_requests where id = v_id;
    elsif pr.kind = 'REQUEST_QUOTE' then
      v_id := public._request_quote(cv.customer_id, (pl ->> 'availability_id')::uuid, (pl ->> 'passengers')::int,
                nullif(pl ->> 'match_id', '')::uuid, nullif(pl ->> 'request_id', '')::uuid, pl ->> 'note');
      v_status := 'REQUESTED';
    elsif pr.kind = 'ESCALATE' then
      insert into public.escalations(customer_id, conversation_id, reason)
      values (cv.customer_id, cv.id, left(coalesce(pl ->> 'reason', 'unspecified'), 500)) returning id into v_id;
      v_status := 'OPEN';
    else
      raise exception 'unsupported proposal kind';
    end if;
  exception when others then
    update public.assistant_proposals set status = 'REJECTED', reject_reason = left(sqlerrm, 300), decided_at = now() where id = p_id;
    return jsonb_build_object('status', 'REJECTED', 'reason', left(sqlerrm, 300));
  end;
  update public.assistant_proposals set status = 'APPLIED', applied_entity_id = v_id, decided_at = now() where id = p_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (uid, 'assistant_proposal_applied', 'assistant_proposal', p_id, jsonb_build_object('kind', pr.kind, 'entity_id', v_id));
  return jsonb_build_object('status', 'APPLIED', 'entity_id', v_id, 'entity_status', v_status);
end $function$;

CREATE OR REPLACE FUNCTION public.approve_demand_signal_contact(p_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.demand_signals set contact_approved_by = (select auth.uid()), contact_approved_at = now(),
         review_note = coalesce(p_note, review_note)
   where id = p_id;
  if not found then raise exception 'signal not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'DEMAND_SIGNAL_CONTACT_APPROVED', 'demand_signal', p_id, jsonb_build_object('note', p_note));
end $function$;

CREATE OR REPLACE FUNCTION public.audit_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'availability_created', 'aircraft_availability', new.id,
            jsonb_build_object('status', new.status, 'source', new.source));
  elsif new.status <> old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'availability_status', 'aircraft_availability', new.id,
            jsonb_build_object('from', old.status, 'to', new.status, 'reason', new.status_reason));
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.audit_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'request_created', 'travel_request', new.id,
            jsonb_build_object('status', new.status, 'parsed_by', new.parsed_by, 'channel', new.channel));
  elsif new.status <> old.status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), 'request_status', 'travel_request', new.id,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.availability_transition_allowed(a availability_status, b availability_status)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (a, b) in (
    ('PENDING_VERIFICATION','AVAILABLE'), ('AVAILABLE','HELD'), ('HELD','BOOKED'),
    ('PENDING_VERIFICATION','EXPIRED'), ('AVAILABLE','EXPIRED'), ('HELD','EXPIRED'),
    ('PENDING_VERIFICATION','CANCELLED'), ('AVAILABLE','CANCELLED'), ('HELD','CANCELLED'), ('BOOKED','CANCELLED')
  );
$function$;

CREATE OR REPLACE FUNCTION public.cancel_booking_intent(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.booking_intents%rowtype;
begin
  select * into b from public.booking_intents where id = p_id for update;
  if not found or b.customer_id <> (select auth.uid()) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if b.status not in ('INTENT_CREATED','STAFF_REVIEW') then raise exception 'booking can no longer be cancelled by the customer'; end if;
  update public.booking_intents set status = 'CANCELLED', status_reason = 'CANCELLED_BY_CUSTOMER' where id = p_id;
  update public.opportunity_matches set status = 'CANCELLED', updated_at = now() where id = b.match_id and status = 'BOOKING_INTENT';
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_quote_request(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.quote_requests set status = 'CANCELLED', status_reason = 'CANCELLED_BY_REQUESTER'
   where id = p_id and (customer_id = (select auth.uid()) or (select public.is_staff()));
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.cancel_travel_request(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.travel_requests set status = 'CANCELLED'
  where id = p_id and (customer_id = (select auth.uid()) or (select public.is_staff()));
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.compute_request_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m text[] := '{}';
begin
  if tg_op = 'INSERT' and new.travel_date is not null and new.travel_date < current_date then
    raise exception 'travel_date is in the past';
  end if;
  if new.status = 'CANCELLED' then new.updated_at := now(); return new; end if;
  if new.origin_code is null then m := array_append(m, 'origin_code'); end if;
  if new.destination_code is null then m := array_append(m, 'destination_code'); end if;
  if new.travel_date is null then m := array_append(m, 'travel_date'); end if;
  if new.passengers is null then m := array_append(m, 'passengers'); end if;
  new.missing_fields := m;
  new.status := case when cardinality(m) = 0 then 'READY' else 'NEEDS_INFO' end;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.confirm_journey_brief(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.journey_briefs%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into j from public.journey_briefs where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if j.status <> 'DRAFT' then raise exception 'brief is not a draft'; end if;
  update public.journey_briefs set status = 'STAFF_CONFIRMED', confirmed_by = (select auth.uid()), confirmed_at = now() where id = p_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'journey_brief_confirmed', 'journey_brief', p_id, '{}'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.create_assistant_proposal(p_conversation_id uuid, p_kind text, p_payload jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.assistant_proposals(conversation_id, kind, payload) values (p_conversation_id, p_kind, p_payload) returning id $function$;

CREATE OR REPLACE FUNCTION public.demand_signal_transition_allowed(a demand_signal_status, b demand_signal_status)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (a, b) in (
    ('NEW','IN_REVIEW'),('NEW','DISMISSED'),('NEW','EXPIRED'),
    ('IN_REVIEW','APPROVED_FOR_FOLLOWUP'),('IN_REVIEW','MONITORING'),('IN_REVIEW','DISMISSED'),('IN_REVIEW','EXPIRED'),
    ('MONITORING','IN_REVIEW'),('MONITORING','DISMISSED'),('MONITORING','EXPIRED'),
    ('APPROVED_FOR_FOLLOWUP','DISMISSED'),('APPROVED_FOR_FOLLOWUP','EXPIRED'))
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_availability()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  update public.aircraft_availability set status = 'EXPIRED', status_reason = 'auto-expired'
  where status in ('PENDING_VERIFICATION','AVAILABLE','HELD') and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.expire_stale_demand_signals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  update public.demand_signals set status = 'EXPIRED'
   where expires_at is not null and expires_at < now() and status in ('NEW','IN_REVIEW','MONITORING','APPROVED_FOR_FOLLOWUP');
  get diagnostics n = row_count;
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.expire_stale_opportunities()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public._opp_expire() $function$;

CREATE OR REPLACE FUNCTION public.expire_stale_quotes()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select public._quote_expire() $function$;

CREATE OR REPLACE FUNCTION public.eye_cron_secret_ok(p text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p is not null and length(p) > 20 and exists (select 1 from vault.decrypted_secrets where name = 'eye_cron_secret' and decrypted_secret = p)
$function$;

CREATE OR REPLACE FUNCTION public.eye_demand_calendar(p_days integer DEFAULT 120)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare res jsonb; d int := least(greatest(coalesce(p_days, 120), 1), 365);
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by (x ->> 'event_date')), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'signal_id', s.id, 'title', s.title, 'grade', s.grade, 'source', s.source_name,
      'event_date', s.est_event_start, 'days_until', s.est_event_start - current_date,
      'airports', ap.codes,
      'airports_basis', case when s.est_destination is not null then 'EXPLICIT' when ap.codes is not null then 'INFERRED_FROM_TITLE' else 'UNKNOWN' end,
      'tracked_aircraft_near_24h', case when ap.codes is null then null else
         (select count(distinct x.icao24) from public.aircraft_sightings x
           where x.observed_at > now() - interval '24 hours' and x.nearest_airport = any(ap.codes) and x.nearest_km <= 150) end,
      'data_status', 'INFERRED'
    ) as x
    from public.demand_signals s
    left join lateral (
      select array_agg(distinct c.iata) as codes from (
        select s.est_destination as iata where s.est_destination is not null
        union all
        select ca.iata from public._eye_city_airports() ca where s.est_destination is null and lower(s.title) like '%' || ca.city || '%'
      ) c where c.iata is not null) ap on true
    where s.status in ('NEW','IN_REVIEW','APPROVED_FOR_FOLLOWUP','MONITORING') and (s.expires_at is null or s.expires_at > now())
      and s.est_event_start between current_date and current_date + d
    limit 30
  ) q;
  return jsonb_build_object('generated_at', now(), 'window_days', d, 'events', res,
    'note', 'إشارات طلب محتملة من مصادر عامة. مش طلبات مؤكدة. المطارات المرتبطة بالفعالية استنتاج من اسمها إلا لو مكتوبة صراحة.');
end $function$;

CREATE OR REPLACE FUNCTION public.eye_digest()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j jsonb;
begin
  select jsonb_build_object(
    'generated_at', now(),
    'flight', jsonb_build_object(
      'sightings_24h', (select count(*) from public.aircraft_sightings where observed_at > now() - interval '24 hours'),
      'distinct_aircraft_24h', (select count(distinct icao24) from public.aircraft_sightings where observed_at > now() - interval '24 hours'),
      'fetch_ok_24h', (select count(*) from public.aircraft_fetch_runs where ran_at > now() - interval '24 hours' and ok),
      'fetch_failed_24h', (select count(*) from public.aircraft_fetch_runs where ran_at > now() - interval '24 hours' and not ok),
      'minutes_since_last_sighting', (select round(extract(epoch from now() - max(observed_at)) / 60) from public.aircraft_sightings),
      'legs_24h', (select count(*) from public.aircraft_legs where created_at > now() - interval '24 hours'),
      'legs_total', (select count(*) from public.aircraft_legs)),
    'journey', jsonb_build_object(
      'minutes_since_weather', (select round(extract(epoch from now() - max(fetched_at)) / 60) from public.weather_snapshots),
      'ifr_or_worse', (select coalesce(jsonb_agg(airport_code order by airport_code), '[]'::jsonb) from (select distinct on (airport_code) airport_code, flight_category, wind_speed_kt from public.weather_snapshots where flight_category is not null and fetched_at > now() - interval '3 hours' order by airport_code, issued_at desc) w where flight_category in ('IFR', 'LIFR')),
      'strong_wind_25kt', (select coalesce(jsonb_agg(airport_code order by airport_code), '[]'::jsonb) from (select distinct on (airport_code) airport_code, flight_category, wind_speed_kt from public.weather_snapshots where flight_category is not null and fetched_at > now() - interval '3 hours' order by airport_code, issued_at desc) w where wind_speed_kt >= 25)),
    'demand', jsonb_build_object(
      'active', (select count(*) from public.demand_signals where expires_at is null or expires_at > now()),
      'by_grade', (select coalesce(jsonb_object_agg(g, c), '{}'::jsonb) from (select grade::text g, count(*) c from public.demand_signals where expires_at is null or expires_at > now() group by 1) x),
      'latest_titles', (select coalesce(jsonb_agg(title), '[]'::jsonb) from (select title from public.demand_signals where expires_at is null or expires_at > now() order by created_at desc limit 3) t)),
    'opportunities', jsonb_build_object(
      'awaiting_approval', (select count(*) from public.opportunities where status = 'ACTIVATION_PENDING'),
      'validated', (select count(*) from public.opportunities where status = 'VALIDATED'),
      'expired', (select count(*) from public.opportunities where status = 'EXPIRED')),
    'system', jsonb_build_object(
      'cron_ok_24h', (select count(*) from cron.job_run_details where status = 'succeeded' and start_time > now() - interval '24 hours'),
      'cron_failed_24h', (select count(*) from cron.job_run_details where status <> 'succeeded' and start_time > now() - interval '24 hours'))
  ) into j;
  return j;
end $function$;

CREATE OR REPLACE FUNCTION public.eye_fleet_report(p_regs text[], p_consent boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare norm text[]; res jsonb;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if not coalesce(p_consent, false) then raise exception 'operator consent required'; end if;
  norm := array(select distinct regexp_replace(upper(r), '[^A-Z0-9]', '', 'g') from unnest(coalesce(p_regs, '{}')) r
                where btrim(r) <> '');
  if cardinality(norm) = 0 then raise exception 'no registrations given'; end if;
  if cardinality(norm) > 50 then raise exception 'max 50 aircraft per report'; end if;

  select coalesce(jsonb_agg(row order by (row ->> 'registration')), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'registration', i.reg,
      'found', ls.icao24 is not null,
      'icao_type', ls.icao_type, 'category', ls.category,
      'last_seen_at', ls.observed_at,
      'minutes_since_seen', case when ls.observed_at is null then null else round(extract(epoch from now() - ls.observed_at) / 60.0) end,
      'nearest_airport', ls.nearest_airport, 'nearest_km', ls.nearest_km,
      'altitude_ft', ls.alt_ft, 'speed_kt', ls.gs_kt,
      'sightings_24h', (select count(*) from public.aircraft_sightings s where s.icao24 = ls.icao24 and s.observed_at > now() - interval '24 hours'),
      'legs_48h', (select count(*) from public.aircraft_legs l where l.icao24 = ls.icao24 and l.departed_at > now() - interval '48 hours'),
      'last_leg', (select jsonb_build_object('from', l.origin_airport, 'to', l.dest_airport, 'status', l.status,
                     'confidence', l.confidence, 'departed_at', l.departed_at, 'arrived_at', l.arrived_at)
                   from public.aircraft_legs l where l.icao24 = ls.icao24 order by l.departed_at desc limit 1),
      'data_status', 'INFERRED'
    ) as row
    from unnest(norm) as i(reg)
    left join lateral (
      select s.* from public.aircraft_sightings s
       where regexp_replace(upper(coalesce(s.registration, '')), '[^A-Z0-9]', '', 'g') = i.reg
       order by s.observed_at desc limit 1) ls on true
  ) q;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'fleet_report_generated', 'fleet_report', null,
          jsonb_build_object('aircraft_count', cardinality(norm), 'operator_consent', true));
  return jsonb_build_object('generated_at', now(), 'aircraft', res,
    'note', 'مستنتج من تتبع عام. لا يدل على التوافر ولا على الحجز.');
end $function$;

CREATE OR REPLACE FUNCTION public.eye_notify(p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare resp private_ext.http_response; sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'eye_cron_secret';
  perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  resp := private_ext.http(('POST', 'https://yiklciblxwymcxxszkty.supabase.co/functions/v1/notify-owner?mode=' || case when p_mode = 'digest' then 'digest' else 'alerts' end,
            array[private_ext.http_header('x-cron-secret', sec)], 'application/json', '{}')::private_ext.http_request);
  return jsonb_build_object('status', resp.status, 'body', left(coalesce(resp.content, ''), 600));
exception when others then
  return jsonb_build_object('error', sqlerrm);
end $function$;

CREATE OR REPLACE FUNCTION public.eye_parked_aircraft(p_regs text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare norm text[]; res jsonb;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  norm := case when p_regs is null then null else
    array(select distinct regexp_replace(upper(r), '[^A-Z0-9]', '', 'g') from unnest(p_regs) r where btrim(r) <> '') end;
  select coalesce(jsonb_agg(x order by (x ->> 'parked_hours')::numeric desc), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'icao24', l.icao24, 'registration', rs.registration, 'icao_type', l.icao_type, 'category', rs.category,
      'airport', l.dest_airport, 'landed_at', l.arrived_at,
      'parked_hours', round((extract(epoch from now() - l.arrived_at) / 3600.0)::numeric, 1),
      'confidence', l.confidence,
      'related_demand_signals', (select count(*) from public.demand_signals d
          where d.status in ('NEW','IN_REVIEW','APPROVED_FOR_FOLLOWUP','MONITORING') and (d.expires_at is null or d.expires_at > now())
            and (d.est_origin = l.dest_airport or d.est_destination = l.dest_airport)),
      'open_explicit_requests', (select count(*) from public.travel_requests t
          where t.status = 'READY' and t.origin_code = l.dest_airport and (t.travel_date is null or t.travel_date >= current_date)),
      'data_status', 'INFERRED'
    ) as x
    from public.aircraft_legs l
    left join lateral (select s.registration, s.category from public.aircraft_sightings s where s.icao24 = l.icao24
                       order by s.observed_at desc limit 1) rs on true
    where l.status = 'landed' and l.dest_airport is not null and l.arrived_at > now() - interval '24 hours'
      and not exists (select 1 from public.aircraft_legs n where n.icao24 = l.icao24 and n.departed_at > l.departed_at)
      and (norm is null or regexp_replace(upper(coalesce(rs.registration, '')), '[^A-Z0-9]', '', 'g') = any(norm))
    limit 30
  ) q;
  return jsonb_build_object('generated_at', now(), 'aircraft', res,
    'note', 'طيارات نزلت وما اتشافش لها إقلاع بعده. ده مش معناه إنها متاحة، والتأكيد من المشغّل.');
end $function$;

CREATE OR REPLACE FUNCTION public.eye_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb; b jsonb;
begin
  begin a := public.run_opportunity_engine_cron(); exception when others then a := jsonb_build_object('error', sqlerrm); end;
  b := public.eye_notify('alerts');
  return jsonb_build_object('engine', a, 'notify', b);
end $function$;

CREATE OR REPLACE FUNCTION public.generate_journey_brief(p_quote_request_id uuid, p_pickup text DEFAULT NULL::text, p_dropoff text DEFAULT NULL::text, p_ground_origin_min integer DEFAULT NULL::integer, p_ground_dest_min integer DEFAULT NULL::integer, p_fbo_origin text DEFAULT NULL::text, p_fbo_dest text DEFAULT NULL::text, p_transport_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quote_requests%rowtype; a public.aircraft_availability%rowtype; v_km int; v_min int; v_bi uuid; v_id uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into q from public.quote_requests where id = p_quote_request_id;
  if not found then raise exception 'not found'; end if;
  select * into a from public.aircraft_availability where id = q.availability_id;
  if a.destination_code is null then raise exception 'availability has no destination'; end if;
  select r.distance_km into v_km from public.route_price_reference r
   where (r.origin_code = a.origin_code and r.destination_code = a.destination_code)
      or (r.origin_code = a.destination_code and r.destination_code = a.origin_code) limit 1;
  -- rough estimate: 700 km/h average + 20 min ground/taxi; NULL when the route distance is unknown
  v_min := case when v_km is null then null else round(v_km / 700.0 * 60 + 20)::int end;
  select b.id into v_bi from public.booking_intents b join public.quotes qt on qt.id = b.quote_id
   where qt.quote_request_id = q.id order by b.created_at desc limit 1;
  insert into public.journey_briefs(customer_id, quote_request_id, booking_intent_id, availability_id, origin_code, destination_code,
      pickup_note, dropoff_note, ground_origin_min_est, ground_dest_min_est, distance_km, flight_min_est,
      fbo_origin_note, fbo_dest_note, transport_note, created_by)
  values (q.customer_id, q.id, v_bi, a.id, a.origin_code, a.destination_code,
      left(p_pickup,300), left(p_dropoff,300), p_ground_origin_min, p_ground_dest_min, v_km, v_min,
      left(p_fbo_origin,300), left(p_fbo_dest,300), left(p_transport_note,300), (select auth.uid()))
  returning id into v_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'journey_brief_created', 'journey_brief', v_id, jsonb_build_object('quote_request_id', q.id));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.get_my_journey_briefs()
 RETURNS TABLE(brief_id uuid, quote_request_id uuid, origin_code text, origin_name_ar text, destination_code text, destination_name_ar text, departure_from timestamp with time zone, departure_until timestamp with time zone, pickup_note text, dropoff_note text, ground_origin_min_est integer, flight_min_est integer, ground_dest_min_est integer, total_min_est integer, fbo_origin_note text, fbo_dest_note text, transport_note text, value_status text, notice_ar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select j.id, j.quote_request_id, j.origin_code, ao.name_ar, j.destination_code, ad.name_ar, a.departure_from, a.departure_until,
    j.pickup_note, j.dropoff_note, j.ground_origin_min_est, j.flight_min_est, j.ground_dest_min_est,
    case when j.ground_origin_min_est is not null and j.flight_min_est is not null and j.ground_dest_min_est is not null
         then j.ground_origin_min_est + j.flight_min_est + j.ground_dest_min_est end,
    j.fbo_origin_note, j.fbo_dest_note, j.transport_note, j.value_status,
    'كل الأزمنة تقديرية وراجعها فريقنا، والقرار النهائي للمشغّل والطاقم.'
  from public.journey_briefs j
  join public.aircraft_availability a on a.id = j.availability_id
  join public.airports ao on ao.iata_code = j.origin_code
  join public.airports ad on ad.iata_code = j.destination_code
  where j.customer_id = (select auth.uid()) and j.status = 'STAFF_CONFIRMED'
    and a.status in ('AVAILABLE','HELD','BOOKED') and a.departure_until > now()
  order by j.created_at desc $function$;

CREATE OR REPLACE FUNCTION public.get_route_weather(p_origin text, p_destination text)
 RETURNS TABLE(airport_code text, airport_name_ar text, leg_ar text, obs_status text, observed_at timestamp with time zone, age_minutes integer, condition_ar text, wind_dir text, wind_speed_kt integer, visibility text, temp_c numeric, forecast_available boolean, forecast_valid_to timestamp with time zone, notice_ar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.iata_code, a.name_ar, v.leg,
    case when a.icao_code is null or m.id is null then 'UNKNOWN'
         when m.issued_at < now() - interval '150 minutes' then 'STALE' else 'CURRENT' end,
    m.issued_at,
    case when m.id is null then null else floor(extract(epoch from now() - m.issued_at) / 60)::int end,
    case when m.id is null or m.issued_at < now() - interval '150 minutes' then null else
      case m.flight_category when 'VFR' then 'رؤية جيدة' when 'MVFR' then 'رؤية حدّية' when 'IFR' then 'رؤية منخفضة'
                             when 'LIFR' then 'رؤية منخفضة جدًا' else 'غير محدد' end end,
    case when m.issued_at >= now() - interval '150 minutes' then m.wind_dir end,
    case when m.issued_at >= now() - interval '150 minutes' then m.wind_speed_kt end,
    case when m.issued_at >= now() - interval '150 minutes' then m.visibility end,
    case when m.issued_at >= now() - interval '150 minutes' then m.temp_c end,
    (t.id is not null), t.valid_to,
    case when a.icao_code is null or m.id is null or m.issued_at < now() - interval '150 minutes'
         then 'الطقس غير معروف حاليًا وسيتحقق منه فريقنا.'
         else 'رصد من مصدر رسمي (Aviation Weather Center) وقت الرصد المذكور. القرار النهائي للمشغّل والطاقم.' end
  from (values (upper(p_origin), 'المغادرة'), (upper(p_destination), 'الوصول')) v(code, leg)
  join public.airports a on a.iata_code = v.code
  left join lateral (select s.* from public.weather_snapshots s where s.airport_code = a.iata_code and s.report_type = 'METAR'
                      order by s.issued_at desc limit 1) m on true
  left join lateral (select s.* from public.weather_snapshots s where s.airport_code = a.iata_code and s.report_type = 'TAF'
                      and s.valid_to > now() order by s.issued_at desc limit 1) t on true
  where (select auth.uid()) is not null
  order by case v.leg when 'المغادرة' then 1 else 2 end $function$;

CREATE OR REPLACE FUNCTION public.guard_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'PENDING_VERIFICATION' then
      raise exception 'new availability must start as PENDING_VERIFICATION';
    end if;
    return new;
  end if;
  if new.status <> old.status
     and not public.availability_transition_allowed(old.status, new.status) then
    raise exception 'transition % -> % is not allowed', old.status, new.status using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_demand_signal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'NEW' then raise exception 'new signals must start as NEW' using errcode = '23514'; end if;
    if new.contact_approved_at is not null or new.contact_approved_by is not null then
      raise exception 'contact cannot be approved on creation' using errcode = '23514'; end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if not public.demand_signal_transition_allowed(old.status, new.status) then
      raise exception 'transition % -> % not allowed', old.status, new.status using errcode = '23514'; end if;
    if new.status = 'APPROVED_FOR_FOLLOWUP' and new.grade not in ('A','B') then
      raise exception 'only grade A/B signals can be approved for follow-up' using errcode = '23514'; end if;
    if new.status = 'MONITORING' and new.grade in ('A','B') then
      raise exception 'grade A/B signals are approved or dismissed, not monitored' using errcode = '23514'; end if;
    if new.status in ('APPROVED_FOR_FOLLOWUP','MONITORING','DISMISSED') and (new.reviewed_by is null or new.reviewed_at is null) then
      raise exception 'human review required' using errcode = '23514'; end if;
  end if;
  if new.contact_approved_at is not null and (new.status <> 'APPROVED_FOR_FOLLOWUP' or new.grade not in ('A','B') or new.contact_approved_by is null) then
    raise exception 'contact approval requires an A/B signal approved by a human' using errcode = '23514'; end if;
  if new.grade is distinct from old.grade and old.contact_approved_at is not null then
    raise exception 'cannot regrade a signal after contact approval' using errcode = '23514'; end if;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status is distinct from old.status and not public.opportunity_transition_allowed(old.status, new.status) then
    raise exception 'illegal opportunity transition % -> %', old.status, new.status;
  end if;
  if new.availability_id <> old.availability_id or new.origin_code <> old.origin_code
     or new.destination_code <> old.destination_code or new.source <> old.source then
    raise exception 'opportunity identity fields are immutable';
  end if;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guard_pipeline_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status::text is distinct from old.status::text
     and not public.pipeline_transition_allowed(tg_argv[0], old.status::text, new.status::text) then
    raise exception 'illegal % transition % -> %', tg_argv[0], old.status, new.status;
  end if;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.infer_aircraft_legs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n_done int := 0; n_air int := 0; n_lost int := 0;
begin
  -- Arrival = low (<=500ft) and within 5km of an airport, at ANY speed (a 10-min sample usually catches the
  -- landing roll/short final at 100-130kt, not a stopped aircraft). Departure = strict on-ground (<=80kt).
  with s as (
    select icao24, icao_type, observed_at, nearest_airport, nearest_km,
           (nearest_km <= 5 and coalesce(alt_ft,0) <= 500 and coalesce(gs_kt,0) <= 80) as is_g,
           (nearest_km <= 5 and coalesce(alt_ft,0) <= 500) as is_low
    from public.aircraft_sightings where observed_at > now() - interval '48 hours'
  ), arr as (
    select l.icao24, l.icao_type, l.nearest_airport as d, l.observed_at as arr_at, l.is_g as arr_ground,
           (select g.observed_at from s g
             where g.icao24 = l.icao24 and g.is_g and g.observed_at < l.observed_at
             order by g.observed_at desc limit 1) as dep_at
    from s l where l.is_low and l.nearest_airport is not null
  ), legs as (
    select a.icao24, a.icao_type, g.nearest_airport as o, a.d, a.dep_at, a.arr_at, a.arr_ground,
           exists (select 1 from s x where x.icao24 = a.icao24 and not x.is_low
                     and x.observed_at > a.dep_at and x.observed_at < a.arr_at) as had_air
    from arr a
    join s g on g.icao24 = a.icao24 and g.is_g and g.observed_at = a.dep_at
    where a.dep_at is not null and g.nearest_airport is not null
      and g.nearest_airport <> a.d
      and a.arr_at - a.dep_at <= interval '8 hours'
  ), best as (
    select distinct on (icao24, dep_at) *
    from legs order by icao24, dep_at, arr_at
  )
  insert into public.aircraft_legs (icao24, icao_type, origin_airport, dest_airport, departed_at, arrived_at, status, confidence, basis)
  select icao24, icao_type, o, d, dep_at, arr_at, 'landed',
         case when had_air and arr_ground then 'HIGH' else 'MEDIUM' end,
         case when had_air and arr_ground then 'on ground at origin, airborne in between, on ground at destination'
              when had_air then 'on ground at origin, airborne in between, low near destination airport (landing observed)'
              else 'on ground at origin and near destination; no airborne point captured' end
  from best
  on conflict (icao24, departed_at) do update
    set dest_airport = excluded.dest_airport, arrived_at = excluded.arrived_at, status = 'landed',
        confidence = excluded.confidence, basis = excluded.basis, updated_at = now();
  get diagnostics n_done = row_count;

  with s as (
    select icao24, icao_type, observed_at, nearest_airport,
           (nearest_km <= 5 and coalesce(alt_ft,0) <= 500 and coalesce(gs_kt,0) <= 80) as is_g,
           (nearest_km <= 5 and coalesce(alt_ft,0) <= 500) as is_low
    from public.aircraft_sightings where observed_at > now() - interval '48 hours'
  ), lastg as (
    select distinct on (icao24) icao24, icao_type, observed_at, nearest_airport
    from s where is_g order by icao24, observed_at desc
  )
  insert into public.aircraft_legs (icao24, icao_type, origin_airport, dest_airport, departed_at, arrived_at, status, confidence, basis)
  select l.icao24, l.icao_type, l.nearest_airport, null, l.observed_at, null, 'in_flight', 'MEDIUM',
         'on ground at origin then airborne; destination not observed'
  from lastg l
  where exists (select 1 from s a where a.icao24 = l.icao24 and not a.is_low and a.observed_at > l.observed_at)
    and not exists (select 1 from s a where a.icao24 = l.icao24 and a.is_g and a.observed_at > l.observed_at)
    and not exists (select 1 from s a where a.icao24 = l.icao24 and a.is_low and a.observed_at > l.observed_at
                      and a.nearest_airport is distinct from l.nearest_airport)
    and (select max(a.observed_at) from s a where a.icao24 = l.icao24) > now() - interval '60 minutes'
  on conflict (icao24, departed_at) do nothing;
  get diagnostics n_air = row_count;

  update public.aircraft_legs set status = 'signal_lost', updated_at = now()
  where status = 'in_flight' and departed_at < now() - interval '6 hours';
  get diagnostics n_lost = row_count;

  delete from public.aircraft_legs where departed_at < now() - interval '30 days';
  return jsonb_build_object('landed_upserted', n_done, 'in_flight_new', n_air, 'signal_lost', n_lost);
end $function$;

CREATE OR REPLACE FUNCTION public.is_active_operator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'operator' and p.status = 'active');
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','broker') and p.status = 'active');
$function$;

CREATE OR REPLACE FUNCTION public.list_aircraft_sightings(p_minutes integer DEFAULT 30)
 RETURNS TABLE(icao_type text, category text, registration text, callsign text, lat double precision, lon double precision, alt_ft integer, gs_kt numeric, nearest_airport text, nearest_km integer, observed_at timestamp with time zone, age_min integer, source_name text, data_status text, availability_note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
  select d.icao_type, d.category, d.registration, d.callsign, d.lat, d.lon, d.alt_ft, d.gs_kt, d.nearest_airport, d.nearest_km, d.observed_at,
         (extract(epoch from (now() - d.observed_at)) / 60)::int, d.source_name, 'OBSERVED'::text,
         'ظهور طائرة لا يعني أنها متاحة. التوافر بتأكيد المشغّل فقط.'::text
  from (select distinct on (s.icao24) s.* from public.aircraft_sightings s
         where s.observed_at > now() - make_interval(mins => greatest(1, least(p_minutes, 1440)))
         order by s.icao24, s.observed_at desc) d
  order by d.observed_at desc;
end $function$;

CREATE OR REPLACE FUNCTION public.list_current_availability()
 RETURNS TABLE(id uuid, aircraft_model text, category text, origin_code text, destination_code text, departure_from timestamp with time zone, departure_until timestamp with time zone, seats integer, source truth_source, verified_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id, a.aircraft_model, m.category, a.origin_code, a.destination_code, a.departure_from,
         a.departure_until, a.seats, a.source, a.verified_at, a.expires_at
  from public.aircraft_availability a join public.aircraft_models m on m.model = a.aircraft_model
  where a.status = 'AVAILABLE' and a.expires_at > now() and a.departure_until > now()
    and a.is_demo = coalesce((select p.is_demo from public.profiles p where p.id = (select auth.uid())), false);
$function$;

CREATE OR REPLACE FUNCTION public.list_demand_signals(p_status demand_signal_status DEFAULT NULL::demand_signal_status)
 RETURNS TABLE(id uuid, grade demand_grade, grade_label text, is_confirmed_demand boolean, title text, evidence text, evidence_date date, source_name text, source_url text, source_truth truth_source, est_origin text, est_destination text, est_event_start date, est_pax integer, demand_confidence text, recommended_action text, status demand_signal_status, contact_approved boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
  select s.id, s.grade,
         case s.grade when 'A' then 'طلب صريح' when 'B' then 'احتياج سفر قوي' when 'C' then 'إشارة سياقية قوية (غير مؤكدة)'
                      when 'D' then 'إشارة سياقية ضعيفة (غير مؤكدة)' else 'معلومة سوق فقط' end,
         (s.grade in ('A','B') and s.status = 'APPROVED_FOR_FOLLOWUP'),
         s.title, s.evidence, s.evidence_date, s.source_name, s.source_url, s.source_truth, s.est_origin, s.est_destination, s.est_event_start,
         s.est_pax, s.demand_confidence, s.recommended_action, s.status, (s.contact_approved_at is not null)
  from public.demand_signals s
  where p_status is null or s.status = p_status
  order by s.created_at desc;
end $function$;

CREATE OR REPLACE FUNCTION public.list_my_opportunities()
 RETURNS TABLE(match_id uuid, opportunity_id uuid, origin_code text, origin_name_ar text, destination_code text, destination_name_ar text, departure_from timestamp with time zone, departure_until timestamp with time zone, seats integer, aircraft_category text, trigger_type opportunity_trigger, source truth_source, verified_at timestamp with time zone, expires_at timestamp with time zone, availability_state text, final_confirmation_required boolean, message_ar text, why text[], indicative_price jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.id, o.id, o.origin_code, ao.name_ar, o.destination_code, ad.name_ar, a.departure_from, a.departure_until, a.seats, mo.category,
    o.trigger_type, a.source, a.verified_at, a.expires_at, 'AVAILABLE_PER_OPERATOR_UPDATE', true,
    ('طائرة خاصة أصبحت متاحة من ' || ao.name_ar || ' إلى ' || ad.name_ar ||
      case when a.departure_from > now() + interval '1 hour'
             then ' — تبدأ نافذة المغادرة بعد نحو ' || round(extract(epoch from a.departure_from - now()) / 3600.0)::int || ' ساعة'
           when a.departure_from > now() then ' — تبدأ نافذة المغادرة خلال أقل من ساعة'
           else ' — نافذة المغادرة مفتوحة الآن' end ||
      '. بحسب آخر تحديث من المشغّل، والتأكيد النهائي من المشغّل.'),
    array(select jsonb_array_elements_text(m.reason -> 'text_ar')),
    (select case when p.price_mid_usd is null then null else jsonb_build_object('status', 'INDICATIVE',
        'low_usd', p.price_low_usd, 'mid_usd', p.price_mid_usd, 'high_usd', p.price_high_usd,
        'note', 'سعر مرجعي وليس عرضًا؛ السعر النهائي من المشغّل') end
       from public.route_price_reference p
      where p.display_allowed and ((p.origin_code = o.origin_code and p.destination_code = o.destination_code)
         or (p.origin_code = o.destination_code and p.destination_code = o.origin_code)) limit 1)
  from public.opportunity_matches m
  join public.opportunities o on o.id = m.opportunity_id
  join public.aircraft_availability a on a.id = o.availability_id
  join public.airports ao on ao.iata_code = o.origin_code
  join public.airports ad on ad.iata_code = o.destination_code
  join public.aircraft_models mo on mo.model = a.aircraft_model
  where m.customer_id = (select auth.uid()) and m.status in ('ACTIVATED','ENGAGED')
    and a.status = 'AVAILABLE' and a.expires_at > now() and a.departure_until > now()
  order by a.departure_from $function$;

CREATE OR REPLACE FUNCTION public.list_my_quotes()
 RETURNS TABLE(quote_id uuid, quote_request_id uuid, origin_code text, origin_name_ar text, destination_code text, destination_name_ar text, departure_from timestamp with time zone, departure_until timestamp with time zone, passengers integer, client_price_usd numeric, currency text, valid_until timestamp with time zone, status quote_status, price_status text, client_note text, notice_ar text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select q.id, r.id, a.origin_code, ao.name_ar, a.destination_code, ad.name_ar, a.departure_from, a.departure_until, r.passengers,
    q.client_price_usd, q.currency, q.valid_until, q.status, 'OPERATOR_QUOTE', q.client_note,
    case when q.status = 'CLIENT_ACCEPTED'
         then 'تم تسجيل نيتك في الحجز. لا يوجد حجز مؤكد حتى يؤكد فريقنا والمشغّل.'
         else 'عرض سعر وارد من المشغّل. لا يصبح حجزًا إلا بعد تأكيد فريقنا والمشغّل.' end
  from public.quotes q
  join public.quote_requests r on r.id = q.quote_request_id
  join public.aircraft_availability a on a.id = q.availability_id
  join public.airports ao on ao.iata_code = a.origin_code
  join public.airports ad on ad.iata_code = a.destination_code
  where r.customer_id = (select auth.uid()) and q.status in ('CLIENT_PRESENTED','CLIENT_ACCEPTED')
    and (q.status = 'CLIENT_ACCEPTED' or (q.valid_until > now() and a.status = 'AVAILABLE' and a.expires_at > now()))
  order by q.created_at desc $function$;

CREATE OR REPLACE FUNCTION public.list_operator_requests()
 RETURNS TABLE(quote_request_id uuid, availability_id uuid, origin_code text, destination_code text, departure_from timestamp with time zone, departure_until timestamp with time zone, passengers integer, status quote_request_status, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select q.id, q.availability_id, a.origin_code, a.destination_code, a.departure_from, a.departure_until, q.passengers, q.status, q.created_at
  from public.quote_requests q join public.aircraft_availability a on a.id = q.availability_id
  where a.operator_id = (select auth.uid()) and (select public.is_active_operator())
    and q.status in ('REQUESTED','OPERATOR_CONTACTED')
  order by q.created_at $function$;

CREATE OR REPLACE FUNCTION public.list_opportunities_staff()
 RETURNS TABLE(id uuid, origin_code text, destination_code text, aircraft_category text, seats integer, trigger_type opportunity_trigger, status opportunity_status, source truth_source, verified_at timestamp with time zone, expires_at timestamp with time zone, score integer, score_parts jsonb, status_reason text, is_demo boolean, segment demand_segment, relevance integer, gate_decision text, gate_reason text, match_reasons text[], created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
  select o.id, o.origin_code, o.destination_code, mo.category, a.seats, o.trigger_type, o.status, o.source,
         o.verified_at, o.expires_at, o.score, o.score_parts, o.status_reason, a.is_demo,
         m.segment, m.relevance, m.gate_decision, m.gate_reason,
         coalesce(array(select jsonb_array_elements_text(m.reason -> 'text_ar')), '{}'::text[]),
         o.created_at
  from public.opportunities o
  join public.aircraft_availability a on a.id = o.availability_id
  join public.aircraft_models mo on mo.model = a.aircraft_model
  left join lateral (select x.* from public.opportunity_matches x where x.opportunity_id = o.id
                     order by x.relevance desc limit 1) m on true
  order by (o.status = 'ACTIVATION_PENDING') desc, o.created_at desc
  limit 30;
end $function$;

CREATE OR REPLACE FUNCTION public.list_public_aircraft_sightings()
 RETURNS TABLE(aircraft_category text, general_area text, observed_age_min integer, data_status text, notice text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  return query
  select d.category,
         case when d.nearest_km <= 200 then 'قرب ' || a.name_ar else 'منطقة غير محددة' end,
         (extract(epoch from (now() - d.observed_at)) / 60)::int,
         'OBSERVED'::text,
         'معلومة تتبّع فقط، ظهور الطائرة لا يعني أنها متاحة. التوافر بتأكيد المشغّل فقط.'::text
  from (select distinct on (s.icao24) s.* from public.aircraft_sightings s
         where s.observed_at > now() - interval '15 minutes' and s.category is not null
         order by s.icao24, s.observed_at desc) d
  left join public.airports a on a.iata_code = d.nearest_airport
  order by d.category, 2;
end $function$;

CREATE OR REPLACE FUNCTION public.match_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r public.travel_requests%rowtype;
  tz text; dist integer; ref record; opts jsonb; n integer; day_start timestamptz; day_end timestamptz;
begin
  select * into r from public.travel_requests where id = p_request_id;
  if not found or not (r.customer_id = (select auth.uid()) or (select public.is_staff())) then
    raise exception 'not found or not authorized' using errcode = '42501';
  end if;
  if r.status <> 'READY' then
    return jsonb_build_object('status', case when r.status = 'CANCELLED' then 'REQUEST_CANCELLED' else 'REQUEST_NOT_READY' end,
                              'missing_fields', to_jsonb(r.missing_fields), 'options', '[]'::jsonb);
  end if;

  select case a.country_code when 'AE' then 'Asia/Dubai' else 'Asia/Riyadh' end into tz
    from public.airports a where a.iata_code = r.origin_code;
  day_start := (r.travel_date::timestamp) at time zone tz;
  day_end := ((r.travel_date + 1)::timestamp) at time zone tz;

  select p.distance_km, p.price_low_usd, p.price_mid_usd, p.price_high_usd into ref
    from public.route_price_reference p
    where p.display_allowed and ((p.origin_code = r.origin_code and p.destination_code = r.destination_code)
       or (p.origin_code = r.destination_code and p.destination_code = r.origin_code)) limit 1;
  dist := ref.distance_km;

  with cand as (
    select a.id, a.aircraft_model, m.category, a.seats, a.source, a.verified_at, a.departure_from, a.departure_until, a.expires_at, m.range_km,
      (dist is null) as range_unverified,
      -- requested period as a local-time range on the travel date
      tstzrange(
        day_start + case r.departure_period when 'morning' then interval '5 hours' when 'noon' then interval '11 hours'
                    when 'evening' then interval '15 hours' when 'night' then interval '20 hours' end,
        day_start + case r.departure_period when 'morning' then interval '11 hours' when 'noon' then interval '15 hours'
                    when 'evening' then interval '20 hours' when 'night' then interval '29 hours' end) as want
    from public.aircraft_availability a
    join public.aircraft_models m on m.model = a.aircraft_model
    where a.is_demo = coalesce((select p.is_demo from public.profiles p where p.id = r.customer_id), false) and a.status = 'AVAILABLE'                                   -- hard: verified
      and a.expires_at > now() and a.departure_until > now()       -- hard: current
      and a.origin_code = r.origin_code and a.destination_code = r.destination_code  -- hard: route
      and tstzrange(a.departure_from, a.departure_until) && tstzrange(day_start, day_end)  -- hard: date
      and a.seats >= r.passengers                                  -- hard: capacity
      and (dist is null or m.range_km >= dist)                     -- hard: range when known
  ), scored as (
    select c.*,
      case when r.departure_period is null then 0
           when tstzrange(c.departure_from, c.departure_until) && c.want then 30 else 0 end as s_time,
      case when c.verified_at > now() - interval '1 hour' then 30 when c.verified_at > now() - interval '6 hours' then 20 else 10 end as s_fresh,
      case when c.seats - r.passengers <= 2 then 20 else 10 end as s_fit,
      case c.source when 'OFFICIAL_OPERATOR' then 20 when 'OFFICIAL_AIRPORT' then 20 when 'OFFICIAL_AUTHORITY' then 20
                    when 'VERIFIED_PARTNER' then 15 when 'INTERNAL_DATABASE' then 8 else 0 end as s_src
    from cand c
  ), top as (
    select * from scored order by (s_time + s_fresh + s_fit + s_src) desc, verified_at desc limit 5
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'availability_id', t.id, 'aircraft_model', t.aircraft_model, 'category', t.category,
      'seats', t.seats, 'departure_from', t.departure_from, 'departure_until', t.departure_until,
      'source', t.source, 'verified_at', t.verified_at, 'expires_at', t.expires_at,
      'availability_state', 'AVAILABLE_PER_OPERATOR_UPDATE', 'final_confirmation_required', true,
      'range_unverified', t.range_unverified,
      'score', t.s_time + t.s_fresh + t.s_fit + t.s_src,
      'score_parts', jsonb_build_object('time_match', t.s_time, 'freshness', t.s_fresh, 'seat_fit', t.s_fit, 'source_strength', t.s_src),
      'why', to_jsonb(array_remove(array[
        'المسار والتاريخ والسعة مطابقة',
        case when t.s_time = 30 then 'ضمن الفترة التي طلبتها' end,
        case when t.s_fresh >= 20 then 'تحديث المشغّل حديث' end,
        case when t.s_fit = 20 then 'سعة مناسبة لمجموعتك' end,
        case when t.range_unverified then 'لم يُتحقق من مدى الطائرة لهذا المسار' end
      ], null))
    ) order by (t.s_time + t.s_fresh + t.s_fit + t.s_src) desc), '[]'::jsonb), count(*)
  into opts, n from top t;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'match_run', 'travel_request', r.id,
          jsonb_build_object('options', n, 'route', r.origin_code||'-'||r.destination_code));

  return jsonb_build_object(
    'status', case when n = 0 then 'NO_VERIFIED_AVAILABILITY' else 'OK' end,
    'options', opts,
    'indicative_price', case when ref.price_mid_usd is null then null else
       jsonb_build_object('status','INDICATIVE','low_usd',ref.price_low_usd,'mid_usd',ref.price_mid_usd,'high_usd',ref.price_high_usd,
                          'note','سعر مرجعي وليس عرضًا؛ السعر النهائي من المشغّل') end);
end $function$;

CREATE OR REPLACE FUNCTION public.operator_decline_request(p_quote_request_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_op uuid;
begin
  select a.operator_id into v_op from public.quote_requests q join public.aircraft_availability a on a.id = q.availability_id where q.id = p_quote_request_id;
  if v_op is null or v_op <> (select auth.uid()) or not (select public.is_active_operator()) then
    raise exception 'not found or not authorized' using errcode = '42501'; end if;
  update public.quote_requests set status = 'OPERATOR_DECLINED', status_reason = left(p_reason, 200) where id = p_quote_request_id;
end $function$;

CREATE OR REPLACE FUNCTION public.operator_submit_quote(p_quote_request_id uuid, p_price_usd numeric, p_valid_until timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_op uuid;
begin
  select a.operator_id into v_op from public.quote_requests q join public.aircraft_availability a on a.id = q.availability_id where q.id = p_quote_request_id;
  if v_op is null or v_op <> (select auth.uid()) or not (select public.is_active_operator()) then
    raise exception 'not found or not authorized' using errcode = '42501'; end if;
  return public._insert_quote(p_quote_request_id, p_price_usd, p_valid_until, p_note, 'operator', (select auth.uid()));
end $function$;

CREATE OR REPLACE FUNCTION public.opportunity_transition_allowed(a opportunity_status, b opportunity_status)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case a
    when 'DETECTED' then b in ('VALIDATED','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'VALIDATED' then b in ('MATCHED','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'MATCHED' then b in ('ACTIVATION_PENDING','IGNORED','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'ACTIVATION_PENDING' then b in ('ACTIVATED','IGNORED','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'ACTIVATED' then b in ('ENGAGED','IGNORED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'ENGAGED' then b in ('INQUIRY','IGNORED','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'INQUIRY' then b in ('QUOTE','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'QUOTE' then b in ('BOOKING_INTENT','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'BOOKING_INTENT' then b in ('BOOKED','REJECTED','EXPIRED','CANCELLED','WITHDRAWN')
    when 'BOOKED' then b in ('FULFILLED','CANCELLED')
    else false end $function$;

CREATE OR REPLACE FUNCTION public.pipeline_transition_allowed(p_kind text, a text, b text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (p_kind, a, b) in (
    ('qr','REQUESTED','OPERATOR_CONTACTED'),('qr','REQUESTED','QUOTE_RECEIVED'),('qr','REQUESTED','CANCELLED'),('qr','REQUESTED','EXPIRED'),('qr','REQUESTED','OPERATOR_DECLINED'),
    ('qr','OPERATOR_CONTACTED','QUOTE_RECEIVED'),('qr','OPERATOR_CONTACTED','CANCELLED'),('qr','OPERATOR_CONTACTED','EXPIRED'),('qr','OPERATOR_CONTACTED','OPERATOR_DECLINED'),
    ('qr','QUOTE_RECEIVED','CANCELLED'),('qr','QUOTE_RECEIVED','EXPIRED'),
    ('quote','BROKER_REVIEW','CLIENT_PRESENTED'),('quote','BROKER_REVIEW','WITHDRAWN'),('quote','BROKER_REVIEW','EXPIRED'),
    ('quote','CLIENT_PRESENTED','CLIENT_ACCEPTED'),('quote','CLIENT_PRESENTED','CLIENT_REJECTED'),('quote','CLIENT_PRESENTED','EXPIRED'),('quote','CLIENT_PRESENTED','WITHDRAWN'),
    ('booking','INTENT_CREATED','STAFF_REVIEW'),('booking','INTENT_CREATED','CANCELLED'),('booking','INTENT_CREATED','FAILED'),
    ('booking','STAFF_REVIEW','OPERATOR_CONFIRMED'),('booking','STAFF_REVIEW','CANCELLED'),('booking','STAFF_REVIEW','FAILED'),
    ('booking','OPERATOR_CONFIRMED','BOOKED'),('booking','OPERATOR_CONFIRMED','CANCELLED'),('booking','OPERATOR_CONFIRMED','FAILED'),
    ('booking','BOOKED','FULFILLED'),('booking','BOOKED','CANCELLED')) $function$;

CREATE OR REPLACE FUNCTION public.post_customer_message(p_conversation_id uuid, p_content text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if not exists (select 1 from public.conversations where id = p_conversation_id and customer_id = (select auth.uid()) and status = 'open') then
    raise exception 'not found or not authorized' using errcode = '42501'; end if;
  insert into public.messages(conversation_id, role, content) values (p_conversation_id, 'customer', p_content) returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.present_quote(p_quote_id uuid, p_client_price_usd numeric, p_client_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes%rowtype; r public.quote_requests%rowtype; a public.aircraft_availability%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'not found'; end if;
  if q.status <> 'BROKER_REVIEW' then raise exception 'quote is not in broker review'; end if;
  select * into r from public.quote_requests where id = q.quote_request_id;
  select * into a from public.aircraft_availability where id = q.availability_id;
  if p_client_price_usd is null or p_client_price_usd < q.operator_price_usd then raise exception 'client price is below operator price'; end if;
  if q.valid_until < now() + interval '10 minutes' then raise exception 'quote is about to expire'; end if;
  if a.status <> 'AVAILABLE' or a.expires_at <= now() then raise exception 'availability is not current'; end if;
  update public.quotes set status = 'CLIENT_PRESENTED', client_price_usd = p_client_price_usd,
    client_note = left(p_client_note, 500), presented_at = now() where id = p_quote_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'quote_presented', 'quote', p_quote_id,
          jsonb_build_object('operator_price_usd', q.operator_price_usd, 'client_price_usd', p_client_price_usd));
  perform public._match_advance(r.match_id, 'QUOTE');
end $function$;

CREATE OR REPLACE FUNCTION public.record_assistant_message(p_conversation_id uuid, p_content text, p_structured jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  insert into public.messages(conversation_id, role, content, structured) values (p_conversation_id, 'assistant', p_content, p_structured) returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.record_opportunity_outcome(p_match_id uuid, p_outcome learning_outcome, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.opportunity_matches%rowtype; op public.opportunities%rowtype;
  uid uuid := (select auth.uid()); staff boolean := (select public.is_staff());
begin
  select * into m from public.opportunity_matches where id = p_match_id for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if pg_column_size(coalesce(p_details, '{}'::jsonb)) > 2000 then raise exception 'details too large'; end if;
  if not staff then
    if m.customer_id is distinct from uid then raise exception 'not found or not authorized' using errcode = '42501'; end if;
    if m.status not in ('ACTIVATED','ENGAGED') then raise exception 'match is not active'; end if;
    if p_outcome not in ('OPENED','VIEWED','CLICKED','REPLIED','REJECTED','IGNORED') then
      raise exception 'outcome not allowed for customers' using errcode = '42501';
    end if;
  end if;
  select * into op from public.opportunities where id = m.opportunity_id;
  insert into public.learning_events(customer_id, request_id, availability_id, outcome, channel, details)
  values (m.customer_id, m.related_request_id, op.availability_id, p_outcome, m.channel,
          coalesce(p_details, '{}'::jsonb) || jsonb_build_object('opportunity_id', op.id));
  update public.opportunity_matches set last_outcome = p_outcome,
    status = case when p_outcome = 'REJECTED' and status in ('ACTIVATED','ENGAGED') then 'REJECTED'
                  when p_outcome = 'IGNORED' and status in ('ACTIVATED','ENGAGED') then 'IGNORED'
                  else status end,
    updated_at = now() where id = p_match_id;
  if p_outcome in ('OPENED','VIEWED','CLICKED','REPLIED') then
    perform public._match_advance(p_match_id, 'ENGAGED');
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.refresh_aircraft_sightings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public._fetch_aircraft();
end $function$;

CREATE OR REPLACE FUNCTION public.refresh_demand_signals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public._fetch_demand_wikidata();
end $function$;

CREATE OR REPLACE FUNCTION public.refresh_weather()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public._fetch_weather();
end $function$;

CREATE OR REPLACE FUNCTION public.regrade_demand_signal(p_id uuid, p_grade demand_grade, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.demand_grade;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select grade into v_old from public.demand_signals where id = p_id for update;
  if not found then raise exception 'signal not found' using errcode = 'P0002'; end if;
  update public.demand_signals set grade = p_grade, review_note = coalesce(p_note, review_note) where id = p_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'DEMAND_SIGNAL_REGRADED', 'demand_signal', p_id, jsonb_build_object('from', v_old, 'to', p_grade, 'note', p_note));
end $function$;

CREATE OR REPLACE FUNCTION public.reject_opportunity(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare op public.opportunities%rowtype; m record; why text := btrim(coalesce(p_reason, ''));
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if char_length(why) = 0 then raise exception 'reason required'; end if;
  if char_length(why) > 300 then raise exception 'reason too long'; end if;
  select * into op from public.opportunities where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if op.status <> 'ACTIVATION_PENDING' then
    raise exception 'opportunity is not awaiting approval (status %)', op.status;
  end if;
  update public.opportunities set status = 'REJECTED', status_reason = 'REJECTED_BY_STAFF: ' || why where id = p_id;
  for m in select id, customer_id, related_request_id from public.opportunity_matches
            where opportunity_id = p_id and status = 'MATCHED' loop
    update public.opportunity_matches set status = 'REJECTED', updated_at = now() where id = m.id;
    insert into public.learning_events(customer_id, request_id, availability_id, outcome, channel, details)
    values (m.customer_id, m.related_request_id, op.availability_id, 'REJECTED', null,
            jsonb_build_object('opportunity_id', p_id, 'decided_by', 'staff', 'stage', 'before_activation', 'reason', why));
  end loop;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'opportunity_rejected_by_staff', 'opportunity', p_id, jsonb_build_object('reason', why));
end $function$;

CREATE OR REPLACE FUNCTION public.reject_quote(p_quote_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.quotes%rowtype; r public.quote_requests%rowtype;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  select * into r from public.quote_requests where id = q.quote_request_id;
  if r.customer_id <> (select auth.uid()) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  update public.quotes set status = 'CLIENT_REJECTED', decided_at = now() where id = p_quote_id;
  update public.opportunity_matches set status = 'REJECTED', last_outcome = 'REJECTED', updated_at = now()
   where id = r.match_id and status in ('ACTIVATED','ENGAGED','INQUIRY','QUOTE');
  perform public._learn(r.customer_id, r.request_id, q.availability_id, 'REJECTED', 'in_app',
    jsonb_build_object('quote_id', p_quote_id, 'reason', left(p_reason, 200)));
end $function$;

CREATE OR REPLACE FUNCTION public.request_quote(p_availability_id uuid, p_passengers integer, p_match_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public._request_quote((select auth.uid()), p_availability_id, p_passengers, p_match_id, p_request_id, p_note) $function$;

CREATE OR REPLACE FUNCTION public.resolve_escalation(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.escalations set status = 'RESOLVED', resolved_by = (select auth.uid()), resolved_at = now() where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.run_opportunity_engine()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare op record; sc jsonb; exp jsonb; n_new int; n_rows int; allowed int; cur public.opportunity_status; m record; g record;
  c_valid int := 0; c_rej int := 0; c_match int := 0; c_pend int := 0; c_monitor int := 0;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  exp := public._opp_expire();

  insert into public.opportunities (availability_id, origin_code, destination_code, trigger_type, detect_reason, source, verified_at, expires_at, created_by)
  select a.id, a.origin_code, a.destination_code,
    case when a.departure_from <= now() + interval '3 hours' then 'LAST_MINUTE'
         when a.departure_from <= now() + interval '24 hours' then 'TIME'
         else 'AVAILABILITY' end::public.opportunity_trigger,
    jsonb_build_object('rule', 'v1',
      'hours_to_departure', round((greatest(0, extract(epoch from a.departure_from - now())) / 3600.0)::numeric, 1),
      'verified_age_minutes', round((extract(epoch from now() - a.verified_at) / 60.0)::numeric),
      'source', a.source, 'seats', a.seats),
    a.source, a.verified_at, a.expires_at, (select auth.uid())
  from public.aircraft_availability a
  where a.status = 'AVAILABLE' and a.expires_at > now() and a.departure_until > now() and a.destination_code is not null
  on conflict (availability_id) do nothing;
  get diagnostics n_new = row_count;

  for op in select o.id, o.verified_at, a.status as astatus, a.departure_until
              from public.opportunities o join public.aircraft_availability a on a.id = o.availability_id
             where o.status = 'DETECTED' loop
    if op.astatus <> 'AVAILABLE' then
      update public.opportunities set status = 'WITHDRAWN', status_reason = 'SUPPLY_NOT_AVAILABLE' where id = op.id; c_rej := c_rej + 1;
    elsif op.verified_at < now() - interval '24 hours' then
      update public.opportunities set status = 'REJECTED', status_reason = 'STALE_VERIFICATION' where id = op.id; c_rej := c_rej + 1;
    elsif op.departure_until < now() + interval '30 minutes' then
      update public.opportunities set status = 'REJECTED', status_reason = 'TOO_LATE_TO_ACT' where id = op.id; c_rej := c_rej + 1;
    else
      update public.opportunities set status = 'VALIDATED', status_reason = null where id = op.id; c_valid := c_valid + 1;
    end if;
  end loop;

  for op in select id, status from public.opportunities where status in ('VALIDATED','MATCHED','ACTIVATION_PENDING') loop
    cur := op.status;
    sc := public._opp_score(op.id);
    update public.opportunities set score = (sc->>'total')::int, score_parts = sc where id = op.id;
    if (sc->>'total')::int < 40 then
      update public.opportunities set status_reason = 'LOW_OPPORTUNITY_SCORE_MONITOR' where id = op.id;
      c_monitor := c_monitor + 1; continue;
    end if;
    n_rows := public._opp_match(op.id);
    if cur = 'VALIDATED' and exists (select 1 from public.opportunity_matches where opportunity_id = op.id) then
      update public.opportunities set status = 'MATCHED', status_reason = null where id = op.id;
      cur := 'MATCHED'; c_match := c_match + 1;
    end if;
    if cur in ('MATCHED','ACTIVATION_PENDING') then
      allowed := 0;
      for m in select id from public.opportunity_matches where opportunity_id = op.id and status = 'MATCHED' loop
        select * into g from public._opp_gate(m.id);
        update public.opportunity_matches set gate_decision = g.o_decision, gate_reason = g.o_reason, gate_checked_at = now() where id = m.id;
        if g.o_decision = 'ALLOWED' then allowed := allowed + 1; end if;
      end loop;
      if cur = 'MATCHED' and allowed > 0 then
        update public.opportunities set status = 'ACTIVATION_PENDING', status_reason = 'AWAITING_STAFF_APPROVAL' where id = op.id;
        c_pend := c_pend + 1;
      end if;
    end if;
  end loop;

  insert into public.audit_logs(actor_id, action, entity_type, details)
  values ((select auth.uid()), 'engine_run', 'opportunity_engine',
    jsonb_build_object('detected', n_new, 'validated', c_valid, 'rejected_or_withdrawn', c_rej, 'matched', c_match,
                       'activation_pending', c_pend, 'monitor_only', c_monitor, 'expiry', exp));
  return jsonb_build_object('detected', n_new, 'validated', c_valid, 'rejected_or_withdrawn', c_rej, 'newly_matched', c_match,
                            'newly_activation_pending', c_pend, 'monitor_only', c_monitor, 'expiry', exp);
end $function$;

CREATE OR REPLACE FUNCTION public.run_opportunity_engine_cron()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid;
begin
  select id into uid from public.profiles where role = 'admin' and status = 'active' order by created_at limit 1;
  if uid is null then return jsonb_build_object('error', 'no_active_admin'); end if;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  return public.run_opportunity_engine();
end $function$;

CREATE OR REPLACE FUNCTION public.run_quote_maintenance()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public._quote_expire();
end $function$;

CREATE OR REPLACE FUNCTION public.set_availability_status(p_id uuid, p_new availability_status, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.aircraft_availability%rowtype; uid uuid := (select auth.uid()); staff boolean := (select public.is_staff());
begin
  select * into r from public.aircraft_availability where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if not staff and not (r.operator_id = uid and p_new = 'CANCELLED') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_new in ('AVAILABLE','HELD','BOOKED') and r.expires_at <= now() then
    raise exception 'availability already expired';
  end if;
  if p_new = 'AVAILABLE' and r.source in ('AI_INFERRED','UNVERIFIED_WEB') then
    raise exception 'source % cannot be verified as available', r.source;
  end if;
  update public.aircraft_availability set status = p_new, status_reason = p_reason,
    verified_at = case when p_new = 'AVAILABLE' then now() else verified_at end,
    verified_by = case when p_new = 'AVAILABLE' then uid else verified_by end
  where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.set_booking_status(p_id uuid, p_new booking_intent_status, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.booking_intents%rowtype; a public.aircraft_availability%rowtype; q public.quotes%rowtype; v_others int := 0;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into b from public.booking_intents where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if not public.pipeline_transition_allowed('booking', b.status::text, p_new::text) then
    raise exception 'illegal booking transition % -> %', b.status, p_new; end if;
  select * into a from public.aircraft_availability where id = b.availability_id for update;
  select * into q from public.quotes where id = b.quote_id;

  if p_new = 'OPERATOR_CONFIRMED' then
    if a.status <> 'AVAILABLE' or a.expires_at <= now() then raise exception 'availability is no longer available'; end if;
    perform public.set_availability_status(a.id, 'HELD', 'booking ' || b.id);
    update public.booking_intents set confirmed_at = now() where id = p_id;
  elsif p_new = 'BOOKED' then
    if a.status <> 'HELD' then raise exception 'availability must be held by a confirmed booking'; end if;
    perform public.set_availability_status(a.id, 'BOOKED', 'booking ' || b.id);
    update public.booking_intents set booked_at = now() where id = p_id;
    perform public._match_advance(b.match_id, 'BOOKED');
    perform public._learn(b.customer_id, null, b.availability_id, 'BOOKED', 'in_app', jsonb_build_object('booking_intent_id', b.id));
    update public.opportunity_matches set status = 'CANCELLED', updated_at = now()
     where id in (select o.match_id from public.booking_intents o where o.availability_id = b.availability_id and o.id <> b.id
                    and o.status in ('INTENT_CREATED','STAFF_REVIEW')) and status = 'BOOKING_INTENT';
    update public.booking_intents set status = 'CANCELLED', status_reason = 'AVAILABILITY_BOOKED_BY_ANOTHER'
     where availability_id = b.availability_id and id <> b.id and status in ('INTENT_CREATED','STAFF_REVIEW');
    get diagnostics v_others = row_count;
    update public.quotes set status = 'WITHDRAWN' where availability_id = b.availability_id and id <> b.quote_id
       and status in ('BROKER_REVIEW','CLIENT_PRESENTED');
    update public.quote_requests set status = 'CANCELLED', status_reason = 'AVAILABILITY_BOOKED'
     where availability_id = b.availability_id and id <> q.quote_request_id
       and status in ('REQUESTED','OPERATOR_CONTACTED','QUOTE_RECEIVED');
    -- close other customers' matches that were mid-pipeline on this same aircraft
    update public.opportunity_matches set status = 'CANCELLED', updated_at = now()
     where opportunity_id = b.opportunity_id and id is distinct from b.match_id and status in ('INQUIRY','QUOTE');
  elsif p_new = 'FULFILLED' then
    update public.booking_intents set fulfilled_at = now() where id = p_id;
    perform public._match_advance(b.match_id, 'FULFILLED');
  elsif p_new in ('CANCELLED','FAILED') then
    if b.status = 'OPERATOR_CONFIRMED' and a.status = 'HELD' then
      perform public.set_availability_status(a.id, 'CANCELLED', 'booking ' || b.id || ' ' || p_new::text);
    elsif b.status = 'BOOKED' and a.status = 'BOOKED' then
      perform public.set_availability_status(a.id, 'CANCELLED', 'booking ' || b.id || ' cancelled');
      update public.opportunities set status = 'CANCELLED', status_reason = 'BOOKING_CANCELLED' where id = b.opportunity_id and status = 'BOOKED';
    end if;
    update public.opportunity_matches set status = 'CANCELLED', updated_at = now()
     where id = b.match_id and status in ('BOOKING_INTENT','BOOKED');
  end if;
  update public.booking_intents set status = p_new, status_reason = left(p_reason, 200) where id = p_id;
  return jsonb_build_object('status', p_new, 'other_intents_cancelled', v_others);
end $function$;

CREATE OR REPLACE FUNCTION public.set_demand_signal_status(p_id uuid, p_status demand_signal_status, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old public.demand_signal_status;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select status into v_old from public.demand_signals where id = p_id for update;
  if not found then raise exception 'signal not found' using errcode = 'P0002'; end if;
  update public.demand_signals set status = p_status, review_note = coalesce(p_note, review_note),
         reviewed_by = (select auth.uid()), reviewed_at = now() where id = p_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'DEMAND_SIGNAL_STATUS', 'demand_signal', p_id, jsonb_build_object('from', v_old, 'to', p_status, 'note', p_note));
end $function$;

CREATE OR REPLACE FUNCTION public.set_opportunity_status(p_id uuid, p_new opportunity_status, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_new not in ('IGNORED','CANCELLED','REJECTED','WITHDRAWN') then
    raise exception 'forward transitions are performed by the engine only';
  end if;
  update public.opportunities set status = p_new, status_reason = coalesce(p_reason, 'MANUAL_' || p_new::text) where id = p_id;
  if not found then raise exception 'not found'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.staff_mark_operator_contacted(p_id uuid, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.quote_requests set status = 'OPERATOR_CONTACTED', operator_contacted_at = now(),
    contacted_by = (select auth.uid()), status_reason = left(p_note, 200) where id = p_id;
  if not found then raise exception 'not found'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.staff_record_quote(p_quote_request_id uuid, p_operator_price_usd numeric, p_valid_until timestamp with time zone, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public._insert_quote(p_quote_request_id, p_operator_price_usd, p_valid_until, p_note, 'broker_on_behalf', (select auth.uid()));
end $function$;

CREATE OR REPLACE FUNCTION public.start_conversation(p_channel text DEFAULT 'in_app'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'customer' and status = 'active') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  insert into public.conversations(customer_id, channel) values ((select auth.uid()), p_channel) returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_demand_signal(p_grade demand_grade, p_source_kind text, p_source_name text, p_source_url text, p_title text, p_evidence text, p_evidence_date date, p_est_origin text DEFAULT NULL::text, p_est_destination text DEFAULT NULL::text, p_est_event_start date DEFAULT NULL::date, p_est_pax integer DEFAULT NULL::integer, p_demand_confidence text DEFAULT 'LOW'::text, p_recommended_action text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  insert into public.demand_signals(grade, source_kind, source_name, source_url, title, evidence, evidence_date, est_origin, est_destination,
        est_event_start, est_pax, demand_confidence, recommended_action, expires_at, created_by)
  values (p_grade, p_source_kind, p_source_name, p_source_url, p_title, p_evidence, p_evidence_date, upper(p_est_origin), upper(p_est_destination),
        p_est_event_start, p_est_pax, p_demand_confidence, p_recommended_action, p_expires_at, (select auth.uid()))
  returning id into v_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'DEMAND_SIGNAL_SUBMITTED', 'demand_signal', v_id, jsonb_build_object('grade', p_grade, 'source', p_source_name));
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.update_journey_brief(p_id uuid, p_pickup text DEFAULT NULL::text, p_dropoff text DEFAULT NULL::text, p_ground_origin_min integer DEFAULT NULL::integer, p_ground_dest_min integer DEFAULT NULL::integer, p_fbo_origin text DEFAULT NULL::text, p_fbo_dest text DEFAULT NULL::text, p_transport_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.journey_briefs%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into j from public.journey_briefs where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if j.status <> 'DRAFT' then raise exception 'only a draft brief can be edited'; end if;
  update public.journey_briefs set
    pickup_note = coalesce(left(p_pickup,300), pickup_note), dropoff_note = coalesce(left(p_dropoff,300), dropoff_note),
    ground_origin_min_est = coalesce(p_ground_origin_min, ground_origin_min_est),
    ground_dest_min_est = coalesce(p_ground_dest_min, ground_dest_min_est),
    fbo_origin_note = coalesce(left(p_fbo_origin,300), fbo_origin_note), fbo_dest_note = coalesce(left(p_fbo_dest,300), fbo_dest_note),
    transport_note = coalesce(left(p_transport_note,300), transport_note)
  where id = p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.withdraw_journey_brief(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.journey_briefs%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into j from public.journey_briefs where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if j.status = 'WITHDRAWN' then return; end if;
  update public.journey_briefs set status = 'WITHDRAWN', status_reason = left(p_reason,200) where id = p_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'journey_brief_withdrawn', 'journey_brief', p_id, jsonb_build_object('reason', left(p_reason,200)));
end $function$;

CREATE OR REPLACE FUNCTION public.withdraw_quote(p_quote_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.quotes set status = 'WITHDRAWN' where id = p_quote_id;
  if not found then raise exception 'not found'; end if;
end $function$;

-- 7. Triggers (added 2026-10-05 from the live database; the first export missed them)
create trigger trg_audit_availability after insert or update on public.aircraft_availability for each row execute function audit_availability();
create trigger trg_guard_availability before insert or update on public.aircraft_availability for each row execute function guard_availability();
create trigger trg_withdraw_opps after update of status on public.aircraft_availability for each row when (((new.status is distinct from old.status) and (new.status <> 'AVAILABLE'::availability_status))) execute function _withdraw_opps_on_supply_change();
create trigger trg_audit_booking after insert or update on public.booking_intents for each row execute function _audit_pipeline();
create trigger trg_guard_booking before update on public.booking_intents for each row execute function guard_pipeline_status('booking');
create trigger trg_guard_demand_signal before insert or update on public.demand_signals for each row execute function guard_demand_signal();
create trigger journey_briefs_updated_at before update on public.journey_briefs for each row execute function set_updated_at();
create trigger trg_audit_opportunity after insert or update on public.opportunities for each row execute function _audit_opportunity();
create trigger trg_guard_opportunity before update on public.opportunities for each row execute function guard_opportunity();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function set_updated_at();
create trigger trg_audit_qr after insert or update on public.quote_requests for each row execute function _audit_pipeline();
create trigger trg_guard_qr before update on public.quote_requests for each row execute function guard_pipeline_status('qr');
create trigger trg_audit_quote after insert or update on public.quotes for each row execute function _audit_pipeline();
create trigger trg_guard_quote before update on public.quotes for each row execute function guard_pipeline_status('quote');
create trigger trg_audit_request after insert or update on public.travel_requests for each row execute function audit_request();
create trigger trg_request_state before insert or update on public.travel_requests for each row execute function compute_request_state();

-- 8. Views (moved after functions: they call is_staff() / is_active_operator())
create or replace view public.customer_demand_state as  SELECT id AS customer_id,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM travel_requests r
              WHERE ((r.customer_id = p.id) AND (r.status = 'READY'::request_status) AND (r.created_at > (now() - '3 days'::interval))))) THEN 'HOT'::text
            WHEN (EXISTS ( SELECT 1
               FROM travel_requests r
              WHERE ((r.customer_id = p.id) AND (r.status <> 'CANCELLED'::request_status) AND (r.created_at > (now() - '30 days'::interval))))) THEN 'WARM'::text
            WHEN (EXISTS ( SELECT 1
               FROM travel_requests r
              WHERE (r.customer_id = p.id))) THEN 'DORMANT'::text
            ELSE 'NONE'::text
        END AS demand_state
   FROM profiles p
  WHERE (role = 'customer'::app_role);
create or replace view public.operator_market_legs as  SELECT l.id,
    l.icao_type,
    r.category,
    l.origin_airport,
    l.dest_airport,
    l.departed_at,
    l.arrived_at,
    l.status,
    l.confidence
   FROM (aircraft_legs l
     LEFT JOIN ref_icao_types r ON ((r.icao_type = l.icao_type)))
  WHERE (( SELECT is_staff() AS is_staff) OR ( SELECT is_active_operator() AS is_active_operator));
create or replace view public.operator_market_sightings as  SELECT icao_type,
    category,
    round((lat)::numeric, 2) AS lat,
    round((lon)::numeric, 2) AS lon,
    alt_ft,
    gs_kt,
    observed_at,
    source_name,
    nearest_airport,
    nearest_km
   FROM aircraft_sightings s
  WHERE (( SELECT is_staff() AS is_staff) OR ( SELECT is_active_operator() AS is_active_operator));
create or replace view public.opportunity_funnel as  SELECT o.id AS opportunity_id,
    o.origin_code,
    o.destination_code,
    o.status,
    o.trigger_type,
    o.score,
    count(m.id) AS matches,
    count(m.id) FILTER (WHERE (m.gate_decision = 'ALLOWED'::text)) AS gate_allowed,
    count(m.id) FILTER (WHERE (m.activated_at IS NOT NULL)) AS activated,
    count(m.id) FILTER (WHERE ((m.activated_at IS NOT NULL) AND (NOT m.explicit_before))) AS activated_non_explicit,
    count(m.id) FILTER (WHERE (m.status = 'ENGAGED'::text)) AS engaged,
    count(m.id) FILTER (WHERE (m.status = 'INQUIRY'::text)) AS inquiry,
    count(m.id) FILTER (WHERE (m.status = 'QUOTE'::text)) AS quoted,
    count(m.id) FILTER (WHERE (m.status = 'BOOKING_INTENT'::text)) AS booking_intent,
    count(m.id) FILTER (WHERE (m.status = ANY (ARRAY['BOOKED'::text, 'FULFILLED'::text]))) AS booked,
    count(m.id) FILTER (WHERE ((m.status = ANY (ARRAY['BOOKED'::text, 'FULFILLED'::text])) AND (NOT m.explicit_before))) AS booked_non_explicit
   FROM (opportunities o
     LEFT JOIN opportunity_matches m ON ((m.opportunity_id = o.id)))
  GROUP BY o.id;

-- 9. Row Level Security
alter table public.activation_channels enable row level security;
alter table public.aircraft_availability enable row level security;
alter table public.aircraft_fetch_runs enable row level security;
alter table public.aircraft_legs enable row level security;
alter table public.aircraft_models enable row level security;
alter table public.aircraft_sightings enable row level security;
alter table public.airports enable row level security;
alter table public.assistant_proposals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.booking_intents enable row level security;
alter table public.contact_controls enable row level security;
alter table public.conversations enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.customer_trips enable row level security;
alter table public.demand_fetch_runs enable row level security;
alter table public.demand_signals enable row level security;
alter table public.escalations enable row level security;
alter table public.eye_decision_policy enable row level security;
alter table public.journey_briefs enable row level security;
alter table public.learning_events enable row level security;
alter table public.messages enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_matches enable row level security;
alter table public.owner_alerts enable row level security;
alter table public.profiles enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.ref_icao_types enable row level security;
alter table public.route_price_reference enable row level security;
alter table public.travel_requests enable row level security;
alter table public.weather_fetch_runs enable row level security;
alter table public.weather_snapshots enable row level security;

create policy channels_admin_update on public.activation_channels as PERMISSIVE for UPDATE to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy channels_read on public.activation_channels as PERMISSIVE for SELECT to authenticated using (true);
create policy availability_select on public.aircraft_availability as PERMISSIVE for SELECT to authenticated using (((operator_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy availability_insert_operator on public.aircraft_availability as PERMISSIVE for INSERT to authenticated with check (((operator_id = ( SELECT auth.uid() AS uid)) AND ( SELECT is_active_operator() AS is_active_operator) AND (status = 'PENDING_VERIFICATION'::availability_status) AND (source = 'OFFICIAL_OPERATOR'::truth_source)));
create policy availability_insert_staff on public.aircraft_availability as PERMISSIVE for INSERT to authenticated with check ((( SELECT is_staff() AS is_staff) AND (status = 'PENDING_VERIFICATION'::availability_status)));
create policy afr_staff_select on public.aircraft_fetch_runs as PERMISSIVE for SELECT to public using (( SELECT is_staff() AS is_staff));
create policy legs_staff_select on public.aircraft_legs as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy aircraft_models_read on public.aircraft_models as PERMISSIVE for SELECT to authenticated using (true);
create policy as_staff_select on public.aircraft_sightings as PERMISSIVE for SELECT to public using (( SELECT is_staff() AS is_staff));
create policy airports_read on public.airports as PERMISSIVE for SELECT to authenticated using (true);
create policy prop_select on public.assistant_proposals as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = assistant_proposals.conversation_id) AND ((c.customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff))))));
create policy audit_logs_admin_select on public.audit_logs as PERMISSIVE for SELECT to authenticated using (( SELECT is_admin() AS is_admin));
create policy bi_select on public.booking_intents as PERMISSIVE for SELECT to authenticated using (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy cc_update_own on public.contact_controls as PERMISSIVE for UPDATE to authenticated using ((customer_id = ( SELECT auth.uid() AS uid))) with check ((customer_id = ( SELECT auth.uid() AS uid)));
create policy cc_insert_own on public.contact_controls as PERMISSIVE for INSERT to authenticated with check (((customer_id = ( SELECT auth.uid() AS uid)) AND (activations_count = 0) AND (last_contacted_at IS NULL)));
create policy cc_select on public.contact_controls as PERMISSIVE for SELECT to authenticated using (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy conv_select on public.conversations as PERMISSIVE for SELECT to authenticated using (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy pref_all_own on public.customer_preferences as PERMISSIVE for ALL to authenticated using (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff))) with check (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy ct_update_own on public.customer_trips as PERMISSIVE for UPDATE to authenticated using ((customer_id = ( SELECT auth.uid() AS uid))) with check ((customer_id = ( SELECT auth.uid() AS uid)));
create policy ct_select_own on public.customer_trips as PERMISSIVE for SELECT to authenticated using ((customer_id = ( SELECT auth.uid() AS uid)));
create policy ct_insert_own on public.customer_trips as PERMISSIVE for INSERT to authenticated with check ((customer_id = ( SELECT auth.uid() AS uid)));
create policy ct_delete_own on public.customer_trips as PERMISSIVE for DELETE to authenticated using ((customer_id = ( SELECT auth.uid() AS uid)));
create policy dfr_staff_select on public.demand_fetch_runs as PERMISSIVE for SELECT to public using (( SELECT is_staff() AS is_staff));
create policy ds_staff_select on public.demand_signals as PERMISSIVE for SELECT to public using (( SELECT is_staff() AS is_staff));
create policy esc_select on public.escalations as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy eye_policy_admin_write on public.eye_decision_policy as PERMISSIVE for ALL to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy eye_policy_staff_read on public.eye_decision_policy as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy jb_staff_select on public.journey_briefs as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy le_select_staff on public.learning_events as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy msg_select on public.messages as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff))))));
create policy opp_select_staff on public.opportunities as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy oppm_select_staff on public.opportunity_matches as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy profiles_select on public.profiles as PERMISSIVE for SELECT to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin() AS is_admin)));
create policy profiles_update on public.profiles as PERMISSIVE for UPDATE to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));
create policy qr_select on public.quote_requests as PERMISSIVE for SELECT to authenticated using (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy quotes_select on public.quotes as PERMISSIVE for SELECT to authenticated using (((operator_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy rit_staff_select on public.ref_icao_types as PERMISSIVE for SELECT to public using (( SELECT is_staff() AS is_staff));
create policy route_price_reference_read on public.route_price_reference as PERMISSIVE for SELECT to authenticated using (true);
create policy req_update_staff on public.travel_requests as PERMISSIVE for UPDATE to authenticated using (( SELECT is_staff() AS is_staff)) with check (( SELECT is_staff() AS is_staff));
create policy req_insert_own on public.travel_requests as PERMISSIVE for INSERT to authenticated with check ((customer_id = ( SELECT auth.uid() AS uid)));
create policy req_select on public.travel_requests as PERMISSIVE for SELECT to authenticated using (((customer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_staff() AS is_staff)));
create policy wfr_staff_select on public.weather_fetch_runs as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy ws_staff_select on public.weather_snapshots as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));

-- 10. Scheduled jobs (pg_cron)
select cron.schedule('aircraft-refresh', '*/3 * * * *', $cron$select public._fetch_aircraft()$cron$);
select cron.schedule('demand-expire', '45 4 * * *', $cron$select public.expire_stale_demand_signals()$cron$);
select cron.schedule('demand-wikidata-refresh', '30 4 * * *', $cron$select public._fetch_demand_wikidata()$cron$);
select cron.schedule('eye-daily-digest', '0 5 * * *', $cron$select public.eye_notify('digest')$cron$);
select cron.schedule('eye-tick', '2-59/10 * * * *', $cron$select public.eye_tick()$cron$);
select cron.schedule('infer-aircraft-legs', '1-59/3 * * * *', $cron$select public.infer_aircraft_legs()$cron$);
select cron.schedule('supply-expire', '*/5 * * * *', $cron$select public.expire_stale_availability(); select public.expire_stale_opportunities(); select public.expire_stale_quotes();$cron$);
select cron.schedule('weather-refresh', '*/20 * * * *', $cron$select public._fetch_weather()$cron$);


-- 11. Grants (added 2026-10-05; matches live: anon has NO table privileges, access is via RPC + RLS)
-- A new Supabase project grants anon/authenticated broad default privileges, so tighten them here.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- authenticated: keep SELECT/INSERT/UPDATE/DELETE (RLS limits rows); remove privileges RLS cannot cover (applied on live 2026-10-05).
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
