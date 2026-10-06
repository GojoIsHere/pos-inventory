import { useState } from "react";

import type { AuthUser } from "../types/auth";
import type { AppPage } from "../types/navigation";

import AdminDashboard from "../features/dashboard/AdminDashboard";
import PlaceholderPage from "../components/PlaceholderPage";

import "./app-shell.css";

interface AppShellProps {
  user: AuthUser;
  onLogout: () => void;
}

interface NavigationItem {
  key: AppPage;
  label: string;
  adminOnly?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    adminOnly: true,
  },
  {
    key: "pos",
    label: "Point of Sale",
  },
  {
    key: "products",
    label: "Products",
    adminOnly: true,
  },
  {
    key: "inventory",
    label: "Inventory",
    adminOnly: true,
  },
  {
    key: "sales",
    label: "Sales",
  },
  {
    key: "reports",
    label: "Reports",
    adminOnly: true,
  },
  {
    key: "employees",
    label: "Employees",
    adminOnly: true,
  },
  {
    key: "settings",
    label: "Settings",
    adminOnly: true,
  },
];

const pageTitles: Record<AppPage, string> = {
  dashboard: "Dashboard",
  pos: "Point of Sale",
  products: "Products",
  inventory: "Inventory",
  sales: "Sales",
  reports: "Reports",
  employees: "Employees",
  settings: "Settings",
};

export default function AppShell({
  user,
  onLogout,
}: AppShellProps) {
  const [activePage, setActivePage] =
    useState<AppPage>(
      user.role === "admin"
        ? "dashboard"
        : "pos"
    );

  const allowedNavigation =
    navigationItems.filter(
      (item) =>
        !item.adminOnly ||
        user.role === "admin"
    );

  function renderPage() {
    switch (activePage) {
      case "dashboard":
        return (
          <AdminDashboard
            user={user}
            onNavigate={setActivePage}
          />
        );

      case "pos":
        return (
          <PlaceholderPage
            title="Point of Sale"
            description="This will become the cashier workspace for scanning products, building carts and completing sales."
          />
        );

      case "products":
        return (
          <PlaceholderPage
            title="Products"
            description="Products, categories, clothing variants, SKUs and barcodes will live here."
          />
        );

      case "inventory":
        return (
          <PlaceholderPage
            title="Inventory"
            description="Stock levels, restocking, adjustments and inventory movement history will live here."
          />
        );

      case "sales":
        return (
          <PlaceholderPage
            title="Sales"
            description="Completed sales, receipts, payment records and transaction details will live here."
          />
        );

      case "reports":
        return (
          <PlaceholderPage
            title="Reports"
            description="Store performance, sales summaries and inventory reports will live here."
          />
        );

      case "employees":
        return (
          <PlaceholderPage
            title="Employees"
            description="Administrator and cashier accounts will be managed here."
          />
        );

      case "settings":
        return (
          <PlaceholderPage
            title="Settings"
            description="Store information, tax configuration and application settings will live here."
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            S
          </div>

          <div>
            <strong>Project S</strong>
            <span>Store Management</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">
            MENU
          </span>

          {allowedNavigation.map(
            (item) => (
              <button
                key={item.key}
                className={`nav-item ${
                  activePage === item.key
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setActivePage(item.key)
                }
              >
                <span className="nav-indicator" />

                {item.label}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {user.fullName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="sidebar-user-info">
              <strong>
                {user.fullName}
              </strong>

              <span>{user.role}</span>
            </div>
          </div>

          <button
            className="logout-button"
            onClick={onLogout}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="topbar-eyebrow">
              PROJECT S
            </p>

            <h1>
              {pageTitles[activePage]}
            </h1>
          </div>

          <div className="topbar-user">
            <span className="role-badge">
              {user.role}
            </span>

            <div>
              <strong>
                {user.fullName}
              </strong>

              <span>
                @{user.username}
              </span>
            </div>
          </div>
        </header>

        <main className="app-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}