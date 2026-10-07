import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  AuthUser,
} from "../../types/auth";

import {
  getAppSettings,
  saveAppSettings,
} from "./settingsService";

import "./settings.css";

interface SettingsPageProps {
  user: AuthUser;
}

function basisPointsToPercent(
  basisPoints: number
): string {
  return (
    basisPoints / 100
  ).toString();
}

function percentToBasisPoints(
  value: string
): number {
  const clean =
    value.trim();

  if (!clean) {
    return 0;
  }

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      clean
    )
  ) {
    throw new Error(
      "Tax percentage can have at most two decimal places."
    );
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

export default function SettingsPage({
  user,
}: SettingsPageProps) {
  const [
    storeName,
    setStoreName,
  ] = useState("");

  const [
    storeAddress,
    setStoreAddress,
  ] = useState("");

  const [
    storePhone,
    setStorePhone,
  ] = useState("");

  const [
    taxEnabled,
    setTaxEnabled,
  ] = useState(false);

  const [
    taxPercent,
    setTaxPercent,
  ] = useState("0");

  const [
    receiptFooter,
    setReceiptFooter,
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
    success,
    setSuccess,
  ] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const settings =
          await getAppSettings();

        setStoreName(
          settings.storeName
        );

        setStoreAddress(
          settings.storeAddress
        );

        setStorePhone(
          settings.storePhone
        );

        setTaxEnabled(
          settings.taxEnabled
        );

        setTaxPercent(
          basisPointsToPercent(
            settings
              .defaultTaxRateBps
          )
        );

        setReceiptFooter(
          settings.receiptFooter
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
  }, []);

  async function handleSave(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    try {
      if (
        !storeName.trim()
      ) {
        throw new Error(
          "Store name is required."
        );
      }

      const taxRateBps =
        percentToBasisPoints(
          taxPercent
        );

      if (
        taxRateBps < 0
        || taxRateBps > 10_000
      ) {
        throw new Error(
          "Tax rate must be between 0% and 100%."
        );
      }

      setSaving(true);

      await saveAppSettings(
        {
          storeName:
            storeName.trim(),

          storeAddress:
            storeAddress.trim(),

          storePhone:
            storePhone.trim(),

          taxEnabled,

          defaultTaxRateBps:
            taxEnabled
              ? taxRateBps
              : 0,

          receiptFooter:
            receiptFooter.trim(),

          requireQrReference,
        },

        user.id
      );

      setSuccess(
        "Settings saved successfully."
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

  if (loading) {
    return (
      <section className="settings-page">
        <div className="settings-loading">
          Loading settings...
        </div>
      </section>
    );
  }

  return (
    <section className="settings-page">
      <div className="settings-heading">
        <div>
          <p className="page-eyebrow">
            CONFIGURATION
          </p>

          <h2>
            Settings
          </h2>

          <p>
            Configure your store,
            checkout and receipt
            defaults.
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="settings-alert success">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="settings-form"
      >
        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <p className="page-eyebrow">
                STORE PROFILE
              </p>

              <h3>
                Store Information
              </h3>
            </div>

            <p>
              These details can appear
              on receipts.
            </p>
          </div>

          <div className="settings-grid">
            <div className="settings-field full">
              <label>
                Store Name
              </label>

              <input
                value={
                  storeName
                }
                onChange={(
                  event
                ) =>
                  setStoreName(
                    event.target
                      .value
                  )
                }
                placeholder="My Clothing Store"
                required
              />
            </div>

            <div className="settings-field">
              <label>
                Phone
              </label>

              <input
                value={
                  storePhone
                }
                onChange={(
                  event
                ) =>
                  setStorePhone(
                    event.target
                      .value
                  )
                }
                placeholder="+977 ..."
              />
            </div>

            <div className="settings-field">
              <label>
                Address
              </label>

              <input
                value={
                  storeAddress
                }
                onChange={(
                  event
                ) =>
                  setStoreAddress(
                    event.target
                      .value
                  )
                }
                placeholder="Store address"
              />
            </div>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <p className="page-eyebrow">
                CHECKOUT
              </p>

              <h3>
                POS Defaults
              </h3>
            </div>

            <p>
              Configure defaults used
              when a new sale begins.
            </p>
          </div>

          <div className="settings-toggle-row">
            <div>
              <strong>
                Enable tax by default
              </strong>

              <span>
                Automatically apply
                the saved tax rate to
                new sales.
              </span>
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={
                  taxEnabled
                }
                onChange={(
                  event
                ) =>
                  setTaxEnabled(
                    event.target
                      .checked
                  )
                }
              />

              <span />
            </label>
          </div>

          <div className="settings-field tax-field">
            <label>
              Default Tax Rate (%)
            </label>

            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={
                taxPercent
              }
              onChange={(
                event
              ) =>
                setTaxPercent(
                  event.target
                    .value
                )
              }
              disabled={
                !taxEnabled
              }
            />

            <small>
              Example: enter 13 for
              13%.
            </small>
          </div>

          <div className="settings-toggle-row qr-setting">
            <div>
              <strong>
                Require QR reference
              </strong>

              <span>
                Cashiers must enter a
                bank or wallet
                transaction reference
                before confirming QR
                payment.
              </span>
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={
                  requireQrReference
                }
                onChange={(
                  event
                ) =>
                  setRequireQrReference(
                    event.target
                      .checked
                  )
                }
              />

              <span />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <p className="page-eyebrow">
                RECEIPTS
              </p>

              <h3>
                Receipt Settings
              </h3>
            </div>

            <p>
              Customize the message
              shown at the bottom of
              receipts.
            </p>
          </div>

          <div className="settings-field full">
            <label>
              Receipt Footer
            </label>

            <textarea
              value={
                receiptFooter
              }
              onChange={(
                event
              ) =>
                setReceiptFooter(
                  event.target
                    .value
                )
              }
              placeholder="Thank you for your purchase."
              rows={3}
            />
          </div>

          <div className="receipt-preview">
            <p>
              Receipt preview
            </p>

            <strong>
              {storeName ||
                "Store Name"}
            </strong>

            {storeAddress && (
              <span>
                {storeAddress}
              </span>
            )}

            {storePhone && (
              <span>
                {storePhone}
              </span>
            )}

            <div />

            <small>
              {receiptFooter ||
                "Thank you for your purchase."}
            </small>
          </div>
        </section>

        <div className="settings-save-bar">
          <div>
            <strong>
              Store configuration
            </strong>

            <span>
              Changes affect future
              checkout sessions.
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Settings"}
          </button>
        </div>
      </form>
    </section>
  );
}