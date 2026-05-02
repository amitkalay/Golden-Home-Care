import { neon } from "@neondatabase/serverless";

type FamilyLead = {
  name: string;
  email: string;
  phone: string;
  zipCode: string;
  relationship: string;
  helpNeeded: string[];
  helpNeededOther: string;
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
      phone text,
      zip_code varchar(10),
      relationship text not null,
      help_needed jsonb not null,
      help_needed_other text,
      frequency text not null,
      needed_timeline text not null,
      notes text,
      source text not null default 'find_care_near_me',
      status text not null default 'new'
    )
  `;

  await sql`ALTER TABLE family_leads ALTER COLUMN phone DROP NOT NULL`;
  await sql`ALTER TABLE family_leads ADD COLUMN IF NOT EXISTS help_needed_other text`;
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
      help_needed_other,
      frequency,
      needed_timeline,
      notes
    )
    VALUES (
      ${lead.name},
      ${lead.email},
      ${lead.phone || null},
      ${lead.zipCode || null},
      ${lead.relationship},
      ${JSON.stringify(lead.helpNeeded)}::jsonb,
      ${lead.helpNeededOther || null},
      ${lead.frequency},
      ${lead.neededTimeline},
      ${lead.notes || null}
    )
  `;
}
