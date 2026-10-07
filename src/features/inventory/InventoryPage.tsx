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
  changeInventory,
  getInventory,
  getInventorySummary,
  getVariantMovements,
  type InventoryFilter,
  type InventoryMovement,
  type InventorySummary,
  type InventoryVariant,
} from "./inventoryService";

import "./inventory.css";

interface InventoryPageProps {
  user: AuthUser;
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

  return date.toLocaleString();
}

export default function InventoryPage({
  user,
}: InventoryPageProps) {
  const [
    inventory,
    setInventory,
  ] = useState<
    InventoryVariant[]
  >([]);

  const [
    summary,
    setSummary,
  ] = useState<
    InventorySummary | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState<
    InventoryFilter
  >("all");

  const [
    selectedVariantId,
    setSelectedVariantId,
  ] = useState<
    number | null
  >(null);

  const [
    movements,
    setMovements,
  ] = useState<
    InventoryMovement[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    movementLoading,
    setMovementLoading,
  ] = useState(false);

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

  const [
    movementMode,
    setMovementMode,
  ] = useState<
    "restock" | "adjustment"
  >("restock");

  const [
    quantity,
    setQuantity,
  ] = useState("");

  const [
    note,
    setNote,
  ] = useState("");

  const selectedVariant =
    useMemo(
      () =>
        inventory.find(
          (item) =>
            item.variantId ===
            selectedVariantId
        ) ?? null,
      [
        inventory,
        selectedVariantId,
      ]
    );

  async function loadInventory() {
    try {
      setLoading(true);
      setError("");

      const [
        rows,
        totals,
      ] = await Promise.all([
        getInventory(
          search,
          filter
        ),

        getInventorySummary(),
      ]);

      setInventory(rows);
      setSummary(totals);
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

  async function loadMovements(
    variantId: number
  ) {
    try {
      setMovementLoading(true);

      const rows =
        await getVariantMovements(
          variantId
        );

      setMovements(rows);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setMovementLoading(false);
    }
  }

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          loadInventory();
        },
        150
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    search,
    filter,
  ]);

  useEffect(() => {
    if (
      selectedVariantId ===
      null
    ) {
      setMovements([]);
      return;
    }

    loadMovements(
      selectedVariantId
    );
  }, [
    selectedVariantId,
  ]);

  async function handleInventoryChange(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedVariant) {
      return;
    }

    setError("");
    setSuccess("");

    const parsedQuantity =
      Number(quantity);

    if (
      !Number.isInteger(
        parsedQuantity
      )
    ) {
      setError(
        "Quantity must be a whole number."
      );

      return;
    }

    if (
      movementMode ===
        "restock"
      &&
      parsedQuantity <= 0
    ) {
      setError(
        "Restock quantity must be greater than zero."
      );

      return;
    }

    if (
      movementMode ===
        "adjustment"
      &&
      parsedQuantity === 0
    ) {
      setError(
        "Adjustment cannot be zero."
      );

      return;
    }

    try {
      setSaving(true);

      const newStock =
        await changeInventory(
          selectedVariant.variantId,

          movementMode,

          parsedQuantity,

          note.trim(),

          user.id
        );

      setQuantity("");
      setNote("");

      await loadInventory();

      await loadMovements(
        selectedVariant.variantId
      );

      setSuccess(
        `Inventory updated. New stock: ${newStock}.`
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
    <section className="inventory-page">
      <div className="inventory-heading">
        <div>
          <p className="page-eyebrow">
            STOCK CONTROL
          </p>

          <h2>
            Inventory
          </h2>

          <p>
            Monitor stock levels,
            restock products and audit
            every inventory movement.
          </p>
        </div>
      </div>

      {summary && (
        <div className="inventory-stats">
          <div>
            <span>
              Total Units
            </span>

            <strong>
              {
                summary.totalUnits
              }
            </strong>
          </div>

          <div>
            <span>
              Variants
            </span>

            <strong>
              {
                summary.totalVariants
              }
            </strong>
          </div>

          <div
            className={
              summary
                .lowStockVariants >
              0
                ? "warning"
                : ""
            }
          >
            <span>
              Low Stock
            </span>

            <strong>
              {
                summary
                  .lowStockVariants
              }
            </strong>
          </div>

          <div
            className={
              summary
                .outOfStockVariants >
              0
                ? "danger"
                : ""
            }
          >
            <span>
              Out of Stock
            </span>

            <strong>
              {
                summary
                  .outOfStockVariants
              }
            </strong>
          </div>

          <div>
            <span>
              Stock Cost Value
            </span>

            <strong>
              {formatMoney(
                summary
                  .stockCostValuePaisa
              )}
            </strong>
          </div>
        </div>
      )}

      {error && (
        <div className="inventory-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="inventory-alert success">
          {success}
        </div>
      )}

      <div className="inventory-toolbar">
        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search product, SKU, barcode, size or color..."
        />

        <div className="inventory-filters">
          <button
            className={
              filter === "all"
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter("all")
            }
          >
            All
          </button>

          <button
            className={
              filter === "low"
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter("low")
            }
          >
            Low Stock
          </button>

          <button
            className={
              filter === "out"
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter("out")
            }
          >
            Out of Stock
          </button>
        </div>
      </div>

      <div className="inventory-workspace">
        <div className="inventory-table-card">
          {loading ? (
            <div className="inventory-empty">
              Loading inventory...
            </div>
          ) : inventory.length ===
            0 ? (
            <div className="inventory-empty">
              <strong>
                No inventory found
              </strong>

              <p>
                Try another search or
                filter.
              </p>
            </div>
          ) : (
            <div className="inventory-table-wrapper">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>
                      Product
                    </th>

                    <th>
                      SKU
                    </th>

                    <th>
                      Variant
                    </th>

                    <th>
                      Cost
                    </th>

                    <th>
                      Price
                    </th>

                    <th>
                      Stock
                    </th>

                    <th>
                      Reorder
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {inventory.map(
                    (item) => {
                      const lowStock =
                        item.quantityOnHand <=
                        item.reorderLevel;

                      const outOfStock =
                        item.quantityOnHand ===
                        0;

                      return (
                        <tr
                          key={
                            item.variantId
                          }
                          className={
                            selectedVariantId ===
                            item.variantId
                              ? "selected"
                              : ""
                          }
                          onClick={() => {
                            setSelectedVariantId(
                              item.variantId
                            );

                            setSuccess(
                              ""
                            );

                            setError(
                              ""
                            );
                          }}
                        >
                          <td>
                            <div className="inventory-product-cell">
                              <strong>
                                {
                                  item.productName
                                }
                              </strong>

                              <span>
                                {item.brand ||
                                  item.categoryName ||
                                  "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <strong>
                              {
                                item.sku
                              }
                            </strong>
                          </td>

                          <td>
                            {item.color ||
                              "—"}

                            {item.size
                              ? ` / ${item.size}`
                              : ""}
                          </td>

                          <td>
                            {formatMoney(
                              item.costPricePaisa
                            )}
                          </td>

                          <td>
                            {formatMoney(
                              item.sellingPricePaisa
                            )}
                          </td>

                          <td>
                            <span
                              className={
                                outOfStock
                                  ? "inventory-stock out"
                                  : lowStock
                                    ? "inventory-stock low"
                                    : "inventory-stock healthy"
                              }
                            >
                              {
                                item.quantityOnHand
                              }
                            </span>
                          </td>

                          <td>
                            {
                              item.reorderLevel
                            }
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="inventory-detail-card">
          {!selectedVariant ? (
            <div className="inventory-selection-empty">
              <strong>
                Select a variant
              </strong>

              <p>
                Choose an inventory
                row to restock,
                adjust stock or review
                movement history.
              </p>
            </div>
          ) : (
            <>
              <div className="inventory-detail-heading">
                <p className="page-eyebrow">
                  SELECTED VARIANT
                </p>

                <h3>
                  {
                    selectedVariant.productName
                  }
                </h3>

                <span>
                  {
                    selectedVariant.sku
                  }

                  {selectedVariant.color
                    ? ` • ${selectedVariant.color}`
                    : ""}

                  {selectedVariant.size
                    ? ` • ${selectedVariant.size}`
                    : ""}
                </span>
              </div>

              <div className="inventory-stock-summary">
                <div>
                  <span>
                    Current stock
                  </span>

                  <strong>
                    {
                      selectedVariant.quantityOnHand
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Reorder at
                  </span>

                  <strong>
                    {
                      selectedVariant.reorderLevel
                    }
                  </strong>
                </div>
              </div>

              <form
                className="inventory-change-form"
                onSubmit={
                  handleInventoryChange
                }
              >
                <div className="inventory-mode-switch">
                  <button
                    type="button"
                    className={
                      movementMode ===
                      "restock"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setMovementMode(
                        "restock"
                      );

                      setQuantity(
                        ""
                      );
                    }}
                  >
                    Restock
                  </button>

                  <button
                    type="button"
                    className={
                      movementMode ===
                      "adjustment"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setMovementMode(
                        "adjustment"
                      );

                      setQuantity(
                        ""
                      );
                    }}
                  >
                    Adjustment
                  </button>
                </div>

                <div className="inventory-field">
                  <label>
                    {movementMode ===
                    "restock"
                      ? "Quantity received"
                      : "Stock adjustment"}
                  </label>

                  <input
                    type="number"
                    step="1"
                    value={
                      quantity
                    }
                    onChange={(
                      event
                    ) =>
                      setQuantity(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder={
                      movementMode ===
                      "restock"
                        ? "e.g. 10"
                        : "e.g. 5 or -2"
                    }
                    required
                  />

                  {movementMode ===
                    "adjustment" && (
                    <small>
                      Positive adds
                      stock; negative
                      removes stock.
                    </small>
                  )}
                </div>

                <div className="inventory-field">
                  <label>
                    Note
                  </label>

                  <input
                    value={note}
                    onChange={(
                      event
                    ) =>
                      setNote(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder={
                      movementMode ===
                      "restock"
                        ? "Supplier delivery..."
                        : "Count correction..."
                    }
                  />
                </div>

                <button
                  className="inventory-update-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Updating..."
                    : movementMode ===
                        "restock"
                      ? "Add Stock"
                      : "Apply Adjustment"}
                </button>
              </form>

              <div className="inventory-history-section">
                <div className="inventory-history-heading">
                  <div>
                    <p className="page-eyebrow">
                      AUDIT TRAIL
                    </p>

                    <h4>
                      Movement History
                    </h4>
                  </div>

                  <span>
                    {
                      movements.length
                    }
                  </span>
                </div>

                <div className="inventory-history-list">
                  {movementLoading ? (
                    <div className="inventory-history-empty">
                      Loading...
                    </div>
                  ) : movements.length ===
                    0 ? (
                    <div className="inventory-history-empty">
                      No movements yet.
                    </div>
                  ) : (
                    movements.map(
                      (
                        movement
                      ) => (
                        <div
                          className="inventory-history-row"
                          key={
                            movement.id
                          }
                        >
                          <div>
                            <strong>
                              {movement.movementType.replaceAll(
                                "_",
                                " "
                              )}
                            </strong>

                            <span>
                              {movement.note ||
                                movement.referenceType ||
                                "Inventory update"}
                            </span>

                            <small>
                              {formatDateTime(
                                movement.createdAt
                              )}

                              {movement.createdByName
                                ? ` • ${movement.createdByName}`
                                : ""}
                            </small>
                          </div>

                          <strong
                            className={
                              movement.quantityChange >
                              0
                                ? "positive"
                                : "negative"
                            }
                          >
                            {movement.quantityChange >
                            0
                              ? "+"
                              : ""}

                            {
                              movement.quantityChange
                            }
                          </strong>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}