import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import type { AuthUser } from "../../types/auth";

import {
  createCategory,
  createProduct,
  getCategories,
  getProducts,
  type Category,
  type ProductSummary,
} from "./productService";

import "./products.css";

interface ProductsPageProps {
  user: AuthUser;
}

interface VariantDraft {
  size: string;
  color: string;

  sku: string;
  barcode: string;

  costPrice: string;
  sellingPrice: string;

  initialStock: string;
  reorderLevel: string;
}

function createEmptyVariant():
  VariantDraft {
  return {
    size: "",
    color: "",

    sku: "",
    barcode: "",

    costPrice: "",
    sellingPrice: "",

    initialStock: "0",
    reorderLevel: "0",
  };
}

function moneyToPaisa(
  value: string
): number {
  const clean = value.trim();

  if (
    !/^\d+(\.\d{1,2})?$/.test(clean)
  ) {
    throw new Error(
      "Prices must be valid numbers with at most 2 decimal places."
    );
  }

  const [whole, decimal = ""] =
    clean.split(".");

  return (
    Number(whole) * 100 +
    Number(
      decimal.padEnd(2, "0")
    )
  );
}

function parseStock(
  value: string,
  label: string
): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(
      `${label} must be a whole number.`
    );
  }

  return Number(value);
}

function formatMoney(
  paisa: number
): string {
  return `Rs. ${(paisa / 100).toLocaleString(
    "en-NP",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

export default function ProductsPage({
  user,
}: ProductsPageProps) {
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [products, setProducts] =
    useState<ProductSummary[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showForm, setShowForm] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [name, setName] =
    useState("");

  const [brand, setBrand] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [categoryId, setCategoryId] =
    useState("");

  const [
    newCategoryName,
    setNewCategoryName,
  ] = useState("");

  const [
    categorySaving,
    setCategorySaving,
  ] = useState(false);

  const [variants, setVariants] =
    useState<VariantDraft[]>([
      createEmptyVariant(),
    ]);

  async function loadData() {
    try {
      setLoading(true);

      const [
        categoryResults,
        productResults,
      ] = await Promise.all([
        getCategories(),
        getProducts(),
      ]);

      setCategories(categoryResults);
      setProducts(productResults);
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
    loadData();
  }, []);

  function resetForm() {
    setName("");
    setBrand("");
    setDescription("");
    setCategoryId("");
    setVariants([
      createEmptyVariant(),
    ]);
  }

  function updateVariant(
    index: number,
    field: keyof VariantDraft,
    value: string
  ) {
    setVariants((current) =>
      current.map(
        (variant, currentIndex) =>
          currentIndex === index
            ? {
                ...variant,
                [field]: value,
              }
            : variant
      )
    );
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      createEmptyVariant(),
    ]);
  }

  function removeVariant(
    index: number
  ) {
    setVariants((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (_, currentIndex) =>
          currentIndex !== index
      );
    });
  }

  async function handleAddCategory() {
    const cleanName =
      newCategoryName.trim();

    if (!cleanName) {
      setError(
        "Enter a category name first."
      );

      return;
    }

    try {
      setError("");
      setSuccess("");
      setCategorySaving(true);

      const newCategoryId =
        await createCategory(
          cleanName,
          user.id
        );

      const updatedCategories =
        await getCategories();

      setCategories(
        updatedCategories
      );

      setCategoryId(
        String(newCategoryId)
      );

      setNewCategoryName("");

      setSuccess(
        `Category "${cleanName}" created.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    try {
      if (!name.trim()) {
        throw new Error(
          "Product name is required."
        );
      }

      const normalizedVariants =
        variants.map(
          (variant, index) => {
            if (!variant.sku.trim()) {
              throw new Error(
                `Variant ${
                  index + 1
                } requires a SKU.`
              );
            }

            if (
              !variant.costPrice.trim()
            ) {
              throw new Error(
                `Variant ${
                  index + 1
                } requires a cost price.`
              );
            }

            if (
              !variant.sellingPrice.trim()
            ) {
              throw new Error(
                `Variant ${
                  index + 1
                } requires a selling price.`
              );
            }

            return {
              size:
                variant.size.trim() ||
                null,

              color:
                variant.color.trim() ||
                null,

              sku:
                variant.sku
                  .trim()
                  .toUpperCase(),

              barcode:
                variant.barcode.trim() ||
                null,

              costPricePaisa:
                moneyToPaisa(
                  variant.costPrice
                ),

              sellingPricePaisa:
                moneyToPaisa(
                  variant.sellingPrice
                ),

              initialStock:
                parseStock(
                  variant.initialStock,
                  "Initial stock"
                ),

              reorderLevel:
                parseStock(
                  variant.reorderLevel,
                  "Reorder level"
                ),
            };
          }
        );

      const skuSet =
        new Set<string>();

      const barcodeSet =
        new Set<string>();

      for (
        const variant
        of normalizedVariants
      ) {
        if (
          skuSet.has(variant.sku)
        ) {
          throw new Error(
            `Duplicate SKU: ${variant.sku}`
          );
        }

        skuSet.add(variant.sku);

        if (variant.barcode) {
          if (
            barcodeSet.has(
              variant.barcode
            )
          ) {
            throw new Error(
              `Duplicate barcode: ${variant.barcode}`
            );
          }

          barcodeSet.add(
            variant.barcode
          );
        }
      }

      setSaving(true);

      await createProduct({
        name: name.trim(),

        categoryId:
          categoryId
            ? Number(categoryId)
            : null,

        brand:
          brand.trim() || null,

        description:
          description.trim() || null,

        variants:
          normalizedVariants,

        createdBy:
          user.id,
      });

      resetForm();

      setShowForm(false);

      await loadData();

      setSuccess(
        "Product created successfully."
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
    <section className="products-page">
      <div className="products-heading">
        <div>
          <p className="page-eyebrow">
            CATALOG
          </p>

          <h2>Products</h2>

          <p>
            Manage products, variants,
            pricing and initial stock.
          </p>
        </div>

        <button
          className="product-primary-button"
          onClick={() => {
            setShowForm(
              (current) => !current
            );

            setError("");
            setSuccess("");
          }}
        >
          {showForm
            ? "Close form"
            : "+ Add product"}
        </button>
      </div>

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

      {showForm && (
        <form
          className="product-form-card"
          onSubmit={handleSubmit}
        >
          <div className="product-form-title">
            <div>
              <p className="page-eyebrow">
                NEW PRODUCT
              </p>

              <h3>
                Product information
              </h3>
            </div>
          </div>

          <div className="product-form-grid">
            <div className="product-field">
              <label>
                Product name *
              </label>

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="Oversized T-Shirt"
                required
              />
            </div>

            <div className="product-field">
              <label>
                Brand
              </label>

              <input
                value={brand}
                onChange={(event) =>
                  setBrand(
                    event.target.value
                  )
                }
                placeholder="Nike"
              />
            </div>

            <div className="product-field">
              <label>
                Category
              </label>

              <select
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(
                    event.target.value
                  )
                }
              >
                <option value="">
                  No category
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="product-field category-create-field">
              <label>
                Quick add category
              </label>

              <div className="category-create-row">
                <input
                  value={
                    newCategoryName
                  }
                  onChange={(event) =>
                    setNewCategoryName(
                      event.target.value
                    )
                  }
                  placeholder="T-Shirts"
                />

                <button
                  type="button"
                  onClick={
                    handleAddCategory
                  }
                  disabled={
                    categorySaving
                  }
                >
                  {categorySaving
                    ? "Adding..."
                    : "Add"}
                </button>
              </div>
            </div>

            <div className="product-field full">
              <label>
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Optional product notes..."
                rows={3}
              />
            </div>
          </div>

          <div className="variant-section">
            <div className="variant-section-heading">
              <div>
                <h3>Variants</h3>

                <p>
                  Each unique size /
                  color combination gets
                  its own SKU and stock.
                </p>
              </div>

              <button
                type="button"
                className="secondary-product-button"
                onClick={addVariant}
              >
                + Add variant
              </button>
            </div>

            <div className="variants-list">
              {variants.map(
                (variant, index) => (
                  <div
                    className="variant-card"
                    key={index}
                  >
                    <div className="variant-card-header">
                      <strong>
                        Variant{" "}
                        {index + 1}
                      </strong>

                      {variants.length >
                        1 && (
                        <button
                          type="button"
                          className="remove-variant-button"
                          onClick={() =>
                            removeVariant(
                              index
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="variant-grid">
                      <div className="product-field">
                        <label>
                          Size
                        </label>

                        <input
                          value={
                            variant.size
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "size",
                              event.target
                                .value
                            )
                          }
                          placeholder="M"
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          Color
                        </label>

                        <input
                          value={
                            variant.color
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "color",
                              event.target
                                .value
                            )
                          }
                          placeholder="Black"
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          SKU *
                        </label>

                        <input
                          value={
                            variant.sku
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "sku",
                              event.target
                                .value
                            )
                          }
                          placeholder="TS-BLK-M"
                          required
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          Barcode
                        </label>

                        <input
                          value={
                            variant.barcode
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "barcode",
                              event.target
                                .value
                            )
                          }
                          placeholder="Optional"
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          Cost price
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            variant.costPrice
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "costPrice",
                              event.target
                                .value
                            )
                          }
                          placeholder="600"
                          required
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          Selling price
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            variant.sellingPrice
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "sellingPrice",
                              event.target
                                .value
                            )
                          }
                          placeholder="1000"
                          required
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          Initial stock
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            variant.initialStock
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "initialStock",
                              event.target
                                .value
                            )
                          }
                          required
                        />
                      </div>

                      <div className="product-field">
                        <label>
                          Reorder level
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            variant.reorderLevel
                          }
                          onChange={(
                            event
                          ) =>
                            updateVariant(
                              index,
                              "reorderLevel",
                              event.target
                                .value
                            )
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="product-form-actions">
            <button
              type="button"
              className="secondary-product-button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="product-primary-button"
              disabled={saving}
            >
              {saving
                ? "Creating product..."
                : "Create product"}
            </button>
          </div>
        </form>
      )}

      <div className="product-list-card">
        <div className="product-list-header">
          <div>
            <h3>
              Product catalog
            </h3>

            <p>
              {products.length} product
              {products.length === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="product-empty">
            Loading products...
          </div>
        ) : products.length === 0 ? (
          <div className="product-empty">
            <strong>
              No products yet
            </strong>

            <p>
              Add your first product to
              start building the store
              catalog.
            </p>
          </div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Variants</th>
                  <th>Stock</th>
                  <th>Price</th>
                </tr>
              </thead>

              <tbody>
                {products.map(
                  (product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-name-cell">
                          <strong>
                            {product.name}
                          </strong>

                          <span>
                            {product.brand ||
                              "No brand"}
                          </span>
                        </div>
                      </td>

                      <td>
                        {product.categoryName ||
                          "—"}
                      </td>

                      <td>
                        {
                          product.variantCount
                        }
                      </td>

                      <td>
                        {product.totalStock}
                      </td>

                      <td>
                        {product.minPricePaisa ===
                        product.maxPricePaisa
                          ? formatMoney(
                              product.minPricePaisa
                            )
                          : `${formatMoney(
                              product.minPricePaisa
                            )} – ${formatMoney(
                              product.maxPricePaisa
                            )}`}
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
  );
}