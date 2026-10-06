import Database from "@tauri-apps/plugin-sql";

let databasePromise: Promise<Database> | null = null;

export function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load("sqlite:pos_inventory.db");
  }

  return databasePromise;
}