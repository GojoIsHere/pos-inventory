import { useState } from "react";


import type { AppPage } from "../types/navigation";

import AdminDashboard from "../features/dashboard/AdminDashboard";


import "./app-shell.css";

import ProductsPage from "../features/products/ProductsPage";
import PosPage from "../features/pos/PosPage";

import SalesPage from "../features/sales/SalesPage";

import EmployeesPage from "../features/employees/EmployeesPage";

import InventoryPage from "../features/inventory/InventoryPage";

import SettingsPage from "../features/settings/SettingsPage";

import ReportsPage from "../features/reports/ReportsPage";

import type { AuthUser, UserRole, } from "../types/auth";

interface AppShellProps {
  user: AuthUser;
  onLogout: () => void;
}

interface NavigationItem {
  key: AppPage;
  label: string;
}

const navigationItems: NavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
  },
  {
    key: "pos",
    label: "Point of Sale",
  },
  {
    key: "products",
    label: "Products",
  },
  {
    key: "inventory",
    label: "Inventory",
  },
  {
    key: "sales",
    label: "Sales",
  },
  {
    key: "reports",
    label: "Reports",
  },
  {
    key: "employees",
    label: "Employees",
  },
  {
    key: "settings",
    label: "Settings",
  },
];

const allowedPagesByRole: Record<
  UserRole,
  AppPage[]
> = {
  admin: [
    "dashboard",
    "pos",
    "products",
    "inventory",
    "sales",
    "reports",
    "employees",
    "settings",
  ],

  supervisor: [
    "dashboard",
    "pos",
    "products",
    "inventory",
    "sales",
    "reports",
  ],

  salesperson: [
    "pos",
    "sales",
  ],

  cashier: [
    "pos",
    "sales",
  ],
};

function getDefaultPage(
  role: UserRole
): AppPage {
  if (
    role === "admin"
    ||
    role === "supervisor"
  ) {
    return "dashboard";
  }

  return "pos";
}

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
      getDefaultPage(
        user.role
      )
    );

  const allowedPages =
    allowedPagesByRole[
      user.role
    ];

  const allowedNavigation =
    navigationItems.filter(
      (item) =>
        allowedPages.includes(
          item.key
        )
    );

  function renderPage() {
    if (
      !allowedPages.includes(
        activePage
      )
    ) {
      return null;
    }
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
          <PosPage
            user={user}
            />
        );

      case "products":
        return (
            <ProductsPage
            user={user}
            />
        );

      case "inventory":
        return (
          <InventoryPage
            user={user}
            />
        );

      case "sales":
      return (
        <SalesPage
          user={user}
        />
      );

      case "reports":
        return (
          <ReportsPage />
        );

      case "employees":
        return (
            <EmployeesPage
                user={user}
            />
        );

      case "settings":
        return (
          <SettingsPage
            user={user}
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