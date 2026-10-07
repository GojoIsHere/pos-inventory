import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import type {
  PaymentMethod,
} from "./checkoutService";

interface PaymentModalProps {
  totalPaisa: number;

  requireQrReference: boolean;

  onCancel: () => void;

  onConfirm: (
    method: PaymentMethod,
    reference: string | null,
    cashReceivedPaisa:
      number | null
  ) => Promise<void>;
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

export default function PaymentModal({
  totalPaisa,
  requireQrReference,
  onCancel,
  onConfirm,
}: PaymentModalProps) {
  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>(
    "cash"
  );

  const [
    cashReceived,
    setCashReceived,
  ] = useState("");

  const [
    reference,
    setReference,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const cashReceivedPaisa =
    useMemo(
      () =>
        moneyToPaisa(
          cashReceived
        ),
      [cashReceived]
    );

  const changePaisa =
    paymentMethod === "cash"
    && cashReceivedPaisa !== null
      ? Math.max(
          cashReceivedPaisa -
            totalPaisa,
          0
        )
      : 0;

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    try {
      let finalCash:
        number | null =
        null;

      if (
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
          totalPaisa
        ) {
          throw new Error(
            "Cash received is less than the amount due."
          );
        }

        finalCash =
          cashReceivedPaisa;
      }
      if (
        paymentMethod === "qr"
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

      await onConfirm(
        paymentMethod,

        paymentMethod === "qr"
          ? reference.trim()
              || null
          : null,

        finalCash
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
    <div className="payment-overlay">
      <form
        className="payment-modal"
        onSubmit={
          handleSubmit
        }
      >
        <div className="payment-header">
          <div>
            <p className="page-eyebrow">
              CHECKOUT
            </p>

            <h2>
              Confirm payment
            </h2>
          </div>

          <button
            type="button"
            className="payment-close"
            onClick={onCancel}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <div className="payment-total">
          <span>
            Amount due
          </span>

          <strong>
            {formatMoney(
              totalPaisa
            )}
          </strong>
        </div>

        <div className="payment-methods">
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
            QR Payment
          </button>
        </div>

        {paymentMethod ===
        "cash" ? (
          <div className="payment-fields">
            <div className="payment-field">
              <label>
                Cash received
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  cashReceived
                }
                onChange={(
                  event
                ) =>
                  setCashReceived(
                    event.target
                      .value
                  )
                }
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="change-box">
              <span>
                Change
              </span>

              <strong>
                {formatMoney(
                  changePaisa
                )}
              </strong>
            </div>
          </div>
        ) : (
          <div className="payment-fields">
            <div className="qr-payment-note">
              Confirm that the
              customer's QR payment
              has been received before
              completing the sale.
            </div>

            <div className="payment-field">
              <label>
                Transaction reference
                {!requireQrReference && (
                  <span>
                    {" "}
                    (optional)
                  </span>
                )}
              </label>

              <input
                value={
                  reference
                }
                onChange={(
                  event
                ) =>
                  setReference(
                    event.target
                      .value
                  )
                }
                placeholder="Bank / wallet reference"
                autoFocus
              />
            </div>
          </div>
        )}

        {error && (
          <div className="pos-alert">
            {error}
          </div>
        )}

        <div className="payment-warning">
          Only confirm after payment
          has actually been received.
        </div>

        <div className="payment-actions">
          <button
            type="button"
            className="payment-cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="payment-confirm"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Completing..."
              : "Confirm Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}