import { getDatabase } from "../../lib/database";

export interface DashboardMetrics {
  todayRevenuePaisa: number;
  todayTransactions: number;
  todayUnitsSold: number;
  averageSalePaisa: number;

  activeProducts: number;
  lowStockVariants: number;
}

export interface RecentSale {
  id: number;

  receiptNumber: string;
  cashierName: string;

  paymentMethod:
    | "cash"
    | "qr"
    | null;

  totalPaisa: number;

  createdAt: string;
}

export interface LowStockVariant {
  variantId: number;

  productName: string;
  sku: string;

  size: string | null;
  color: string | null;

  quantityOnHand: number;
  reorderLevel: number;
}

export interface TopProduct {
  productId: number;

  productName: string;

  unitsSold: number;
  revenuePaisa: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;

  recentSales: RecentSale[];

  lowStock: LowStockVariant[];

  topProducts: TopProduct[];
}

export async function getDashboardData():
  Promise<DashboardData> {
  const db = await getDatabase();

  const [
    metricRows,
    recentSalesRows,
    lowStockRows,
    topProductRows,
  ] = await Promise.all([
    db.select<DashboardMetrics[]>(
      `
        SELECT

          COALESCE(
            (
              SELECT SUM(total_paisa)

              FROM sales

              WHERE
                status = 'completed'

                AND date(
                  created_at,
                  'localtime'
                ) = date(
                  'now',
                  'localtime'
                )
            ),
            0
          ) AS todayRevenuePaisa,


          (
            SELECT COUNT(*)

            FROM sales

            WHERE
              status = 'completed'

              AND date(
                created_at,
                'localtime'
              ) = date(
                'now',
                'localtime'
              )
          ) AS todayTransactions,


          COALESCE(
            (
              SELECT SUM(
                si.quantity
              )

              FROM sale_items si

              INNER JOIN sales s
                ON s.id =
                  si.sale_id

              WHERE
                s.status =
                  'completed'

                AND date(
                  s.created_at,
                  'localtime'
                ) = date(
                  'now',
                  'localtime'
                )
            ),
            0
          ) AS todayUnitsSold,


          COALESCE(
            (
              SELECT CAST(
                AVG(total_paisa)
                AS INTEGER
              )

              FROM sales

              WHERE
                status = 'completed'

                AND date(
                  created_at,
                  'localtime'
                ) = date(
                  'now',
                  'localtime'
                )
            ),
            0
          ) AS averageSalePaisa,


          (
            SELECT COUNT(*)

            FROM products

            WHERE
              is_active = 1
          ) AS activeProducts,


          (
            SELECT COUNT(*)

            FROM inventory i

            INNER JOIN product_variants pv
              ON pv.id =
                i.variant_id

            INNER JOIN products p
              ON p.id =
                pv.product_id

            WHERE
              pv.is_active = 1
              AND p.is_active = 1

              AND
                i.quantity_on_hand
                  <=
                i.reorder_level
          ) AS lowStockVariants;
      `
    ),

    db.select<RecentSale[]>(
      `
        SELECT
          s.id,

          s.receipt_number
            AS receiptNumber,

          u.full_name
            AS cashierName,

          (
            SELECT
              method

            FROM payments

            WHERE
              sale_id = s.id

            ORDER BY
              id DESC

            LIMIT 1
          ) AS paymentMethod,

          s.total_paisa
            AS totalPaisa,

          s.created_at
            AS createdAt

        FROM sales s

        INNER JOIN users u
          ON u.id =
            s.cashier_id

        WHERE
          s.status =
            'completed'

        ORDER BY
          s.created_at DESC,
          s.id DESC

        LIMIT 6;
      `
    ),

    db.select<LowStockVariant[]>(
      `
        SELECT
          pv.id
            AS variantId,

          p.name
            AS productName,

          pv.sku,

          pv.size,
          pv.color,

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

        WHERE
          pv.is_active = 1
          AND p.is_active = 1

          AND
            i.quantity_on_hand
              <=
            i.reorder_level

        ORDER BY
          i.quantity_on_hand ASC,
          p.name COLLATE NOCASE

        LIMIT 6;
      `
    ),

    db.select<TopProduct[]>(
      `
        SELECT
          p.id
            AS productId,

          p.name
            AS productName,

          SUM(
            si.quantity
          ) AS unitsSold,

          SUM(
            si.line_total_paisa
          ) AS revenuePaisa

        FROM sale_items si

        INNER JOIN sales s
          ON s.id =
            si.sale_id

        INNER JOIN product_variants pv
          ON pv.id =
            si.variant_id

        INNER JOIN products p
          ON p.id =
            pv.product_id

        WHERE
          s.status =
            'completed'

          AND date(
            s.created_at,
            'localtime'
          ) >= date(
            'now',
            'localtime',
            '-29 days'
          )

        GROUP BY
          p.id,
          p.name

        ORDER BY
          unitsSold DESC,
          revenuePaisa DESC

        LIMIT 5;
      `
    ),
  ]);

  const metrics =
    metricRows[0] ?? {
      todayRevenuePaisa: 0,
      todayTransactions: 0,
      todayUnitsSold: 0,
      averageSalePaisa: 0,
      activeProducts: 0,
      lowStockVariants: 0,
    };

  return {
    metrics: {
      todayRevenuePaisa:
        Number(
          metrics.todayRevenuePaisa
        ),

      todayTransactions:
        Number(
          metrics.todayTransactions
        ),

      todayUnitsSold:
        Number(
          metrics.todayUnitsSold
        ),

      averageSalePaisa:
        Number(
          metrics.averageSalePaisa
        ),

      activeProducts:
        Number(
          metrics.activeProducts
        ),

      lowStockVariants:
        Number(
          metrics.lowStockVariants
        ),
    },

    recentSales:
      recentSalesRows.map(
        (sale) => ({
          ...sale,

          id:
            Number(sale.id),

          totalPaisa:
            Number(
              sale.totalPaisa
            ),
        })
      ),

    lowStock:
      lowStockRows.map(
        (item) => ({
          ...item,

          variantId:
            Number(
              item.variantId
            ),

          quantityOnHand:
            Number(
              item.quantityOnHand
            ),

          reorderLevel:
            Number(
              item.reorderLevel
            ),
        })
      ),

    topProducts:
      topProductRows.map(
        (product) => ({
          ...product,

          productId:
            Number(
              product.productId
            ),

          unitsSold:
            Number(
              product.unitsSold
            ),

          revenuePaisa:
            Number(
              product.revenuePaisa
            ),
        })
      ),
  };
}