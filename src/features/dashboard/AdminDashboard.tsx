import type { AuthUser } from "../../types/auth";
import type { AppPage } from "../../types/navigation";

interface AdminDashboardProps {
  user: AuthUser;
  onNavigate: (page: AppPage) => void;
}

export default function AdminDashboard({
  user,
  onNavigate,
}: AdminDashboardProps) {
  return (
    <section className="dashboard-page">
      <div className="dashboard-welcome">
        <div>
          <p className="page-eyebrow">
            OVERVIEW
          </p>

          <h2>
            Welcome back, {user.fullName}
          </h2>

          <p>
            Manage your store, inventory and sales
            from one place.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <button
          className="dashboard-module-card"
          onClick={() => onNavigate("pos")}
        >
          <span className="module-number">
            01
          </span>

          <h3>Point of Sale</h3>

          <p>
            Start a sale, scan products and process
            cash or QR payments.
          </p>

          <span className="module-link">
            Open POS →
          </span>
        </button>

        <button
          className="dashboard-module-card"
          onClick={() =>
            onNavigate("products")
          }
        >
          <span className="module-number">
            02
          </span>

          <h3>Products</h3>

          <p>
            Manage clothing products, variants,
            sizes, colors and barcodes.
          </p>

          <span className="module-link">
            Manage products →
          </span>
        </button>

        <button
          className="dashboard-module-card"
          onClick={() =>
            onNavigate("inventory")
          }
        >
          <span className="module-number">
            03
          </span>

          <h3>Inventory</h3>

          <p>
            Track stock quantities, adjustments
            and inventory movements.
          </p>

          <span className="module-link">
            View inventory →
          </span>
        </button>

        <button
          className="dashboard-module-card"
          onClick={() =>
            onNavigate("sales")
          }
        >
          <span className="module-number">
            04
          </span>

          <h3>Sales</h3>

          <p>
            Review completed transactions,
            receipts and payment records.
          </p>

          <span className="module-link">
            View sales →
          </span>
        </button>
      </div>

      <div className="dashboard-status">
        <div>
          <span className="status-dot" />

          <div>
            <strong>
              Project S is ready
            </strong>

            <p>
              Local database and authentication are
              running normally.
            </p>
          </div>
        </div>

        <span className="status-role">
          {user.role}
        </span>
      </div>
    </section>
  );
}