import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "../../lib/database";

export interface Category {
  id: number;
  name: string;
}

export interface ProductSummary {
  id: number;
  name: string;
  brand: string | null;
  categoryName: string | null;
  variantCount: number;
  totalStock: number;
  minPricePaisa: number;
  maxPricePaisa: number;
}

export interface ProductVariantInput {
  size: string | null;
  color: string | null;

  sku: string;
  barcode: string | null;

  costPricePaisa: number;
  sellingPricePaisa: number;

  initialStock: number;
  reorderLevel: number;
}

export interface CreateProductInput {
  name: string;
  categoryId: number | null;

  brand: string | null;
  description: string | null;

  variants: ProductVariantInput[];

  createdBy: number;
}

export async function getCategories():
  Promise<Category[]> {
  const db = await getDatabase();

  const rows = await db.select<Category[]>(
    `
      SELECT id, name
      FROM categories
      ORDER BY name COLLATE NOCASE;
    `
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
  }));
}

export async function createCategory(
  name: string,
  createdBy: number
): Promise<number> {
  return invoke<number>("create_category", {
    name,
    createdBy,
  });
}

export async function getProducts():
  Promise<ProductSummary[]> {
  const db = await getDatabase();

  const rows =
    await db.select<ProductSummary[]>(
      `
        SELECT
          p.id,
          p.name,
          p.brand,
          c.name AS categoryName,

          COUNT(pv.id) AS variantCount,

          COALESCE(
            SUM(i.quantity_on_hand),
            0
          ) AS totalStock,

          COALESCE(
            MIN(pv.selling_price_paisa),
            0
          ) AS minPricePaisa,

          COALESCE(
            MAX(pv.selling_price_paisa),
            0
          ) AS maxPricePaisa

        FROM products p

        LEFT JOIN categories c
          ON c.id = p.category_id

        LEFT JOIN product_variants pv
          ON pv.product_id = p.id
          AND pv.is_active = 1

        LEFT JOIN inventory i
          ON i.variant_id = pv.id

        WHERE p.is_active = 1

        GROUP BY
          p.id,
          p.name,
          p.brand,
          c.name

        ORDER BY
          p.created_at DESC,
          p.id DESC;
      `
    );

  return rows.map((row) => ({
    ...row,

    id: Number(row.id),

    variantCount:
      Number(row.variantCount),

    totalStock:
      Number(row.totalStock),

    minPricePaisa:
      Number(row.minPricePaisa),

    maxPricePaisa:
      Number(row.maxPricePaisa),
  }));
}

export async function createProduct(
  input: CreateProductInput
): Promise<number> {
  return invoke<number>(
    "create_product",
    {
      input,
    }
  );
}

export interface ProductVariantDetails {
  id: number;

  sku: string;
  barcode: string | null;

  size: string | null;
  color: string | null;

  costPricePaisa: number;
  sellingPricePaisa: number;

  quantityOnHand: number;
  reorderLevel: number;
}

export interface ProductDetails {
  id: number;

  name: string;
  brand: string | null;
  description: string | null;

  categoryName: string | null;

  variants: ProductVariantDetails[];
}

export interface InventoryMovement {
  id: number;

  variantId: number;
  sku: string;

  movementType: string;
  quantityChange: number;

  note: string | null;

  createdByName: string | null;
  createdAt: string;
}

export async function getProductDetails(
  productId: number
): Promise<ProductDetails> {
  const db = await getDatabase();

  const products = await db.select<
    {
      id: number;
      name: string;
      brand: string | null;
      description: string | null;
      categoryName: string | null;
    }[]
  >(
    `
      SELECT
        p.id,
        p.name,
        p.brand,
        p.description,
        c.name AS categoryName

      FROM products p

      LEFT JOIN categories c
        ON c.id = p.category_id

      WHERE p.id = $1
      LIMIT 1;
    `,
    [productId]
  );

  const product = products[0];

  if (!product) {
    throw new Error(
      "Product not found."
    );
  }

  const variants = await db.select<
    {
      id: number;

      sku: string;
      barcode: string | null;

      size: string | null;
      color: string | null;

      costPricePaisa: number;
      sellingPricePaisa: number;

      quantityOnHand: number;
      reorderLevel: number;
    }[]
  >(
    `
      SELECT
        pv.id,
        pv.sku,
        pv.barcode,

        pv.size,
        pv.color,

        pv.cost_price_paisa
          AS costPricePaisa,

        pv.selling_price_paisa
          AS sellingPricePaisa,

        i.quantity_on_hand
          AS quantityOnHand,

        i.reorder_level
          AS reorderLevel

      FROM product_variants pv

      INNER JOIN inventory i
        ON i.variant_id = pv.id

      WHERE
        pv.product_id = $1
        AND pv.is_active = 1

      ORDER BY
        pv.color,
        pv.size,
        pv.id;
    `,
    [productId]
  );

  return {
    ...product,

    id: Number(product.id),

    variants: variants.map(
      (variant) => ({
        ...variant,

        id:
          Number(variant.id),

        costPricePaisa:
          Number(
            variant.costPricePaisa
          ),

        sellingPricePaisa:
          Number(
            variant.sellingPricePaisa
          ),

        quantityOnHand:
          Number(
            variant.quantityOnHand
          ),

        reorderLevel:
          Number(
            variant.reorderLevel
          ),
      })
    ),
  };
}

export async function getInventoryMovements(
  productId: number
): Promise<InventoryMovement[]> {
  const db = await getDatabase();

  const rows =
    await db.select<
      InventoryMovement[]
    >(
      `
        SELECT
          im.id,

          im.variant_id
            AS variantId,

          pv.sku,

          im.movement_type
            AS movementType,

          im.quantity_change
            AS quantityChange,

          im.note,

          u.full_name
            AS createdByName,

          im.created_at
            AS createdAt

        FROM inventory_movements im

        INNER JOIN product_variants pv
          ON pv.id = im.variant_id

        LEFT JOIN users u
          ON u.id = im.created_by

        WHERE pv.product_id = $1

        ORDER BY
          im.created_at DESC,
          im.id DESC

        LIMIT 50;
      `,
      [productId]
    );

  return rows.map((row) => ({
    ...row,

    id:
      Number(row.id),

    variantId:
      Number(row.variantId),

    quantityChange:
      Number(row.quantityChange),
  }));
}
export async function changeInventory(
  variantId: number,
  movementType:
    | "restock"
    | "adjustment",
  quantityChange: number,
  note: string | null,
  createdBy: number
): Promise<number> {
  return invoke<number>(
    "change_inventory",
    {
      variantId,
      movementType,
      quantityChange,
      note,
      createdBy,
    }
  );
}