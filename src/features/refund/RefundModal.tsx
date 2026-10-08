import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AuthUser,
} from "../../types/auth";

import {
  getAppSettings,
} from "../settings/settingsService";

import {
  calculateRefundAmount,
  completeRefund,
  getRefundPreview,
  type CompleteRefundResult,
  type RefundMethod,
  type RefundPreview,
} from "./refundService";

import "./refund.css";

interface RefundModalProps {
  saleItemId: number;

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

export default function RefundModal({
  saleItemId,
  user,
  onClose,
}: RefundModalProps) {
  const [
    preview,
    setPreview,
  ] = useState<
    RefundPreview | null
  >(null);

  const [
    quantity,
    setQuantity,
  ] = useState("1");

  const [
    method,
    setMethod,
  ] = useState<
    RefundMethod
  >("cash");

  const [
    reference,
    setReference,
  ] = useState("");

  const [
    reason,
    setReason,
  ] = useState("");

  const [
    requireQrReference,
    setRequireQrReference,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    completed,
    setCompleted,
  ] = useState<
    CompleteRefundResult | null
  >(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          refundPreview,
          settings,
        ] = await Promise.all([
          getRefundPreview(
            saleItemId
          ),

          getAppSettings(),
        ]);

        setPreview(
          refundPreview
        );

        setRequireQrReference(
          settings
            .requireQrReference
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

    load();
  }, [saleItemId]);

  const parsedQuantity =
    Number(quantity);

  const calculated =
    useMemo(
      () => {
        if (
          !preview
          ||
          !Number.isInteger(
            parsedQuantity
          )
          ||
          parsedQuantity <= 0
        ) {
          return null;
        }

        return calculateRefundAmount(
          preview,
          parsedQuantity
        );
      },
      [
        preview,
        parsedQuantity,
      ]
    );

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !preview
      || !calculated
    ) {
      return;
    }

    setError("");

    try {
      if (
        parsedQuantity >
        preview.refundableQuantity
      ) {
        throw new Error(
          `Only ${preview.refundableQuantity} unit(s) remain refundable.`
        );
      }

      if (
        method === "qr"
        &&
        requireQrReference
        &&
        !reference.trim()
      ) {
        throw new Error(
          "QR refund reference is required."
        );
      }

      setSaving(true);

      const result =
        await completeRefund({
          originalSaleItemId:
            preview.saleItemId,

          quantity:
            parsedQuantity,

          refundMethod:
            method,

          refundReference:
            method === "qr"
              ? reference.trim()
                  || null
              : null,

          reason:
            reason.trim(),

          processedBy:
            user.id,
        });

      setCompleted(
        result
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="refund-overlay">
      <section className="refund-modal">
        {completed ? (
          <div className="refund-complete">
            <div className="refund-success-icon">
              ✓
            </div>

            <p className="page-eyebrow">
              REFUND COMPLETE
            </p>

            <h2>
              Return processed
            </h2>

            <span>
              {
                completed.originalReceiptNumber
              }
            </span>

            <div className="refund-complete-summary">
              <div>
                <span>
                  Returned Item
                </span>

                <strong>
                  {
                    completed.productName
                  }
                </strong>

                <small>
                  {
                    completed.sku
                  }

                  {completed.color
                    ? ` • ${completed.color}`
                    : ""}

                  {completed.size
                    ? ` • ${completed.size}`
                    : ""}

                  {" × "}
                  {
                    completed.quantity
                  }
                </small>
              </div>

              <div>
                <span>
                  Refund Amount
                </span>

                <strong>
                  {formatMoney(
                    completed
                      .refundAmountPaisa
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Method
                </span>

                <strong>
                  {completed.refundMethod.toUpperCase()}
                </strong>
              </div>
            </div>

            <button
              className="refund-confirm"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="refund-header">
              <div>
                <p className="page-eyebrow">
                  RETURN / REFUND
                </p>

                <h2>
                  Refund Item
                </h2>
              </div>

              <button
                className="refund-close"
                onClick={onClose}
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="refund-loading">
                Loading refund...
              </div>
            ) : preview ? (
              <form
                onSubmit={
                  handleSubmit
                }
              >
                <div className="refund-original">
                  <span>
                    Returning
                  </span>

                  <strong>
                    {
                      preview.productName
                    }
                  </strong>

                  <small>
                    {preview.sku}

                    {preview.color
                      ? ` • ${preview.color}`
                      : ""}

                    {preview.size
                      ? ` • ${preview.size}`
                      : ""}
                  </small>

                  <div>
                    Purchased

                    <strong>
                      {
                        preview.originalQuantity
                      }
                    </strong>
                  </div>

                  <div>
                    Already refunded

                    <strong>
                      {
                        preview.alreadyRefunded
                      }
                    </strong>
                  </div>

                  <div>
                    Already exchanged

                    <strong>
                      {
                        preview.alreadyExchanged
                      }
                    </strong>
                  </div>

                  <div>
                    Refundable

                    <strong>
                      {
                        preview.refundableQuantity
                      }
                    </strong>
                  </div>
                </div>

                {preview.refundableQuantity <=
                0 ? (
                  <div className="refund-warning">
                    No units from this
                    sale item remain
                    refundable.
                  </div>
                ) : (
                  <>
                    <div className="refund-field">
                      <label>
                        Quantity
                      </label>

                      <input
                        type="number"
                        min="1"
                        max={
                          preview.refundableQuantity
                        }
                        step="1"
                        value={
                          quantity
                        }
                        onChange={(
                          event
                        ) =>
                          setQuantity(
                            event.target.value
                          )
                        }
                      />
                    </div>

                    {calculated && (
                      <div className="refund-calculation">
                        <div>
                          <span>
                            Item value
                          </span>

                          <strong>
                            {formatMoney(
                              calculated.grossPaisa
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Original discount
                          </span>

                          <strong>
                            −{" "}
                            {formatMoney(
                              calculated.discountPaisa
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Tax returned
                          </span>

                          <strong>
                            +{" "}
                            {formatMoney(
                              calculated.taxPaisa
                            )}
                          </strong>
                        </div>

                        <div className="refund-total">
                          <span>
                            Customer Refund
                          </span>

                          <strong>
                            {formatMoney(
                              calculated.refundPaisa
                            )}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="refund-payment-methods">
                      <button
                        type="button"
                        className={
                          method ===
                          "cash"
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setMethod(
                            "cash"
                          )
                        }
                      >
                        Cash
                      </button>

                      <button
                        type="button"
                        className={
                          method ===
                          "qr"
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setMethod(
                            "qr"
                          )
                        }
                      >
                        QR
                      </button>
                    </div>

                    {method ===
                      "qr" && (
                      <div className="refund-field">
                        <label>
                          Refund Reference
                          {!requireQrReference &&
                            " (optional)"}
                        </label>

                        <input
                          value={
                            reference
                          }
                          onChange={(
                            event
                          ) =>
                            setReference(
                              event.target.value
                            )
                          }
                          placeholder="Bank / wallet reference"
                        />
                      </div>
                    )}

                    <div className="refund-field">
                      <label>
                        Reason
                      </label>

                      <textarea
                        rows={3}
                        value={
                          reason
                        }
                        onChange={(
                          event
                        ) =>
                          setReason(
                            event.target.value
                          )
                        }
                        placeholder="Wrong size, changed mind, damaged item..."
                      />
                    </div>

                    {error && (
                      <div className="sales-alert error">
                        {error}
                      </div>
                    )}

                    <div className="refund-actions">
                      <button
                        type="button"
                        className="refund-cancel"
                        onClick={
                          onClose
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="refund-confirm"
                        disabled={
                          saving
                        }
                      >
                        {saving
                          ? "Processing..."
                          : "Confirm Refund"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : (
              <div className="sales-alert error">
                {error}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}