import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getDatabase,
} from "../../lib/database";

import type {
  UserRole,
} from "../../types/auth";


export interface Employee {
  id: number;

  fullName: string;

  username: string;

  role: UserRole;

  isActive: boolean;

  createdAt: string;
}


export async function getEmployees():
  Promise<Employee[]> {
  const db =
    await getDatabase();

  const rows =
    await db.select<
      {
        id: number;

        fullName: string;

        username: string;

        role: UserRole;

        isActive: number;

        createdAt: string;
      }[]
    >(
      `
        SELECT
          id,

          full_name
            AS fullName,

          username,

          access_role
            AS role,

          is_active
            AS isActive,

          created_at
            AS createdAt

        FROM users

        ORDER BY
          CASE access_role
            WHEN 'admin'
              THEN 1

            WHEN 'supervisor'
              THEN 2

            WHEN 'salesperson'
              THEN 3

            WHEN 'cashier'
              THEN 4

            ELSE 5
          END,

          full_name
            COLLATE NOCASE;
      `
    );

  return rows.map(
    (row) => ({
      ...row,

      id:
        Number(row.id),

      isActive:
        Boolean(row.isActive),
    })
  );
}


export async function createEmployee(
  input: {
    fullName: string;

    username: string;

    password: string;

    accessRole:
      | "supervisor"
      | "salesperson"
      | "cashier";

    createdBy: number;
  }
): Promise<void> {
  await invoke(
    "create_employee",
    {
      fullName:
        input.fullName,

      username:
        input.username,

      password:
        input.password,

      accessRole:
        input.accessRole,

      createdBy:
        input.createdBy,
    }
  );
}


export async function setEmployeeActive(
  employeeId: number,
  isActive: boolean,
  updatedBy: number
): Promise<void> {
  /*
   * We're temporarily calling the old
   * Rust command name. We will rename
   * it later when we clean up.
   */
  await invoke(
    "set_cashier_active",
    {
      cashierId:
        employeeId,

      isActive,

      updatedBy,
    }
  );
}