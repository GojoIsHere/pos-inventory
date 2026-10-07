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