import { neon, Pool } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;
let poolClient: Pool | null = null;
let authTablesReady: Promise<void> | null = null;
let providerTablesReady: Promise<void> | null = null;
let serviceRequestTablesReady: Promise<void> | null = null;
let notificationTablesReady: Promise<void> | null = null;
let messagingTablesReady: Promise<void> | null = null;

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

export async function ensureNotificationTables() {
  if (!notificationTablesReady) {
    notificationTablesReady = createNotificationTables();
  }

  return notificationTablesReady;
}

export async function ensureMessagingTables() {
  if (!messagingTablesReady) {
    messagingTablesReady = createMessagingTables();
  }

  return messagingTablesReady;
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
      constraint service_requests_status_check check (status in ('submitted', 'confirmed', 'completed', 'canceled')),
      constraint service_requests_time_check check (window_start_time < window_end_time),
      constraint service_requests_duration_check check (duration_minutes in (30, 60, 90, 120, 180, 240))
    )
  `;

  await sql`ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_status_check`;
  await sql`
    ALTER TABLE service_requests
    ADD CONSTRAINT service_requests_status_check check (
      status in ('submitted', 'confirmed', 'completed', 'canceled')
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
    CREATE TABLE IF NOT EXISTS service_bookings (
      id bigint generated always as identity primary key,
      service_request_id bigint not null references service_requests(id) on delete cascade,
      provider_profile_id bigint not null references provider_profiles(id) on delete cascade,
      request_provider_match_id bigint references request_provider_matches(id) on delete set null,
      booking_date date not null,
      start_time time not null,
      end_time time not null,
      status text not null default 'confirmed',
      canceled_at timestamptz,
      canceled_by_user_id text references users(id) on delete set null,
      cancellation_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(service_request_id),
      constraint service_bookings_status_check check (status in ('confirmed', 'completed', 'canceled')),
      constraint service_bookings_time_check check (start_time < end_time)
    )
  `;

  await sql`ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS request_provider_match_id bigint references request_provider_matches(id) on delete set null`;
  await sql`ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS canceled_at timestamptz`;
  await sql`ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS canceled_by_user_id text references users(id) on delete set null`;
  await sql`ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS cancellation_reason text`;

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

  await sql`
    CREATE INDEX IF NOT EXISTS service_bookings_provider_time_idx
    ON service_bookings(provider_profile_id, booking_date, start_time, end_time, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS service_bookings_request_idx
    ON service_bookings(service_request_id)
  `;
}

async function createNotificationTables() {
  const sql = getSql();

  await ensureServiceRequestTables();

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id bigint generated always as identity primary key,
      recipient_user_id text not null references users(id) on delete cascade,
      type text not null,
      title text not null,
      body text not null,
      href text,
      read_at timestamptz,
      service_request_id bigint references service_requests(id) on delete cascade,
      request_provider_match_id bigint references request_provider_matches(id) on delete set null,
      service_booking_id bigint references service_bookings(id) on delete set null,
      dedupe_key text not null unique,
      email_status text not null default 'not_applicable',
      email_to text,
      email_subject text,
      email_error text,
      email_sent_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint notifications_email_status_check check (
        email_status in ('not_applicable', 'pending', 'sent', 'failed', 'skipped')
      )
    )
  `;

  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS href text`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS service_request_id bigint references service_requests(id) on delete cascade`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS request_provider_match_id bigint references request_provider_matches(id) on delete set null`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS service_booking_id bigint references service_bookings(id) on delete set null`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_status text not null default 'not_applicable'`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_to text`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_subject text`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_error text`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at timestamptz`;
  await sql`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_email_status_check`;
  await sql`
    ALTER TABLE notifications
    ADD CONSTRAINT notifications_email_status_check check (
      email_status in ('not_applicable', 'pending', 'sent', 'failed', 'skipped')
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
    ON notifications(recipient_user_id, created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
    ON notifications(recipient_user_id, read_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS notifications_request_idx
    ON notifications(service_request_id)
  `;
}

async function createMessagingTables() {
  const sql = getSql();

  await ensureServiceRequestTables();

  await sql`
    CREATE TABLE IF NOT EXISTS message_threads (
      id bigint generated always as identity primary key,
      service_request_id bigint not null references service_requests(id) on delete cascade,
      request_provider_match_id bigint not null unique references request_provider_matches(id) on delete cascade,
      requester_user_id text not null references users(id) on delete cascade,
      provider_user_id text not null references users(id) on delete cascade,
      requester_read_at timestamptz,
      provider_read_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS requester_read_at timestamptz`;
  await sql`ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS provider_read_at timestamptz`;
  await sql`ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now()`;
  await sql`ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now()`;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id bigint generated always as identity primary key,
      message_thread_id bigint not null references message_threads(id) on delete cascade,
      sender_user_id text not null references users(id) on delete cascade,
      body text not null,
      created_at timestamptz not null default now(),
      constraint messages_body_check check (length(btrim(body)) > 0 and char_length(body) <= 1000)
    )
  `;

  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now()`;
  await sql`ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_check`;
  await sql`
    ALTER TABLE messages
    ADD CONSTRAINT messages_body_check check (length(btrim(body)) > 0 and char_length(body) <= 1000)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_threads_requester_idx
    ON message_threads(requester_user_id, updated_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_threads_provider_idx
    ON message_threads(provider_user_id, updated_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_threads_request_idx
    ON message_threads(service_request_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS messages_thread_created_idx
    ON messages(message_thread_id, created_at ASC, id ASC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS messages_sender_idx
    ON messages(sender_user_id)
  `;
}
