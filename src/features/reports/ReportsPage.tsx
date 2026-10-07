import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getReports,
  type ReportsData,
} from "./reportsService";

import "./reports.css";

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

function localDateString(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function daysAgo(
  days: number
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() -
      days
  );

  return localDateString(
    date
  );
}

function currentMonthStart():
  string {
  const now =
    new Date();

  return localDateString(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    )
  );
}

function formatReportDate(
  value: string
): string {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );
}

export default function ReportsPage() {
  const today =
    localDateString(
      new Date()
    );

  const [
    startDate,
    setStartDate,
  ] = useState(
    daysAgo(29)
  );

  const [
    endDate,
    setEndDate,
  ] = useState(today);

  const [
    data,
    setData,
  ] = useState<
    ReportsData | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      if (
        startDate >
        endDate
      ) {
        throw new Error(
          "Start date cannot be after end date."
        );
      }

      const result =
        await getReports(
          startDate,
          endDate
        );

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
    }
  }

  useEffect(() => {
    loadReports();
  }, [
    startDate,
    endDate,
  ]);

  function setLastDays(
    days: number
  ) {
    setStartDate(
      daysAgo(
        days - 1
      )
    );

    setEndDate(today);
  }

  const maxDailyRevenue =
    useMemo(
      () =>
        Math.max(
          ...(
            data?.dailySales.map(
              (day) =>
                day.revenuePaisa
            ) ?? [0]
          ),
          1
        ),
      [data]
    );

  const paymentTotal =
    useMemo(
      () =>
        data?.paymentBreakdown
          .reduce(
            (
              total,
              payment
            ) =>
              total +
              payment.amountPaisa,
            0
          ) ?? 0,
      [data]
    );

  return (
    <section className="reports-page">
      <div className="reports-heading">
        <div>
          <p className="page-eyebrow">
            ANALYTICS
          </p>

          <h2>
            Reports
          </h2>

          <p>
            Track sales,
            payments, products and
            cashier performance.
          </p>
        </div>

        <button
          className="reports-refresh"
          onClick={
            loadReports
          }
          disabled={loading}
        >
          {loading
            ? "Loading..."
            : "Refresh"}
        </button>
      </div>

      <div className="reports-range-card">
        <div className="reports-quick-ranges">
          <button
            onClick={() =>
              setLastDays(7)
            }
          >
            Last 7 Days
          </button>

          <button
            onClick={() =>
              setLastDays(30)
            }
          >
            Last 30 Days
          </button>

          <button
            onClick={() => {
              setStartDate(
                currentMonthStart()
              );

              setEndDate(
                today
              );
            }}
          >
            This Month
          </button>

          <button
            onClick={() => {
              setStartDate(
                today
              );

              setEndDate(
                today
              );
            }}
          >
            Today
          </button>
        </div>

        <div className="reports-date-fields">
          <div>
            <label>
              From
            </label>

            <input
              type="date"
              value={
                startDate
              }
              max={
                endDate
              }
              onChange={(
                event
              ) =>
                setStartDate(
                  event.target
                    .value
                )
              }
            />
          </div>

          <span>
            →
          </span>

          <div>
            <label>
              To
            </label>

            <input
              type="date"
              value={
                endDate
              }
              min={
                startDate
              }
              max={
                today
              }
              onChange={(
                event
              ) =>
                setEndDate(
                  event.target
                    .value
                )
              }
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="reports-alert">
          {error}
        </div>
      )}

      {loading &&
      !data ? (
        <div className="reports-loading">
          Loading reports...
        </div>
      ) : data ? (
        <>
          <div className="reports-kpis">
            <div className="report-kpi primary">
              <span>
                Revenue
              </span>

              <strong>
                {formatMoney(
                  data.metrics
                    .revenuePaisa
                )}
              </strong>

              <small>
                Completed sales
              </small>
            </div>

            <div className="report-kpi">
              <span>
                Transactions
              </span>

              <strong>
                {
                  data.metrics
                    .transactions
                }
              </strong>

              <small>
                Completed orders
              </small>
            </div>

            <div className="report-kpi">
              <span>
                Units Sold
              </span>

              <strong>
                {
                  data.metrics
                    .unitsSold
                }
              </strong>

              <small>
                Products sold
              </small>
            </div>

            <div className="report-kpi">
              <span>
                Average Sale
              </span>

              <strong>
                {formatMoney(
                  data.metrics
                    .averageSalePaisa
                )}
              </strong>

              <small>
                Per transaction
              </small>
            </div>
          </div>

          <div className="reports-financial-kpis">
            <div>
              <span>
                Discounts Given
              </span>

              <strong>
                {formatMoney(
                  data.metrics
                    .discountPaisa
                )}
              </strong>
            </div>

            <div>
              <span>
                Tax Collected
              </span>

              <strong>
                {formatMoney(
                  data.metrics
                    .taxPaisa
                )}
              </strong>
            </div>

            <div className="profit">
              <span>
                Estimated Gross Profit
              </span>

              <strong>
                {formatMoney(
                  data.metrics
                    .estimatedGrossProfitPaisa
                )}
              </strong>

              <small>
                Based on current
                product cost prices
              </small>
            </div>
          </div>

          <div className="reports-main-grid">
            {/* DAILY SALES */}

            <section className="report-panel">
              <div className="report-panel-heading">
                <div>
                  <p className="page-eyebrow">
                    SALES TREND
                  </p>

                  <h3>
                    Daily Revenue
                  </h3>
                </div>

                <span>
                  {formatReportDate(
                    startDate
                  )}
                  {" – "}
                  {formatReportDate(
                    endDate
                  )}
                </span>
              </div>

              {data.dailySales
                .length ===
              0 ? (
                <div className="report-empty">
                  No sales in this
                  period.
                </div>
              ) : (
                <div className="daily-sales-chart">
                  {data.dailySales.map(
                    (day) => {
                      const width =
                        Math.max(
                          3,
                          (
                            day.revenuePaisa /
                            maxDailyRevenue
                          ) * 100
                        );

                      return (
                        <div
                          className="daily-sales-row"
                          key={
                            day.saleDate
                          }
                        >
                          <span className="daily-date">
                            {formatReportDate(
                              day.saleDate
                            )}
                          </span>

                          <div className="daily-bar-track">
                            <div
                              className="daily-bar"
                              style={{
                                width:
                                  `${width}%`,
                              }}
                            />
                          </div>

                          <div className="daily-value">
                            <strong>
                              {formatMoney(
                                day.revenuePaisa
                              )}
                            </strong>

                            <span>
                              {
                                day.transactions
                              }{" "}
                              sale
                              {day.transactions ===
                              1
                                ? ""
                                : "s"}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>

            {/* PAYMENT BREAKDOWN */}

            <section className="report-panel">
              <div className="report-panel-heading">
                <div>
                  <p className="page-eyebrow">
                    PAYMENTS
                  </p>

                  <h3>
                    Payment Split
                  </h3>
                </div>
              </div>

              {data
                .paymentBreakdown
                .length === 0 ? (
                <div className="report-empty">
                  No payment data.
                </div>
              ) : (
                <div className="payment-report-list">
                  {data.paymentBreakdown.map(
                    (payment) => {
                      const percent =
                        paymentTotal >
                        0
                          ? Math.round(
                              (
                                payment.amountPaisa /
                                paymentTotal
                              ) *
                                100
                            )
                          : 0;

                      return (
                        <div
                          className="payment-report-row"
                          key={
                            payment.method
                          }
                        >
                          <div className="payment-report-top">
                            <div>
                              <span
                                className={`report-payment-badge ${payment.method}`}
                              >
                                {payment.method.toUpperCase()}
                              </span>

                              <span>
                                {
                                  payment.transactions
                                }{" "}
                                transactions
                              </span>
                            </div>

                            <strong>
                              {formatMoney(
                                payment.amountPaisa
                              )}
                            </strong>
                          </div>

                          <div className="payment-percent-track">
                            <div
                              style={{
                                width:
                                  `${percent}%`,
                              }}
                            />
                          </div>

                          <small>
                            {percent}% of
                            payments
                          </small>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </div>

          {/* TOP PRODUCTS */}

          <section className="report-panel report-table-panel">
            <div className="report-panel-heading">
              <div>
                <p className="page-eyebrow">
                  PRODUCTS
                </p>

                <h3>
                  Top Selling Products
                </h3>
              </div>

              <span>
                Top 10
              </span>
            </div>

            {data.topProducts
              .length === 0 ? (
              <div className="report-empty">
                No product sales in
                this period.
              </div>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>
                        Rank
                      </th>

                      <th>
                        Product
                      </th>

                      <th>
                        Units Sold
                      </th>

                      <th>
                        Gross Item Sales
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.topProducts.map(
                      (
                        product,
                        index
                      ) => (
                        <tr
                          key={
                            product.productId
                          }
                        >
                          <td>
                            <span className="report-rank">
                              {index +
                                1}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {
                                product.productName
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              product.unitsSold
                            }
                          </td>

                          <td>
                            <strong>
                              {formatMoney(
                                product.revenuePaisa
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* CASHIER PERFORMANCE */}

          <section className="report-panel report-table-panel">
            <div className="report-panel-heading">
              <div>
                <p className="page-eyebrow">
                  TEAM
                </p>

                <h3>
                  Cashier Performance
                </h3>
              </div>
            </div>

            {data
              .cashierPerformance
              .length === 0 ? (
              <div className="report-empty">
                No cashier activity in
                this period.
              </div>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>
                        Cashier
                      </th>

                      <th>
                        Transactions
                      </th>

                      <th>
                        Units Sold
                      </th>

                      <th>
                        Revenue
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.cashierPerformance.map(
                      (cashier) => (
                        <tr
                          key={
                            cashier.cashierId
                          }
                        >
                          <td>
                            <div className="report-cashier">
                              <strong>
                                {
                                  cashier.cashierName
                                }
                              </strong>

                              <span>
                                @
                                {
                                  cashier.username
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            {
                              cashier.transactions
                            }
                          </td>

                          <td>
                            {
                              cashier.unitsSold
                            }
                          </td>

                          <td>
                            <strong>
                              {formatMoney(
                                cashier.revenuePaisa
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}