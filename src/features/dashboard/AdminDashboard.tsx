import {
  useEffect,
  useState,
} from "react";

import type {
  AuthUser,
} from "../../types/auth";

import type {
  AppPage,
} from "../../types/navigation";

import {
  getDashboardData,
  type DashboardData,
} from "./dashboardService";

import "./dashboard.css";

interface AdminDashboardProps {
  user: AuthUser;

  onNavigate:
    (page: AppPage) => void;
}

function formatMoney(
  paisa: number
): string {
  return `Rs. ${(
    paisa / 100
  ).toLocaleString(
    "en-NP",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDateTime(
  value: string
): string {
  const isoValue =
    value.includes("T")
      ? value
      : `${value.replace(
          " ",
          "T"
        )}Z`;

  const date =
    new Date(isoValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

export default function AdminDashboard({
  user,
  onNavigate,
}: AdminDashboardProps) {
  const [
    data,
    setData,
  ] = useState<
    DashboardData | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function loadDashboard(
    isRefresh = false
  ) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const result =
        await getDashboardData();

      setData(result);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <section className="real-dashboard">
        <div className="dashboard-loading">
          Loading dashboard...
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="real-dashboard">
        <div className="dashboard-error">
          {error ||
            "Dashboard data could not be loaded."}
        </div>
      </section>
    );
  }

  const {
    metrics,
    recentSales,
    lowStock,
    topProducts,
  } = data;

  return (
    <section className="real-dashboard">
      <div className="real-dashboard-header">
        <div>
          <p className="page-eyebrow">
            OVERVIEW
          </p>

          <h2>
            Welcome back,{" "}
            {user.fullName}
          </h2>

          <p>
            Here's what's happening
            in your store today.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <button
            className="dashboard-refresh"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={
              refreshing
            }
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            className="dashboard-new-sale"
            onClick={() =>
              onNavigate("pos")
            }
          >
            + New Sale
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      <div className="dashboard-kpis">
        <div className="dashboard-kpi primary">
          <span>
            Today's Net Sales
          </span>

          <strong>
            {formatMoney(
              metrics.netSalesPaisa
            )}
          </strong>

          <small>
            Sales + exchanges − refunds
          </small>
        </div>

        <div className="dashboard-kpi">
          <span>
            Transactions
          </span>

          <strong>
            {
              metrics.todayTransactions
            }
          </strong>

          <small>
            Sales completed today
          </small>
        </div>

        <div className="dashboard-kpi">
          <span>
            Units Sold
          </span>

          <strong>
            {
              metrics.todayUnitsSold
            }
          </strong>

          <small>
            Items sold today
          </small>
        </div>

        <div className="dashboard-kpi">
          <span>
            Average Sale
          </span>

          <strong>
            {formatMoney(
              metrics.averageSalePaisa
            )}
          </strong>

          <small>
            Average transaction
          </small>
        </div>
      </div>

      <div className="dashboard-accounting-summary">
        <div>
          <span>
            Gross Sales
          </span>

          <strong>
            {formatMoney(
              metrics.grossSalesPaisa
            )}
          </strong>
        </div>

        <div>
          <span>
            Exchange Upsells
          </span>

          <strong>
            +{" "}
            {formatMoney(
              metrics.exchangeRevenuePaisa
            )}
          </strong>
        </div>

        <div className="refund">
          <span>
            Refunds
          </span>

          <strong>
            −{" "}
            {formatMoney(
              metrics.refundPaisa
            )}
          </strong>
        </div>
      </div>

      <div className="dashboard-secondary-stats">
        <button
          onClick={() =>
            onNavigate("products")
          }
        >
          <div>
            <span>
              Active Products
            </span>

            <strong>
              {
                metrics.activeProducts
              }
            </strong>
          </div>

          <span>View products →</span>
        </button>

        <button
          className={
            metrics.lowStockVariants >
            0
              ? "warning"
              : ""
          }
          onClick={() =>
            onNavigate("products")
          }
        >
          <div>
            <span>
              Low Stock
            </span>

            <strong>
              {
                metrics.lowStockVariants
              }
            </strong>
          </div>

          <span>
            Review inventory →
          </span>
        </button>
      </div>

      <div className="dashboard-main-grid">
        {/* RECENT SALES */}

        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="page-eyebrow">
                ACTIVITY
              </p>

              <h3>
                Recent Sales
              </h3>
            </div>

            <button
              onClick={() =>
                onNavigate("sales")
              }
            >
              View all
            </button>
          </div>

          {recentSales.length ===
          0 ? (
            <div className="dashboard-empty">
              No sales yet.
            </div>
          ) : (
            <div className="dashboard-sales-list">
              {recentSales.map(
                (sale) => (
                  <button
                    className="dashboard-sale-row"
                    key={sale.id}
                    onClick={() =>
                      onNavigate(
                        "sales"
                      )
                    }
                  >
                    <div className="dashboard-sale-main">
                      <strong>
                        {
                          sale.receiptNumber
                        }
                      </strong>

                      <span>
                        {
                          sale.cashierName
                        }
                        {" • "}
                        {formatDateTime(
                          sale.createdAt
                        )}
                      </span>
                    </div>

                    <div className="dashboard-sale-right">
                      {sale.paymentMethod && (
                        <span
                          className={`dashboard-payment ${sale.paymentMethod}`}
                        >
                          {sale.paymentMethod.toUpperCase()}
                        </span>
                      )}

                      <strong>
                        {formatMoney(
                          sale.totalPaisa
                        )}
                      </strong>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </section>

        {/* LOW STOCK */}

        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="page-eyebrow">
                INVENTORY
              </p>

              <h3>
                Low Stock
              </h3>
            </div>

            <button
              onClick={() =>
                onNavigate(
                  "products"
                )
              }
            >
              Manage
            </button>
          </div>

          {lowStock.length ===
          0 ? (
            <div className="dashboard-empty healthy">
              Inventory levels look
              healthy.
            </div>
          ) : (
            <div className="dashboard-stock-list">
              {lowStock.map(
                (item) => (
                  <div
                    className="dashboard-stock-row"
                    key={
                      item.variantId
                    }
                  >
                    <div>
                      <strong>
                        {
                          item.productName
                        }
                      </strong>

                      <span>
                        {item.sku}

                        {item.color
                          ? ` • ${item.color}`
                          : ""}

                        {item.size
                          ? ` • ${item.size}`
                          : ""}
                      </span>
                    </div>

                    <div className="dashboard-stock-number">
                      <strong>
                        {
                          item.quantityOnHand
                        }
                      </strong>

                      <span>
                        reorder at{" "}
                        {
                          item.reorderLevel
                        }
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>

      {/* TOP SELLERS */}

      <section className="dashboard-panel dashboard-top-products">
        <div className="dashboard-panel-heading">
          <div>
            <p className="page-eyebrow">
              LAST 30 DAYS
            </p>

            <h3>
              Top Selling Products
            </h3>
          </div>

          <button
            onClick={() =>
              onNavigate("sales")
            }
          >
            View sales
          </button>
        </div>

        {topProducts.length ===
        0 ? (
          <div className="dashboard-empty">
            Sales data will appear
            here after transactions
            are completed.
          </div>
        ) : (
          <div className="top-products-list">
            {topProducts.map(
              (
                product,
                index
              ) => (
                <div
                  className="top-product-row"
                  key={
                    product.productId
                  }
                >
                  <span className="top-product-rank">
                    {index + 1}
                  </span>

                  <div className="top-product-name">
                    <strong>
                      {
                        product.productName
                      }
                    </strong>

                    <span>
                      {
                        product.unitsSold
                      }{" "}
                      unit
                      {product.unitsSold ===
                      1
                        ? ""
                        : "s"}{" "}
                      sold
                    </span>
                  </div>

                  <strong className="top-product-revenue">
                    {formatMoney(
                      product.revenuePaisa
                    )}
                  </strong>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </section>
  );
}