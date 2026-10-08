export type UserRole =
  | "admin"
  | "supervisor"
  | "salesperson"
  | "cashier";

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
}