import {
  useEffect,
  useState,
} from "react";

import {
  getSaleDetails,
  type SaleDetails,
} from "./salesService";

import {
  getAppSettings,
  type AppSettings,
} from "../settings/settingsService";

import ExchangeModal from "../exchanges/ExchangeModal";

import type {
  AuthUser,
} from "../../types/auth";

import RefundModal from "../refund/RefundModal";

interface SaleDetailsModalProps {
  saleId: number;

  user: AuthUser;

  onClose: () => void;
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
  /*
   * SQLite CURRENT_TIMESTAMP
   * is UTC.
   */
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

export default function SaleDetailsModal({
  saleId,
  user,
  onClose,
}: SaleDetailsModalProps) {
  const [
    sale,
    setSale,
  ] = useState<SaleDetails | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    settings,
    setSettings,
  ] = useState<
    AppSettings | null
  >(null);

  const [
    exchangeSaleItemId,
    setExchangeSaleItemId,
  ] = useState<
    number | null
  >(null);

  const [
    refundSaleItemId,
    setRefundSaleItemId,
  ] = useState<
    number | null
  >(null);

  const [
    reloadKey,
    setReloadKey,
  ] = useState(0);

  useEffect(() => {
    async function loadSale() {
      try {
        setLoading(true);
        setError("");

        const [
          result,
          appSettings,
        ] = await Promise.all([
          getSaleDetails(
            saleId
          ),

          getAppSettings(),
        ]);

        setSale(result);

        setSettings(
          appSettings
        );
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

    loadSale();
  }, [saleId,reloadKey,]);

  return (
    <>
      <div className="sale-modal-overlay">
      <section className="sale-details-modal">
        <div className="sale-modal-header">
          <div>
            <p className="page-eyebrow">
              RECEIPT
            </p>

            <h2>
              Sale Details
            </h2>
          </div>

          <button
            className="sale-modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="sale-modal-loading">
            Loading receipt...
          </div>
        )}

        {error && (
          <div className="sales-alert error">
            {error}
          </div>
        )}

        {sale && (
          <>
            <div className="receipt-heading">
              <div>
                <strong>
                  {settings?.storeName ??
                    "Project S"}
                </strong>

                {settings?.storeAddress && (
                  <span>
                    {settings.storeAddress}
                  </span>
                )}

                {settings?.storePhone && (
                  <span>
                    {settings.storePhone}
                  </span>
                )}
              </div>

              <span
                className={`sale-status ${sale.status}`}
              >
                {sale.status}
              </span>
            </div>

            <div className="receipt-number-box">
              <span>
                Receipt Number
              </span>

              <strong>
                {sale.receiptNumber}
              </strong>
            </div>

            <div className="receipt-meta">
              <div>
                <span>Date</span>

                <strong>
                  {formatDateTime(
                    sale.createdAt
                  )}
                </strong>
              </div>

              <div>
                <span>Cashier</span>

                <strong>
                  {sale.cashierName}
                </strong>

                <small>
                  @{sale.cashierUsername}
                </small>
              </div>

              <div>
                <span>
                  Payment
                </span>

                <strong>
                  {sale.paymentMethod
                    ? sale.paymentMethod.toUpperCase()
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="receipt-items">
              <div className="receipt-items-header">
                <span>Item</span>
                <span>Qty</span>
                <span>Amount</span>
              </div>

              {sale.items.map(
                (item) => (
                  <div
                    className="receipt-item"
                    key={item.id}
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

                      <small>
                        {formatMoney(
                          item.unitPricePaisa
                        )}{" "}
                        each
                      </small>
                      {(
                        sale.status ===
                          "completed"
                        ||
                        sale.status ===
                          "partially_refunded"
                      ) && (
                        <div className="receipt-item-actions">
                          <button
                            type="button"
                            className="receipt-exchange-button"
                            onClick={() =>
                              setExchangeSaleItemId(
                                item.id
                              )
                            }
                          >
                            Exchange
                          </button>

                          <button
                            type="button"
                            className="receipt-refund-button"
                            onClick={() =>
                              setRefundSaleItemId(
                                item.id
                              )
                            }
                          >
                            Return / Refund
                          </button>
                        </div>
                      )}
                    </div>

                    <span>
                      {item.quantity}
                    </span>

                    <strong>
                      {formatMoney(
                        item.lineTotalPaisa
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>

            <div className="receipt-totals">
              <div>
                <span>
                  Subtotal
                </span>

                <strong>
                  {formatMoney(
                    sale.subtotalPaisa
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Discount
                </span>

                <strong>
                  −{" "}
                  {formatMoney(
                    sale.discountPaisa
                  )}
                </strong>
              </div>

              <div>
                <span>Tax</span>

                <strong>
                  {formatMoney(
                    sale.taxPaisa
                  )}
                </strong>
              </div>

              <div className="receipt-grand-total">
                <span>Total</span>

                <strong>
                  {formatMoney(
                    sale.totalPaisa
                  )}
                </strong>
              </div>
            </div>

            {sale.paymentMethod ===
              "cash" && (
              <div className="receipt-payment-details">
                <div>
                  <span>
                    Cash received
                  </span>

                  <strong>
                    {formatMoney(
                      sale.cashReceivedPaisa ??
                        sale.totalPaisa
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Change
                  </span>

                  <strong>
                    {formatMoney(
                      sale.changePaisa ??
                        0
                    )}
                  </strong>
                </div>
              </div>
            )}

            {sale.paymentMethod ===
              "qr" && (
              <div className="receipt-payment-details">
                <div>
                  <span>
                    QR Reference
                  </span>

                  <strong>
                    {sale.paymentReference ||
                      "No reference entered"}
                  </strong>
                </div>
              </div>
            )}

            <div className="receipt-footer">
              <p>
                {settings?.receiptFooter ||
                  "Thank you for your purchase."}
              </p>

              <span>
                {settings?.storeName ||
                  "Project S"}
              </span>
            </div>

            <button
              className="sale-close-button"
              onClick={onClose}
            >
              Close Receipt
            </button>
          </>
        )}
      </section>
    </div>
    {exchangeSaleItemId !==
      null && (
      <ExchangeModal
        saleItemId={
          exchangeSaleItemId
        }
        user={user}
        onClose={() => {
          setExchangeSaleItemId(
            null
          );

          setReloadKey(
            (current) =>
              current + 1
          );
        }}
      />
    )}
    {refundSaleItemId !==
      null && (
      <RefundModal
        saleItemId={
          refundSaleItemId
        }

        user={user}

        onClose={() => {
          setRefundSaleItemId(
            null
          );

          setReloadKey(
            (current) =>
              current + 1
          );
        }}
      />
    )}
    </>
  );
}