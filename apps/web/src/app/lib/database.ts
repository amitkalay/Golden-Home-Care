import { neon, Pool } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;
let poolClient: Pool | null = null;
let authTablesReady: Promise<void> | null = null;
let providerTablesReady: Promise<void> | null = null;
let serviceRequestTablesReady: Promise<void> | null = null;

export function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Connect Neon through the Vercel Marketplace and pull environment variables.",
    );
  }

  return databaseUrl;
}

export function getSql() {
  if (!sqlClient) {
    sqlClient = neon(getDatabaseUrl());
  }

  return sqlClient;
}

export function getPool() {
  if (!poolClient) {
    poolClient = new Pool({ connectionString: getDatabaseUrl() });
  }

  return poolClient;
}

export async function ensureAuthTables() {
  if (!authTablesReady) {
    authTablesReady = createAuthTables();
  }

  return authTablesReady;
}

async function createAuthTables() {
  const sql = getSql();

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id text primary key default gen_random_uuid()::text,
      name text,
      email text unique,
      "emailVerified" timestamptz,
      image text,
      bio text,
      role text not null default 'user',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text not null default 'user'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now()`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now()`;
  await sql`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'`;

  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id text primary key default gen_random_uuid()::text,
      "userId" text not null references users(id) on delete cascade,
      type text not null,
      provider text not null,
      "providerAccountId" text not null,
      refresh_token text,
      access_token text,
      expires_at bigint,
      id_token text,
      scope text,
      session_state text,
      token_type text,
      unique(provider, "providerAccountId")
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id text primary key default gen_random_uuid()::text,
      "sessionToken" text not null unique,
      "userId" text not null references users(id) on delete cascade,
      expires timestamptz not null
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS verification_token (
      identifier text not null,
      token text not null,
      expires timestamptz not null,
      primary key (identifier, token)
    )
  `;
}

export async function ensureProviderTables() {
  if (!providerTablesReady) {
    providerTablesReady = createProviderTables();
  }

  return providerTablesReady;
}

export async function ensureServiceRequestTables() {
  if (!serviceRequestTablesReady) {
    serviceRequestTablesReady = createServiceRequestTables();
  }

  return serviceRequestTablesReady;
}

async function createProviderTables() {
  const sql = getSql();

  await ensureAuthTables();

  await sql`
    CREATE TABLE IF NOT EXISTS provider_profiles (
      id bigint generated always as identity primary key,
      user_id text not null unique references users(id) on delete cascade,
      display_name text,
      photo_url text,
      contact_email text,
      phone text,
      zip_code varchar(10),
      latitude double precision,
      longitude double precision,
      service_radius_miles integer,
      hourly_rate_cents integer,
      bio text,
      experience_summary text,
      languages text[] not null default '{}',
      availability_summary text,
      availability_timezone text not null default 'America/Los_Angeles',
      on_demand_available boolean not null default false,
      minimum_notice_minutes integer not null default 120,
      transportation_available boolean not null default false,
      background_check_willing boolean not null default false,
      status text not null default 'draft',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint provider_profiles_status_check check (
        status in ('draft', 'submitted', 'approved', 'active', 'paused', 'rejected')
      )
    )
  `;

  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS phone text`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS contact_email text`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS latitude double precision`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS longitude double precision`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS languages text[] not null default '{}'`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS availability_timezone text not null default 'America/Los_Angeles'`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS on_demand_available boolean not null default false`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS minimum_notice_minutes integer not null default 120`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now()`;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_services (
      id bigint generated always as identity primary key,
      provider_profile_id bigint not null references provider_profiles(id) on delete cascade,
      service_type text not null,
      unique(provider_profile_id, service_type)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS provider_availability_windows (
      id bigint generated always as identity primary key,
      provider_profile_id bigint not null references provider_profiles(id) on delete cascade,
      day_of_week integer not null,
      start_time time not null,
      end_time time not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(provider_profile_id, day_of_week),
      constraint provider_availability_windows_day_check check (day_of_week between 0 and 6),
      constraint provider_availability_windows_time_check check (start_time < end_time)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS provider_profiles_status_idx
    ON provider_profiles(status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS provider_services_service_type_idx
    ON provider_services(service_type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS provider_availability_windows_profile_idx
    ON provider_availability_windows(provider_profile_id)
  `;
}

async function createServiceRequestTables() {
  const sql = getSql();

  await ensureProviderTables();

  await sql`
    CREATE TABLE IF NOT EXISTS service_requests (
      id bigint generated always as identity primary key,
      requester_user_id text not null references users(id) on delete cascade,
      provider_profile_id bigint references provider_profiles(id) on delete set null,
      match_preference text not null default 'any',
      service_type text not null,
      zip_code varchar(10) not null,
      latitude double precision,
      longitude double precision,
      requested_date date not null,
      window_start_time time not null,
      window_end_time time not null,
      duration_minutes integer not null,
      urgency text not null default 'soon',
      notes text,
      contact_name text not null,
      contact_email text not null,
      contact_phone text not null,
      status text not null default 'submitted',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint service_requests_match_preference_check check (match_preference in ('any', 'specific')),
      constraint service_requests_urgency_check check (urgency in ('urgent', 'soon', 'flexible')),
      constraint service_requests_status_check check (status in ('submitted')),
      constraint service_requests_time_check check (window_start_time < window_end_time),
      constraint service_requests_duration_check check (duration_minutes in (30, 60, 90, 120, 180, 240))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS request_provider_matches (
      id bigint generated always as identity primary key,
      service_request_id bigint not null references service_requests(id) on delete cascade,
      provider_profile_id bigint not null references provider_profiles(id) on delete cascade,
      status text not null default 'pending',
      match_source text not null,
      distance_miles double precision,
      proposed_date date,
      proposed_start_time time,
      proposed_end_time time,
      provider_response_note text,
      responded_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(service_request_id, provider_profile_id),
      constraint request_provider_matches_status_check check (
        status in ('pending', 'proposed', 'accepted', 'declined', 'expired')
      ),
      constraint request_provider_matches_source_check check (
        match_source in ('weekly', 'on_demand')
      )
    )
  `;

  await sql`ALTER TABLE request_provider_matches ADD COLUMN IF NOT EXISTS proposed_date date`;
  await sql`ALTER TABLE request_provider_matches ADD COLUMN IF NOT EXISTS proposed_start_time time`;
  await sql`ALTER TABLE request_provider_matches ADD COLUMN IF NOT EXISTS proposed_end_time time`;
  await sql`ALTER TABLE request_provider_matches ADD COLUMN IF NOT EXISTS provider_response_note text`;
  await sql`ALTER TABLE request_provider_matches ADD COLUMN IF NOT EXISTS responded_at timestamptz`;
  await sql`ALTER TABLE request_provider_matches DROP CONSTRAINT IF EXISTS request_provider_matches_status_check`;
  await sql`
    ALTER TABLE request_provider_matches
    ADD CONSTRAINT request_provider_matches_status_check check (
      status in ('pending', 'proposed', 'accepted', 'declined', 'expired')
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS service_requests_requester_idx
    ON service_requests(requester_user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS service_requests_provider_idx
    ON service_requests(provider_profile_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS service_requests_status_idx
    ON service_requests(status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS request_provider_matches_request_idx
    ON request_provider_matches(service_request_id, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS request_provider_matches_provider_idx
    ON request_provider_matches(provider_profile_id, status)
  `;
}
