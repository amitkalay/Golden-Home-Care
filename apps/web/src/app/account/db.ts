import { ensureAuthTables, getSql } from "../lib/database";

export type UserAccountRecord = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  bio: string | null;
  role: "user" | "provider";
  createdAt: Date | null;
  updatedAt: Date | null;
};

type UserAccountInput = {
  name: string;
  bio: string;
};

function toAccountRecord(row: Record<string, unknown>): UserAccountRecord {
  const role = row.role === "provider" ? "provider" : "user";

  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    image: (row.image as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    role,
    createdAt: (row.createdAt as Date | null) ?? null,
    updatedAt: (row.updatedAt as Date | null) ?? null,
  };
}

export async function getUserAccount(userId: string) {
  const sql = getSql();

  await ensureAuthTables();
  const rows = await sql`
    SELECT
      id,
      name,
      email,
      image,
      bio,
      role,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM users
    WHERE id = ${userId}
  `;

  const records = rows as Array<Record<string, unknown>>;
  return records[0] ? toAccountRecord(records[0]) : null;
}

export async function updateUserAccount(userId: string, input: UserAccountInput, imageUrl: string | null) {
  const sql = getSql();

  await ensureAuthTables();
  await sql`
    UPDATE users
    SET
      name = ${input.name},
      bio = ${input.bio || null},
      image = COALESCE(${imageUrl}, image),
      updated_at = now()
    WHERE id = ${userId}
  `;
}

export async function deleteUserAccount(userId: string) {
  const sql = getSql();

  await ensureAuthTables();
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
