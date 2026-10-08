import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "../../lib/database";
import type { AuthUser, UserRole } from "../../types/auth";

interface AdminCountRow {
  count: number;
}
interface UserRecord {
  id: number;
  username: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: number;
}

export async function login(
  username: string,
  password: string
): Promise<AuthUser> {
  const cleanUsername = username
    .trim()
    .toLowerCase();

  if (!cleanUsername || !password) {
    throw new Error(
      "Username and password are required."
    );
  }

  const db = await getDatabase();

  const users = await db.select<UserRecord[]>(
    `
      SELECT
        id,
        username,
        password_hash AS passwordHash,
        full_name AS fullName,
        access_role AS role,
        is_active AS isActive
      FROM users
      WHERE username = $1
      LIMIT 1;
    `,
    [cleanUsername]
  );

  const user = users[0];

  if (!user) {
    throw new Error(
      "Invalid username or password."
    );
  }

  if (user.isActive !== 1) {
    throw new Error(
      "This account has been disabled."
    );
  }

  const passwordMatches =
    await invoke<boolean>("verify_password", {
      password,
      passwordHash: user.passwordHash,
    });

  if (!passwordMatches) {
    throw new Error(
      "Invalid username or password."
    );
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
  };
}

export interface CreateAdminInput {
  fullName: string;
  username: string;
  password: string;
}

export async function hasAdmin(): Promise<boolean> {
  const db = await getDatabase();

  const rows = await db.select<AdminCountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'admin'
        AND is_active = 1;
    `
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function createFirstAdmin({
  fullName,
  username,
  password,
}: CreateAdminInput): Promise<void> {
  const cleanFullName = fullName.trim();
  const cleanUsername = username.trim().toLowerCase();

  if (!cleanFullName) {
    throw new Error("Full name is required.");
  }

  if (cleanUsername.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const adminAlreadyExists = await hasAdmin();

  if (adminAlreadyExists) {
    throw new Error("An administrator account already exists.");
  }

  const passwordHash = await invoke<string>("hash_password", {
    password,
  });

  const db = await getDatabase();

  await db.execute(
    `
      INSERT INTO users (
        username,
        password_hash,
        full_name,
        role,
        access_role,
        is_active
      )
      VALUES ($1, $2, $3, 'admin','admin', 1);
    `,
    [
      cleanUsername,
      passwordHash,
      cleanFullName,
    ]
  );
}