import { getDatabase } from "../../lib/database";

export interface PosVariant {
  variantId: number;
  productId: number;

  productName: string;
  brand: string | null;

  sku: string;
  barcode: string | null;

  size: string | null;
  color: string | null;

  sellingPricePaisa: number;

  quantityOnHand: number;
}

export async function searchPosVariants(
  search: string
): Promise<PosVariant[]> {
  const db = await getDatabase();

  const cleanSearch = search.trim();

  const likeSearch = `%${cleanSearch}%`;

  const rows = await db.select<PosVariant[]>(
    `
      SELECT
        pv.id AS variantId,
        p.id AS productId,

        p.name AS productName,
        p.brand,

        pv.sku,
        pv.barcode,

        pv.size,
        pv.color,

        pv.selling_price_paisa
          AS sellingPricePaisa,

        i.quantity_on_hand
          AS quantityOnHand

      FROM product_variants pv

      INNER JOIN products p
        ON p.id = pv.product_id

      INNER JOIN inventory i
        ON i.variant_id = pv.id

      WHERE
        p.is_active = 1
        AND pv.is_active = 1

        AND (
          $1 = ''
          OR p.name LIKE $2
          OR pv.sku LIKE $2
          OR pv.barcode LIKE $2
          OR p.brand LIKE $2
          OR pv.color LIKE $2
          OR pv.size LIKE $2
        )

      ORDER BY
        p.name COLLATE NOCASE,
        pv.color COLLATE NOCASE,
        pv.size COLLATE NOCASE

      LIMIT 100;
    `,
    [
      cleanSearch,
      likeSearch,
    ]
  );

  return rows.map((row) => ({
    ...row,

    variantId:
      Number(row.variantId),

    productId:
      Number(row.productId),

    sellingPricePaisa:
      Number(row.sellingPricePaisa),

    quantityOnHand:
      Number(row.quantityOnHand),
  }));
}

export async function findExactVariant(
  value: string
): Promise<PosVariant | null> {
  const db = await getDatabase();

  const cleanValue =
    value.trim();

  if (!cleanValue) {
    return null;
  }

  const rows = await db.select<PosVariant[]>(
    `
      SELECT
        pv.id AS variantId,
        p.id AS productId,

        p.name AS productName,
        p.brand,

        pv.sku,
        pv.barcode,

        pv.size,
        pv.color,

        pv.selling_price_paisa
          AS sellingPricePaisa,

        i.quantity_on_hand
          AS quantityOnHand

      FROM product_variants pv

      INNER JOIN products p
        ON p.id = pv.product_id

      INNER JOIN inventory i
        ON i.variant_id = pv.id

      WHERE
        p.is_active = 1
        AND pv.is_active = 1

        AND (
          LOWER(pv.sku) = LOWER($1)
          OR pv.barcode = $1
        )

      LIMIT 1;
    `,
    [cleanValue]
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...row,

    variantId:
      Number(row.variantId),

    productId:
      Number(row.productId),

    sellingPricePaisa:
      Number(row.sellingPricePaisa),

    quantityOnHand:
      Number(row.quantityOnHand),
  };
}