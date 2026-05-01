import { neon } from "@neondatabase/serverless";

type FamilyLead = {
  name: string;
  email: string;
  phone: string;
  zipCode: string;
  relationship: string;
  helpNeeded: string[];
  frequency: string;
  neededTimeline: string;
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

async function ensureFamilyLeadsTable() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS family_leads (
      id bigint generated always as identity primary key,
      created_at timestamptz not null default now(),
      name text not null,
      email text not null,
      phone text not null,
      zip_code varchar(10),
      relationship text not null,
      help_needed jsonb not null,
      frequency text not null,
      needed_timeline text not null,
      notes text,
      source text not null default 'find_care_near_me',
      status text not null default 'new'
    )
  `;
}

export async function insertFamilyLead(lead: FamilyLead) {
  const sql = getSql();

  await ensureFamilyLeadsTable();
  await sql`
    INSERT INTO family_leads (
      name,
      email,
      phone,
      zip_code,
      relationship,
      help_needed,
      frequency,
      needed_timeline,
      notes
    )
    VALUES (
      ${lead.name},
      ${lead.email},
      ${lead.phone},
      ${lead.zipCode || null},
      ${lead.relationship},
      ${JSON.stringify(lead.helpNeeded)}::jsonb,
      ${lead.frequency},
      ${lead.neededTimeline},
      ${lead.notes || null}
    )
  `;
}
