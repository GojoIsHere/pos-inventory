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
  completeExchange,
  getExchangePreview,
  type CompleteExchangeResult,
  type ExchangePaymentMethod,
  type ExchangePreview,
} from "./exchangeService";

import "./exchange.css";

interface ExchangeModalProps {
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

function moneyToPaisa(
  value: string
): number | null {
  const clean =
    value.trim();

  if (!clean) {
    return null;
  }

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      clean
    )
  ) {
    return null;
  }

  const [
    whole,
    decimal = "",
  ] = clean.split(".");

  return (
    Number(whole) * 100 +
    Number(
      decimal.padEnd(
        2,
        "0"
      )
    )
  );
}

export default function ExchangeModal({
  saleItemId,
  user,
  onClose,
}: ExchangeModalProps) {
  const [
    preview,
    setPreview,
  ] = useState<
    ExchangePreview | null
  >(null);

  const [
    replacementId,
    setReplacementId,
  ] = useState<
    number | null
  >(null);

  const [
    quantity,
    setQuantity,
  ] = useState("1");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<
    ExchangePaymentMethod
  >("cash");

  const [
    cashReceived,
    setCashReceived,
  ] = useState("");

  const [
    reference,
    setReference,
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
    CompleteExchangeResult | null
  >(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [
          exchangePreview,
          settings,
        ] = await Promise.all([
          getExchangePreview(
            saleItemId
          ),

          getAppSettings(),
        ]);

        setPreview(
          exchangePreview
        );

        setRequireQrReference(
          settings
            .requireQrReference
        );

        const firstAvailable =
          exchangePreview
            .replacements
            .find(
              (item) =>
                item.quantityOnHand >
                0
            );

        if (firstAvailable) {
          setReplacementId(
            firstAvailable.variantId
          );
        }
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

  const selectedReplacement =
    useMemo(
      () =>
        preview
          ?.replacements
          .find(
            (item) =>
              item.variantId ===
              replacementId
          ) ?? null,
      [
        preview,
        replacementId,
      ]
    );

  const parsedQuantity =
    Number(quantity);

  const priceDifference =
    preview
    && selectedReplacement
    && Number.isInteger(
      parsedQuantity
    )
      ? (
          selectedReplacement
            .sellingPricePaisa
          -
          preview.original
            .unitPricePaisa
        ) *
        parsedQuantity
      : 0;

  const cashReceivedPaisa =
    moneyToPaisa(
      cashReceived
    );

  const changePaisa =
    priceDifference > 0
    && paymentMethod ===
      "cash"
    && cashReceivedPaisa !==
      null
      ? Math.max(
          cashReceivedPaisa -
            priceDifference,
          0
        )
      : 0;

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !preview
      || !selectedReplacement
    ) {
      return;
    }

    setError("");

    try {
      if (
        !Number.isInteger(
          parsedQuantity
        )
        || parsedQuantity <= 0
      ) {
        throw new Error(
          "Enter a valid exchange quantity."
        );
      }

      if (
        parsedQuantity >
        preview.original
          .remainingQuantity
      ) {
        throw new Error(
          `Only ${preview.original.remainingQuantity} unit(s) remain exchangeable.`
        );
      }

      if (
        parsedQuantity >
        selectedReplacement
          .quantityOnHand
      ) {
        throw new Error(
          "Not enough replacement stock."
        );
      }

      if (
        priceDifference < 0
      ) {
        throw new Error(
          "This replacement costs less than the original item. Refund support is required for this exchange."
        );
      }

      let finalCash:
        number | null =
        null;

      if (
        priceDifference > 0
        &&
        paymentMethod ===
          "cash"
      ) {
        if (
          cashReceivedPaisa ===
          null
        ) {
          throw new Error(
            "Enter the cash received."
          );
        }

        if (
          cashReceivedPaisa <
          priceDifference
        ) {
          throw new Error(
            "Cash received is less than the amount due."
          );
        }

        finalCash =
          cashReceivedPaisa;
      }

      if (
        priceDifference > 0
        &&
        paymentMethod ===
          "qr"
        &&
        requireQrReference
        &&
        !reference.trim()
      ) {
        throw new Error(
          "QR transaction reference is required."
        );
      }

      setSaving(true);

      const result =
        await completeExchange({
          originalSaleItemId:
            preview.original
              .saleItemId,

          replacementVariantId:
            selectedReplacement
              .variantId,

          quantity:
            parsedQuantity,

          processedBy:
            user.id,

          paymentMethod:
            priceDifference > 0
              ? paymentMethod
              : null,

          paymentReference:
            priceDifference > 0
            &&
            paymentMethod ===
              "qr"
              ? reference.trim()
                  || null
              : null,

          cashReceivedPaisa:
            finalCash,
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
    <div className="exchange-overlay">
      <section className="exchange-modal">
        {completed ? (
          <div className="exchange-complete">
            <div className="exchange-success-icon">
              ✓
            </div>

            <p className="page-eyebrow">
              EXCHANGE COMPLETE
            </p>

            <h2>
              Inventory updated
            </h2>

            <span>
              Receipt{" "}
              {
                completed.originalReceiptNumber
              }
            </span>

            <div className="exchange-complete-summary">
              <div>
                <span>
                  Returned
                </span>

                <strong>
                  {
                    completed.returnedSku
                  }
                </strong>

                <small>
                  {completed.returnedColor ||
                    ""}

                  {completed.returnedSize
                    ? ` • ${completed.returnedSize}`
                    : ""}

                  {" × "}
                  {
                    completed.quantity
                  }
                </small>
              </div>

              <div>
                <span>
                  Replacement
                </span>

                <strong>
                  {
                    completed.replacementSku
                  }
                </strong>

                <small>
                  {completed.replacementColor ||
                    ""}

                  {completed.replacementSize
                    ? ` • ${completed.replacementSize}`
                    : ""}

                  {" × "}
                  {
                    completed.quantity
                  }
                </small>
              </div>

              <div>
                <span>
                  Price difference
                </span>

                <strong>
                  {formatMoney(
                    completed.priceDifferencePaisa
                  )}
                </strong>
              </div>

              {completed.changePaisa !==
                null && (
                <div>
                  <span>
                    Change
                  </span>

                  <strong>
                    {formatMoney(
                      completed.changePaisa
                    )}
                  </strong>
                </div>
              )}
            </div>

            <button
              className="exchange-confirm"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="exchange-header">
              <div>
                <p className="page-eyebrow">
                  EXCHANGE
                </p>

                <h2>
                  Exchange Item
                </h2>
              </div>

              <button
                className="exchange-close"
                onClick={onClose}
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="exchange-loading">
                Loading exchange...
              </div>
            ) : error &&
              !preview ? (
              <div className="sales-alert error">
                {error}
              </div>
            ) : preview ? (
              <form
                onSubmit={
                  handleSubmit
                }
              >
                <div className="exchange-original">
                  <span>
                    Returning
                  </span>

                  <strong>
                    {
                      preview.original
                        .productName
                    }
                  </strong>

                  <small>
                    {
                      preview.original
                        .sku
                    }

                    {preview.original
                      .color
                      ? ` • ${preview.original.color}`
                      : ""}

                    {preview.original
                      .size
                      ? ` • ${preview.original.size}`
                      : ""}
                  </small>

                  <div>
                    Original price{" "}
                    <strong>
                      {formatMoney(
                        preview.original
                          .unitPricePaisa
                      )}
                    </strong>
                  </div>

                  <div>
                    Exchangeable{" "}
                    <strong>
                      {
                        preview.original
                          .remainingQuantity
                      }
                    </strong>
                  </div>
                </div>

                {preview.original
                  .remainingQuantity <=
                0 ? (
                  <div className="exchange-warning">
                    This sale item has
                    already been fully
                    exchanged.
                  </div>
                ) : (
                  <>
                    <div className="exchange-field">
                      <label>
                        Quantity
                      </label>

                      <input
                        type="number"
                        min="1"
                        max={
                          preview.original
                            .remainingQuantity
                        }
                        step="1"
                        value={
                          quantity
                        }
                        onChange={(
                          event
                        ) =>
                          setQuantity(
                            event.target
                              .value
                          )
                        }
                      />
                    </div>

                    <div className="exchange-field">
                      <label>
                        Replacement
                      </label>

                      <select
                        value={
                          replacementId ??
                          ""
                        }
                        onChange={(
                          event
                        ) =>
                          setReplacementId(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                        }
                      >
                        {preview.replacements.map(
                          (
                            item
                          ) => (
                            <option
                              key={
                                item.variantId
                              }
                              value={
                                item.variantId
                              }
                              disabled={
                                item.quantityOnHand <=
                                0
                              }
                            >
                              {
                                item.sku
                              }

                              {" — "}

                              {item.color ||
                                "No color"}

                              {item.size
                                ? ` / ${item.size}`
                                : ""}

                              {" — "}

                              {formatMoney(
                                item.sellingPricePaisa
                              )}

                              {" — Stock "}

                              {
                                item.quantityOnHand
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {selectedReplacement && (
                      <div className="exchange-difference">
                        <span>
                          Price difference
                        </span>

                        <strong
                          className={
                            priceDifference <
                            0
                              ? "negative"
                              : ""
                          }
                        >
                          {priceDifference <
                          0
                            ? "− "
                            : ""}

                          {formatMoney(
                            Math.abs(
                              priceDifference
                            )
                          )}
                        </strong>
                      </div>
                    )}

                    {priceDifference <
                      0 && (
                      <div className="exchange-warning">
                        The replacement
                        costs less than the
                        original item. We'll
                        support this through
                        the refund workflow
                        next.
                      </div>
                    )}

                    {priceDifference >
                      0 && (
                      <>
                        <div className="exchange-payment-methods">
                          <button
                            type="button"
                            className={
                              paymentMethod ===
                              "cash"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setPaymentMethod(
                                "cash"
                              )
                            }
                          >
                            Cash
                          </button>

                          <button
                            type="button"
                            className={
                              paymentMethod ===
                              "qr"
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setPaymentMethod(
                                "qr"
                              )
                            }
                          >
                            QR
                          </button>
                        </div>

                        {paymentMethod ===
                        "cash" ? (
                          <>
                            <div className="exchange-field">
                              <label>
                                Cash received
                              </label>

                              <input
                                value={
                                  cashReceived
                                }
                                onChange={(
                                  event
                                ) =>
                                  setCashReceived(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="0.00"
                              />
                            </div>

                            <div className="exchange-difference">
                              <span>
                                Change
                              </span>

                              <strong>
                                {formatMoney(
                                  changePaisa
                                )}
                              </strong>
                            </div>
                          </>
                        ) : (
                          <div className="exchange-field">
                            <label>
                              QR Reference
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
                                  event
                                    .target
                                    .value
                                )
                              }
                            />
                          </div>
                        )}
                      </>
                    )}

                    {error && (
                      <div className="sales-alert error">
                        {error}
                      </div>
                    )}

                    <div className="exchange-actions">
                      <button
                        type="button"
                        className="exchange-cancel"
                        onClick={
                          onClose
                        }
                        disabled={
                          saving
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="exchange-confirm"
                        disabled={
                          saving
                          ||
                          !selectedReplacement
                          ||
                          priceDifference <
                            0
                        }
                      >
                        {saving
                          ? "Processing..."
                          : "Confirm Exchange"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}