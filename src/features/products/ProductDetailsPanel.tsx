import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type {
  AuthUser,
} from "../../types/auth";

import {
  changeInventory,
  getInventoryMovements,
  getProductDetails,
  type InventoryMovement,
  type ProductDetails,
} from "./productService";

interface ProductDetailsPanelProps {
  productId: number;

  user: AuthUser;

  onClose: () => void;

  onInventoryChanged:
    () => Promise<void>;
}

function formatMoney(
  paisa: number
) {
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

export default function ProductDetailsPanel({
  productId,
  user,
  onClose,
  onInventoryChanged,
}: ProductDetailsPanelProps) {
  const [product, setProduct] =
    useState<ProductDetails | null>(
      null
    );

  const [
    movements,
    setMovements,
  ] = useState<
    InventoryMovement[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [
    selectedVariantId,
    setSelectedVariantId,
  ] = useState("");

  const [
    movementType,
    setMovementType,
  ] = useState<
    "restock" | "adjustment"
  >("restock");

  const [quantity, setQuantity] =
    useState("");

  const [note, setNote] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function loadDetails() {
    try {
      setLoading(true);
      setError("");

      const [
        productResult,
        movementResult,
      ] = await Promise.all([
        getProductDetails(
          productId
        ),

        getInventoryMovements(
          productId
        ),
      ]);

      setProduct(productResult);
      setMovements(
        movementResult
      );

      if (
        productResult.variants
          .length > 0
      ) {
        setSelectedVariantId(
          String(
            productResult
              .variants[0].id
          )
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

  useEffect(() => {
    loadDetails();
  }, [productId]);

  async function handleInventoryChange(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    try {
      if (
        !selectedVariantId
      ) {
        throw new Error(
          "Select a variant."
        );
      }

      if (
        !/^-?\d+$/.test(
          quantity.trim()
        )
      ) {
        throw new Error(
          "Quantity must be a whole number."
        );
      }

      let quantityChange =
        Number(quantity);

      if (
        movementType ===
        "restock"
      ) {
        quantityChange =
          Math.abs(
            quantityChange
          );

        if (
          quantityChange === 0
        ) {
          throw new Error(
            "Restock quantity must be greater than zero."
          );
        }
      } else if (
        quantityChange === 0
      ) {
        throw new Error(
          "Adjustment cannot be zero."
        );
      }

      setSaving(true);

      const newStock =
        await changeInventory(
          Number(
            selectedVariantId
          ),
          movementType,
          quantityChange,
          note.trim() || null,
          user.id
        );

      setQuantity("");
      setNote("");

      await loadDetails();

      await onInventoryChanged();

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

  if (loading) {
    return (
      <section className="product-details-panel">
        Loading product...
      </section>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <section className="product-details-panel">
      <div className="details-heading">
        <div>
          <p className="page-eyebrow">
            PRODUCT DETAILS
          </p>

          <h2>
            {product.name}
          </h2>

          <p>
            {product.brand ||
              "No brand"}
            {" • "}
            {product.categoryName ||
              "No category"}
          </p>
        </div>

        <button
          className="secondary-product-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {product.description && (
        <p className="product-description">
          {product.description}
        </p>
      )}

      {error && (
        <div className="product-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="product-alert success">
          {success}
        </div>
      )}

      <div className="details-section">
        <h3>Variants</h3>

        <div className="products-table-wrapper">
          <table className="products-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Size</th>
                <th>Color</th>
                <th>Barcode</th>
                <th>Cost</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Reorder</th>
              </tr>
            </thead>

            <tbody>
              {product.variants.map(
                (variant) => (
                  <tr
                    key={
                      variant.id
                    }
                  >
                    <td>
                      <strong>
                        {
                          variant.sku
                        }
                      </strong>
                    </td>

                    <td>
                      {variant.size ||
                        "—"}
                    </td>

                    <td>
                      {variant.color ||
                        "—"}
                    </td>

                    <td>
                      {variant.barcode ||
                        "—"}
                    </td>

                    <td>
                      {formatMoney(
                        variant.costPricePaisa
                      )}
                    </td>

                    <td>
                      {formatMoney(
                        variant.sellingPricePaisa
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          variant.quantityOnHand <=
                          variant.reorderLevel
                            ? "stock-low"
                            : "stock-ok"
                        }
                      >
                        {
                          variant.quantityOnHand
                        }
                      </span>
                    </td>

                    <td>
                      {
                        variant.reorderLevel
                      }
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="inventory-management-grid">
        <form
          className="inventory-action-card"
          onSubmit={
            handleInventoryChange
          }
        >
          <p className="page-eyebrow">
            INVENTORY ACTION
          </p>

          <h3>
            Change stock
          </h3>

          <div className="product-field">
            <label>
              Variant
            </label>

            <select
              value={
                selectedVariantId
              }
              onChange={(event) =>
                setSelectedVariantId(
                  event.target.value
                )
              }
            >
              {product.variants.map(
                (variant) => (
                  <option
                    key={
                      variant.id
                    }
                    value={
                      variant.id
                    }
                  >
                    {
                      variant.sku
                    }
                    {" — "}
                    {
                      variant.quantityOnHand
                    }{" "}
                    in stock
                  </option>
                )
              )}
            </select>
          </div>

          <div className="product-field">
            <label>
              Action
            </label>

            <select
              value={
                movementType
              }
              onChange={(event) =>
                setMovementType(
                  event.target
                    .value as
                    | "restock"
                    | "adjustment"
                )
              }
            >
              <option value="restock">
                Restock
              </option>

              <option value="adjustment">
                Adjustment
              </option>
            </select>
          </div>

          <div className="product-field">
            <label>
              Quantity
            </label>

            <input
              type="number"
              step="1"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  event.target.value
                )
              }
              placeholder={
                movementType ===
                "restock"
                  ? "10"
                  : "-2 or 3"
              }
              required
            />
          </div>

          <div className="product-field">
            <label>
              Note
            </label>

            <textarea
              rows={3}
              value={note}
              onChange={(event) =>
                setNote(
                  event.target.value
                )
              }
              placeholder="Optional reason..."
            />
          </div>

          <button
            className="product-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Updating..."
              : "Update inventory"}
          </button>
        </form>

        <div className="movement-card">
          <p className="page-eyebrow">
            AUDIT TRAIL
          </p>

          <h3>
            Recent movements
          </h3>

          {movements.length ===
          0 ? (
            <p className="movement-empty">
              No inventory movements.
            </p>
          ) : (
            <div className="movement-list">
              {movements.map(
                (movement) => (
                  <div
                    className="movement-row"
                    key={
                      movement.id
                    }
                  >
                    <div>
                      <strong>
                        {
                          movement.sku
                        }
                      </strong>

                      <span>
                        {
                          movement.movementType
                        }
                        {movement.note
                          ? ` • ${movement.note}`
                          : ""}
                      </span>

                      <small>
                        {movement.createdByName ||
                          "System"}
                        {" • "}
                        {
                          movement.createdAt
                        }
                      </small>
                    </div>

                    <span
                      className={
                        movement.quantityChange >
                        0
                          ? "movement-positive"
                          : "movement-negative"
                      }
                    >
                      {movement.quantityChange >
                      0
                        ? "+"
                        : ""}
                      {
                        movement.quantityChange
                      }
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}