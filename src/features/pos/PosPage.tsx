import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  AuthUser,
} from "../../types/auth";

import {
  findExactVariant,
  searchPosVariants,
  type PosVariant,
} from "./posService";

import "./pos.css";

import PaymentModal from "./PaymentModal";
import SaleCompleteModal from "./SaleCompleteModal";

import {
  completeSale,
  type CompleteSaleResult,
  type PaymentMethod,
} from "./checkoutService";

import {
  getAppSettings,
} from "../settings/settingsService";

interface PosPageProps {
  user: AuthUser;
}

interface CartItem {
  variantId: number;

  productName: string;

  sku: string;

  size: string | null;
  color: string | null;

  unitPricePaisa: number;

  quantity: number;

  stockAvailable: number;
}

type DiscountMode =
  | "percent"
  | "fixed";

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
    return 0;
  }

  const [
    whole,
    decimal = "",
  ] = clean.split(".");

  return (
    Number(whole) * 100 +
    Number(
      decimal.padEnd(2, "0")
    )
  );
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
      "Percentage must have at most two decimal places."
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

export default function PosPage({
  user,
}: PosPageProps) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    variants,
    setVariants,
  ] = useState<PosVariant[]>(
    []
  );

  const [
    cart,
    setCart,
  ] = useState<CartItem[]>(
    []
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
    discountMode,
    setDiscountMode,
  ] = useState<DiscountMode>(
    "percent"
  );

  const [
    discountValue,
    setDiscountValue,
  ] = useState("");

  const [
    taxPercent,
    setTaxPercent,
  ] = useState("");

  const [
    requireQrReference,
    setRequireQrReference,
  ] = useState(false);

  useEffect(() => {
    async function loadPosSettings() {
      try {
        const settings =
          await getAppSettings();

        setRequireQrReference(
          settings
            .requireQrReference
        );

        if (
          settings.taxEnabled
        ) {
          setTaxPercent(
            (
              settings
                .defaultTaxRateBps
              / 100
            ).toString()
          );
        } else {
          setTaxPercent("");
        }
      } catch (err) {
        console.error(
          "Failed to load POS settings:",
          err
        );
      }
    }

    loadPosSettings();
  }, []);

  const searchInputRef =
    useRef<HTMLInputElement>(
      null
    );

    const [
    paymentOpen,
    setPaymentOpen,
    ] = useState(false);

    const [
    completedSale,
    setCompletedSale,
    ] = useState<
    CompleteSaleResult | null
    >(null);


  async function loadVariants(
    value: string
  ) {
    try {
      setLoading(true);

      const results =
        await searchPosVariants(
          value
        );

      setVariants(results);
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

  async function handleConfirmPayment(
    method: PaymentMethod,
    reference: string | null,
    cashReceivedPaisa:
        number | null
    ) {
    const result =
        await completeSale({
        cashierId:
            user.id,

        items:
            cart.map(
            (item) => ({
                variantId:
                item.variantId,

                quantity:
                item.quantity,
            })
            ),

        discountMode,

        discountValue:
            discountMode ===
            "percent"
            ? percentToBasisPoints(
                discountValue
                )
            : moneyToPaisa(
                discountValue
                ),

        taxRateBps:
            percentToBasisPoints(
            taxPercent
            ),

        paymentMethod:
            method,

        paymentReference:
            reference,

        cashReceivedPaisa,
        });

    /*
    * ONLY clear after Rust
    * successfully commits.
    */

    setPaymentOpen(false);

    setCart([]);

    setDiscountValue("");
    setTaxPercent("");

    setSearch("");

    await loadVariants("");

    setCompletedSale(
        result
    );
    }

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          loadVariants(search);
        },
        150
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [search]);

  function addToCart(
    variant: PosVariant
  ) {
    setError("");

    if (
      variant.quantityOnHand <=
      0
    ) {
      setError(
        `${variant.sku} is out of stock.`
      );

      return;
    }

    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.variantId ===
            variant.variantId
        );

      if (existing) {
        if (
          existing.quantity >=
          variant.quantityOnHand
        ) {
          setError(
            `Only ${variant.quantityOnHand} unit(s) of ${variant.sku} are available.`
          );

          return current;
        }

        return current.map(
          (item) =>
            item.variantId ===
            variant.variantId
              ? {
                  ...item,

                  quantity:
                    item.quantity +
                    1,

                  stockAvailable:
                    variant.quantityOnHand,
                }
              : item
        );
      }

      return [
        ...current,

        {
          variantId:
            variant.variantId,

          productName:
            variant.productName,

          sku:
            variant.sku,

          size:
            variant.size,

          color:
            variant.color,

          unitPricePaisa:
            variant.sellingPricePaisa,

          quantity: 1,

          stockAvailable:
            variant.quantityOnHand,
        },
      ];
    });

    setSearch("");

    window.setTimeout(
      () => {
        searchInputRef.current
          ?.focus();
      },
      0
    );
  }

  function increaseQuantity(
    variantId: number
  ) {
    setError("");

    setCart((current) =>
      current.map((item) => {
        if (
          item.variantId !==
          variantId
        ) {
          return item;
        }

        if (
          item.quantity >=
          item.stockAvailable
        ) {
          setError(
            `Only ${item.stockAvailable} unit(s) of ${item.sku} are available.`
          );

          return item;
        }

        return {
          ...item,

          quantity:
            item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(
    variantId: number
  ) {
    setCart((current) =>
      current.flatMap(
        (item) => {
          if (
            item.variantId !==
            variantId
          ) {
            return [item];
          }

          if (
            item.quantity <= 1
          ) {
            return [];
          }

          return [
            {
              ...item,

              quantity:
                item.quantity -
                1,
            },
          ];
        }
      )
    );
  }

  function removeItem(
    variantId: number
  ) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.variantId !==
          variantId
      )
    );
  }

  async function handleSearchEnter() {
    const cleanSearch =
      search.trim();

    if (!cleanSearch) {
      return;
    }

    try {
      setError("");

      const exactVariant =
        await findExactVariant(
          cleanSearch
        );

      if (exactVariant) {
        addToCart(
          exactVariant
        );

        return;
      }

      if (
        variants.length === 1
      ) {
        addToCart(
          variants[0]
        );

        return;
      }

      setError(
        "No exact SKU or barcode match. Select a product from the results."
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  const subtotalPaisa =
    useMemo(
      () =>
        cart.reduce(
          (
            total,
            item
          ) =>
            total +
            item.unitPricePaisa *
              item.quantity,
          0
        ),
      [cart]
    );

  const discountPaisa =
    useMemo(() => {
      const rawValue =
        Number(
          discountValue
        );

      if (
        !Number.isFinite(
          rawValue
        ) ||
        rawValue <= 0
      ) {
        return 0;
      }

      if (
        discountMode ===
        "percent"
      ) {
        const safePercent =
          Math.min(
            rawValue,
            100
          );

        return Math.round(
          subtotalPaisa *
            (safePercent /
              100)
        );
      }

      return Math.min(
        moneyToPaisa(
          discountValue
        ),
        subtotalPaisa
      );
    }, [
      discountMode,
      discountValue,
      subtotalPaisa,
    ]);

  const taxablePaisa =
    Math.max(
      subtotalPaisa -
        discountPaisa,
      0
    );

  const taxPaisa =
    useMemo(() => {
      const tax =
        Number(
          taxPercent
        );

      if (
        !Number.isFinite(tax) ||
        tax <= 0
      ) {
        return 0;
      }

      return Math.round(
        taxablePaisa *
          (tax / 100)
      );
    }, [
      taxPercent,
      taxablePaisa,
    ]);

  const totalPaisa =
    taxablePaisa +
    taxPaisa;

  const cartItemCount =
    cart.reduce(
      (total, item) =>
        total +
        item.quantity,
      0
    );

  function clearCart() {
    setCart([]);

    setDiscountValue("");
    setTaxPercent("");

    setError("");

    searchInputRef.current
      ?.focus();
  }

  return (
    <>
        <section className="pos-page">
            <div className="pos-workspace">
                <div className="pos-catalog">
                <div className="pos-heading">
                    <div>
                    <p className="page-eyebrow">
                        CASHIER
                    </p>

                    <h2>
                        Point of Sale
                    </h2>

                    <p>
                        Search by product,
                        SKU or scan a
                        barcode.
                    </p>
                    </div>

                    <div className="pos-cashier">
                    <span>
                        Cashier
                    </span>

                    <strong>
                        {user.fullName}
                    </strong>
                    </div>
                </div>

                <div className="pos-search-box">
                    <input
                    ref={
                        searchInputRef
                    }
                    value={search}
                    onChange={(event) =>
                        setSearch(
                        event.target
                            .value
                        )
                    }
                    onKeyDown={(
                        event
                    ) => {
                        if (
                        event.key ===
                        "Enter"
                        ) {
                        event.preventDefault();

                        handleSearchEnter();
                        }
                    }}
                    placeholder="Search product, SKU, barcode, size or color..."
                    autoFocus
                    />

                    <span className="scan-hint">
                    Enter ↵
                    </span>
                </div>

                {error && (
                    <div className="pos-alert">
                    {error}
                    </div>
                )}

                <div className="pos-results-heading">
                    <strong>
                    Products
                    </strong>

                    <span>
                    {variants.length}{" "}
                    variant
                    {variants.length ===
                    1
                        ? ""
                        : "s"}
                    </span>
                </div>

                {loading ? (
                    <div className="pos-empty">
                    Loading products...
                    </div>
                ) : variants.length ===
                    0 ? (
                    <div className="pos-empty">
                    <strong>
                        No products found
                    </strong>

                    <p>
                        Try another product,
                        SKU or barcode.
                    </p>
                    </div>
                ) : (
                    <div className="pos-product-grid">
                    {variants.map(
                        (variant) => {
                        const outOfStock =
                            variant.quantityOnHand <=
                            0;

                        return (
                            <button
                            key={
                                variant.variantId
                            }
                            className={`pos-product-card ${
                                outOfStock
                                ? "out-of-stock"
                                : ""
                            }`}
                            disabled={
                                outOfStock
                            }
                            onClick={() =>
                                addToCart(
                                variant
                                )
                            }
                            >
                            <div className="pos-product-card-top">
                                <span className="pos-product-sku">
                                {
                                    variant.sku
                                }
                                </span>

                                <span
                                className={`pos-stock ${
                                    outOfStock
                                    ? "empty"
                                    : ""
                                }`}
                                >
                                {
                                    variant.quantityOnHand
                                }{" "}
                                in stock
                                </span>
                            </div>

                            <div className="pos-product-info">
                                <h3>
                                {
                                    variant.productName
                                }
                                </h3>

                                <p>
                                {variant.brand ||
                                    "No brand"}
                                </p>

                                <div className="variant-tags">
                                {variant.color && (
                                    <span>
                                    {
                                        variant.color
                                    }
                                    </span>
                                )}

                                {variant.size && (
                                    <span>
                                    {
                                        variant.size
                                    }
                                    </span>
                                )}
                                </div>
                            </div>

                            <strong className="pos-product-price">
                                {formatMoney(
                                variant.sellingPricePaisa
                                )}
                            </strong>
                            </button>
                        );
                        }
                    )}
                    </div>
                )}
                </div>

                <aside className="pos-cart">
                <div className="pos-cart-header">
                    <div>
                    <p className="page-eyebrow">
                        CURRENT SALE
                    </p>

                    <h2>Cart</h2>
                    </div>

                    <span className="cart-count">
                    {cartItemCount}{" "}
                    item
                    {cartItemCount ===
                    1
                        ? ""
                        : "s"}
                    </span>
                </div>

                <div className="cart-items">
                    {cart.length ===
                    0 ? (
                    <div className="cart-empty">
                        <strong>
                        Cart is empty
                        </strong>

                        <p>
                        Search or scan a
                        product to begin.
                        </p>
                    </div>
                    ) : (
                    cart.map(
                        (item) => (
                        <div
                            className="cart-item"
                            key={
                            item.variantId
                            }
                        >
                            <div className="cart-item-heading">
                            <div>
                                <strong>
                                {
                                    item.productName
                                }
                                </strong>

                                <span>
                                {
                                    item.sku
                                }
                                {item.color
                                    ? ` • ${item.color}`
                                    : ""}
                                {item.size
                                    ? ` • ${item.size}`
                                    : ""}
                                </span>
                            </div>

                            <button
                                className="cart-remove"
                                onClick={() =>
                                removeItem(
                                    item.variantId
                                )
                                }
                            >
                                ×
                            </button>
                            </div>

                            <div className="cart-item-bottom">
                            <div className="quantity-control">
                                <button
                                onClick={() =>
                                    decreaseQuantity(
                                    item.variantId
                                    )
                                }
                                >
                                −
                                </button>

                                <span>
                                {
                                    item.quantity
                                }
                                </span>

                                <button
                                onClick={() =>
                                    increaseQuantity(
                                    item.variantId
                                    )
                                }
                                >
                                +
                                </button>
                            </div>

                            <div className="cart-item-price">
                                <span>
                                {formatMoney(
                                    item.unitPricePaisa
                                )}
                                {" × "}
                                {
                                    item.quantity
                                }
                                </span>

                                <strong>
                                {formatMoney(
                                    item.unitPricePaisa *
                                    item.quantity
                                )}
                                </strong>
                            </div>
                            </div>
                        </div>
                        )
                    )
                    )}
                </div>

                <div className="cart-calculations">
                    <div className="pos-control-group">
                    <label>
                        Discount
                    </label>

                    <div className="discount-control">
                        <select
                        value={
                            discountMode
                        }
                        onChange={(
                            event
                        ) =>
                            setDiscountMode(
                            event.target
                                .value as
                                DiscountMode
                            )
                        }
                        >
                        <option value="percent">
                            %
                        </option>

                        <option value="fixed">
                            Rs.
                        </option>
                        </select>

                        <input
                        type="number"
                        min="0"
                        step={
                            discountMode ===
                            "percent"
                            ? "0.1"
                            : "0.01"
                        }
                        value={
                            discountValue
                        }
                        onChange={(
                            event
                        ) =>
                            setDiscountValue(
                            event.target
                                .value
                            )
                        }
                        placeholder="0"
                        />
                    </div>
                    </div>

                    <div className="pos-control-group">
                    <label>
                        Tax %
                    </label>

                    <input
                        type="number"
                        min="0"
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
                        placeholder="0"
                    />
                    </div>
                </div>

                <div className="cart-summary">
                    <div>
                    <span>
                        Subtotal
                    </span>

                    <strong>
                        {formatMoney(
                        subtotalPaisa
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
                        discountPaisa
                        )}
                    </strong>
                    </div>

                    <div>
                    <span>Tax</span>

                    <strong>
                        {formatMoney(
                        taxPaisa
                        )}
                    </strong>
                    </div>

                    <div className="cart-total">
                    <span>Total</span>

                    <strong>
                        {formatMoney(
                        totalPaisa
                        )}
                    </strong>
                    </div>
                </div>

                <div className="pos-cart-actions">
                    <button
                    className="clear-cart-button"
                    onClick={
                        clearCart
                    }
                    disabled={
                        cart.length ===
                        0
                    }
                    >
                    Clear
                    </button>

                    <button
                    className="checkout-button"
                    disabled={
                        cart.length ===
                        0
                    }
                    onClick={() => {
                        setError("");
                        setPaymentOpen(true);
                        }}
                    >
                    Payment
                    <span>
                        {formatMoney(
                        totalPaisa
                        )}
                    </span>
                    </button>
                </div>
                </aside>
            </div>
        </section>

            {paymentOpen && (
            <PaymentModal
                totalPaisa={
                totalPaisa
                }
                requireQrReference={
                  requireQrReference
                }
                onCancel={() =>
                setPaymentOpen(
                    false
                )
                }
                onConfirm={
                handleConfirmPayment
                }
            />
            )}

            {completedSale && (
            <SaleCompleteModal
                sale={
                completedSale
                }
                onNewSale={() => {
                setCompletedSale(
                    null
                );

                searchInputRef.current
                    ?.focus();
                }}
            />
            )}
  </>
);
  
}