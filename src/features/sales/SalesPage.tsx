import {
  useEffect,
  useState,
} from "react";

import {
  getSales,
  type SaleSummary,
} from "./salesService";

import SaleDetailsModal from "./SaleDetailsModal";

import "./sales.css";

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

  return date.toLocaleString();
}

export default function SalesPage() {
  const [
    sales,
    setSales,
  ] = useState<SaleSummary[]>(
    []
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedSaleId,
    setSelectedSaleId,
  ] = useState<number | null>(
    null
  );

  useEffect(() => {
    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setError("");

            const results =
              await getSales(
                search,
                paymentMethod,
                status
              );

            setSales(results);
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
        },
        150
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    search,
    paymentMethod,
    status,
  ]);

  return (
    <>
      <section className="sales-page">
        <div className="sales-heading">
          <div>
            <p className="page-eyebrow">
              TRANSACTIONS
            </p>

            <h2>
              Sales History
            </h2>

            <p>
              Review completed sales,
              receipts and payments.
            </p>
          </div>

          <div className="sales-count">
            <strong>
              {sales.length}
            </strong>

            <span>
              transactions
            </span>
          </div>
        </div>

        <div className="sales-filters">
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search receipt or cashier..."
          />

          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(
                event.target.value
              )
            }
          >
            <option value="">
              All payments
            </option>

            <option value="cash">
              Cash
            </option>

            <option value="qr">
              QR
            </option>
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
          >
            <option value="">
              All statuses
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="voided">
              Voided
            </option>

            <option value="refunded">
              Refunded
            </option>

            <option value="partially_refunded">
              Partial Refund
            </option>
          </select>
        </div>

        {error && (
          <div className="sales-alert error">
            {error}
          </div>
        )}

        <div className="sales-table-card">
          {loading ? (
            <div className="sales-empty">
              Loading sales...
            </div>
          ) : sales.length === 0 ? (
            <div className="sales-empty">
              <strong>
                No sales found
              </strong>

              <p>
                Completed POS
                transactions will appear
                here.
              </p>
            </div>
          ) : (
            <div className="sales-table-wrapper">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>
                      Receipt
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Cashier
                    </th>

                    <th>
                      Payment
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map(
                    (sale) => (
                      <tr
                        key={sale.id}
                        onClick={() =>
                          setSelectedSaleId(
                            sale.id
                          )
                        }
                      >
                        <td>
                          <button className="receipt-link">
                            {
                              sale.receiptNumber
                            }
                          </button>
                        </td>

                        <td>
                          {formatDateTime(
                            sale.createdAt
                          )}
                        </td>

                        <td>
                          <div className="sales-cashier-cell">
                            <strong>
                              {
                                sale.cashierName
                              }
                            </strong>

                            <span>
                              @
                              {
                                sale.cashierUsername
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          {sale.paymentMethod ? (
                            <span
                              className={`payment-badge ${sale.paymentMethod}`}
                            >
                              {sale.paymentMethod.toUpperCase()}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <span
                            className={`sale-status ${sale.status}`}
                          >
                            {
                              sale.status
                            }
                          </span>
                        </td>

                        <td>
                          <strong className="sales-total">
                            {formatMoney(
                              sale.totalPaisa
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
        </div>
      </section>

      {selectedSaleId && (
        <SaleDetailsModal
          saleId={
            selectedSaleId
          }
          onClose={() =>
            setSelectedSaleId(
              null
            )
          }
        />
      )}
    </>
  );
}