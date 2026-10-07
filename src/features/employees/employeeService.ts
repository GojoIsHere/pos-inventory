import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "../../lib/database";

export interface Employee {
  id: number;

  fullName: string;
  username: string;

  role: "admin" | "cashier";

  isActive: number;

  createdAt: string;
}

export async function getEmployees():
  Promise<Employee[]> {
  const db = await getDatabase();

  const rows =
    await db.select<Employee[]>(
      `
        SELECT
          id,

          full_name
            AS fullName,

          username,

          role,

          is_active
            AS isActive,

          created_at
            AS createdAt

        FROM users

        ORDER BY
          CASE
            WHEN role = 'admin'
            THEN 0
            ELSE 1
          END,

          full_name COLLATE NOCASE;
      `
    );

  return rows.map(
    (row) => ({
      ...row,

      id:
        Number(row.id),

      isActive:
        Number(row.isActive),
    })
  );
}

export async function createCashier(
  fullName: string,
  username: string,
  password: string,
  createdBy: number
): Promise<number> {
  return invoke<number>(
    "create_cashier",
    {
      fullName,
      username,
      password,
      createdBy,
    }
  );
}

export async function setCashierActive(
  cashierId: number,
  isActive: boolean,
  updatedBy: number
): Promise<void> {
  await invoke(
    "set_cashier_active",
    {
      cashierId,
      isActive,
      updatedBy,
    }
  );
}