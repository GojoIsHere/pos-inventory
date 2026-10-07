import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "../../lib/database";

export type InventoryFilter =
  | "all"
  | "low"
  | "out";

export type InventoryMovementType =
  | "initial_stock"
  | "restock"
  | "sale"
  | "return"
  | "adjustment";

export interface InventoryVariant {
  variantId: number;
  productId: number;

  productName: string;
  categoryName: string | null;
  brand: string | null;

  sku: string;
  barcode: string | null;

  size: string | null;
  color: string | null;

  costPricePaisa: number;
  sellingPricePaisa: number;

  quantityOnHand: number;
  reorderLevel: number;
}

export interface InventorySummary {
  totalVariants: number;
  totalUnits: number;

  lowStockVariants: number;
  outOfStockVariants: number;

  stockCostValuePaisa: number;
}

export interface InventoryMovement {
  id: number;

  movementType:
    InventoryMovementType;

  quantityChange: number;

  referenceType:
    string | null;

  referenceId:
    number | null;

  note:
    string | null;

  createdByName:
    string | null;

  createdAt: string;
}

export async function getInventory(
  search = "",
  filter: InventoryFilter = "all"
): Promise<InventoryVariant[]> {
  const db = await getDatabase();

  const cleanSearch =
    search.trim();

  const likeSearch =
    `%${cleanSearch}%`;

  const rows =
    await db.select<
      InventoryVariant[]
    >(
      `
        SELECT
          pv.id
            AS variantId,

          p.id
            AS productId,

          p.name
            AS productName,

          c.name
            AS categoryName,

          p.brand,

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

        FROM inventory i

        INNER JOIN product_variants pv
          ON pv.id =
            i.variant_id

        INNER JOIN products p
          ON p.id =
            pv.product_id

        LEFT JOIN categories c
          ON c.id =
            p.category_id

        WHERE
          p.is_active = 1
          AND pv.is_active = 1

          AND (
            $1 = ''

            OR p.name
              LIKE $2

            OR pv.sku
              LIKE $2

            OR COALESCE(
              pv.barcode,
              ''
            ) LIKE $2

            OR COALESCE(
              p.brand,
              ''
            ) LIKE $2

            OR COALESCE(
              pv.color,
              ''
            ) LIKE $2

            OR COALESCE(
              pv.size,
              ''
            ) LIKE $2
          )

          AND (
            $3 = 'all'

            OR (
              $3 = 'low'

              AND i.quantity_on_hand
                <=
                i.reorder_level
            )

            OR (
              $3 = 'out'

              AND i.quantity_on_hand = 0
            )
          )

        ORDER BY
          CASE
            WHEN
              i.quantity_on_hand = 0
            THEN 0

            WHEN
              i.quantity_on_hand
                <=
              i.reorder_level
            THEN 1

            ELSE 2
          END,

          p.name COLLATE NOCASE,

          pv.sku COLLATE NOCASE;
      `,
      [
        cleanSearch,
        likeSearch,
        filter,
      ]
    );

  return rows.map(
    (row) => ({
      ...row,

      variantId:
        Number(row.variantId),

      productId:
        Number(row.productId),

      costPricePaisa:
        Number(
          row.costPricePaisa
        ),

      sellingPricePaisa:
        Number(
          row.sellingPricePaisa
        ),

      quantityOnHand:
        Number(
          row.quantityOnHand
        ),

      reorderLevel:
        Number(
          row.reorderLevel
        ),
    })
  );
}

export async function getInventorySummary():
  Promise<InventorySummary> {
  const db = await getDatabase();

  const rows =
    await db.select<
      InventorySummary[]
    >(
      `
        SELECT
          COUNT(*)
            AS totalVariants,

          COALESCE(
            SUM(
              i.quantity_on_hand
            ),
            0
          ) AS totalUnits,

          SUM(
            CASE
              WHEN
                i.quantity_on_hand
                  <=
                i.reorder_level

              THEN 1
              ELSE 0
            END
          ) AS lowStockVariants,

          SUM(
            CASE
              WHEN
                i.quantity_on_hand = 0

              THEN 1
              ELSE 0
            END
          ) AS outOfStockVariants,

          COALESCE(
            SUM(
              i.quantity_on_hand
              *
              pv.cost_price_paisa
            ),
            0
          ) AS stockCostValuePaisa

        FROM inventory i

        INNER JOIN product_variants pv
          ON pv.id =
            i.variant_id

        INNER JOIN products p
          ON p.id =
            pv.product_id

        WHERE
          p.is_active = 1
          AND pv.is_active = 1;
      `
    );

  const summary =
    rows[0];

  return {
    totalVariants:
      Number(
        summary?.totalVariants ??
          0
      ),

    totalUnits:
      Number(
        summary?.totalUnits ??
          0
      ),

    lowStockVariants:
      Number(
        summary
          ?.lowStockVariants ??
          0
      ),

    outOfStockVariants:
      Number(
        summary
          ?.outOfStockVariants ??
          0
      ),

    stockCostValuePaisa:
      Number(
        summary
          ?.stockCostValuePaisa ??
          0
      ),
  };
}

export async function getVariantMovements(
  variantId: number
): Promise<
  InventoryMovement[]
> {
  const db = await getDatabase();

  const rows =
    await db.select<
      InventoryMovement[]
    >(
      `
        SELECT
          im.id,

          im.movement_type
            AS movementType,

          im.quantity_change
            AS quantityChange,

          im.reference_type
            AS referenceType,

          im.reference_id
            AS referenceId,

          im.note,

          u.full_name
            AS createdByName,

          im.created_at
            AS createdAt

        FROM inventory_movements im

        LEFT JOIN users u
          ON u.id =
            im.created_by

        WHERE
          im.variant_id = $1

        ORDER BY
          im.created_at DESC,
          im.id DESC;
      `,
      [variantId]
    );

  return rows.map(
    (row) => ({
      ...row,

      id:
        Number(row.id),

      quantityChange:
        Number(
          row.quantityChange
        ),

      referenceId:
        row.referenceId === null
          ? null
          : Number(
              row.referenceId
            ),
    })
  );
}

export async function changeInventory(
  variantId: number,
  movementType:
    | "restock"
    | "adjustment",
  quantityChange: number,
  note: string,
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