import { neon, Pool } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;
let poolClient: Pool | null = null;
let authTablesReady: Promise<void> | null = null;
let providerTablesReady: Promise<void> | null = null;

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
      role text not null default 'provider',
      created_at timestamptz not null default now()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role text not null default 'provider'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now()`;

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

async function createProviderTables() {
  const sql = getSql();

  await ensureAuthTables();

  await sql`
    CREATE TABLE IF NOT EXISTS provider_profiles (
      id bigint generated always as identity primary key,
      user_id text not null unique references users(id) on delete cascade,
      display_name text,
      photo_url text,
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
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS latitude double precision`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS longitude double precision`;
  await sql`ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS languages text[] not null default '{}'`;
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
    CREATE INDEX IF NOT EXISTS provider_profiles_status_idx
    ON provider_profiles(status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS provider_services_service_type_idx
    ON provider_services(service_type)
  `;
}

