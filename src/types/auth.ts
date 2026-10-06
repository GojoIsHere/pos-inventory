export type UserRole = "admin" | "cashier";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}