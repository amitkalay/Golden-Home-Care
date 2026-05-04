import { neon } from "@neondatabase/serverless";

type ServiceProviderLead = {
  name: string;
  email: string;
  phone: string;
  serviceArea: string;
  hourlyRate: string;
  servicesOffered: string[];
  servicesOfferedOther: string;
  seniorCareExperience: string;
  availability: string;
  backgroundCheckWilling: boolean | null;
  notes: string;
};

let sqlClient: ReturnType<typeof neon> | null = null;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Connect Neon through the Vercel Marketplace and pull environment variables.",
    );
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}

async function ensureServiceProviderLeadsTable() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS service_provider_leads (
      id bigint generated always as identity primary key,
      created_at timestamptz not null default now(),
      name text not null,
      email text not null,
      phone text,
      service_area text not null,
      hourly_rate text not null,
      services_offered jsonb not null,
      services_offered_other text,
      senior_care_experience text not null,
      availability text not null,
      background_check_willing boolean not null,
      notes text,
      source text not null default 'become_a_provider',
      status text not null default 'new'
    )
  `;
}

export async function insertServiceProviderLead(lead: ServiceProviderLead) {
  const sql = getSql();

  await ensureServiceProviderLeadsTable();
  await sql`
    INSERT INTO service_provider_leads (
      name,
      email,
      phone,
      service_area,
      hourly_rate,
      services_offered,
      services_offered_other,
      senior_care_experience,
      availability,
      background_check_willing,
      notes
    )
    VALUES (
      ${lead.name},
      ${lead.email},
      ${lead.phone || null},
      ${lead.serviceArea},
      ${lead.hourlyRate},
      ${JSON.stringify(lead.servicesOffered)}::jsonb,
      ${lead.servicesOfferedOther || null},
      ${lead.seniorCareExperience},
      ${lead.availability},
      ${lead.backgroundCheckWilling},
      ${lead.notes || null}
    )
  `;
}
