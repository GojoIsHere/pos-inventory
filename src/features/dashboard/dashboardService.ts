import { getDatabase } from "../../lib/database";

export interface DashboardMetrics {
  grossSalesPaisa: number;

  refundPaisa: number;

  exchangeRevenuePaisa: number;

  netSalesPaisa: number;

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

  status:
    | "completed"
    | "partially_refunded"
    | "refunded";
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
        WITH
        sale_activity AS (
          SELECT
            COALESCE(
              SUM(total_paisa),
              0
            ) AS grossSalesPaisa,

            COUNT(*)
              AS transactions

          FROM sales

          WHERE
            status IN (
              'completed',
              'partially_refunded',
              'refunded'
            )

            AND date(
              created_at,
              'localtime'
            ) = date(
              'now',
              'localtime'
            )
        ),

        refund_activity AS (
          SELECT
            COALESCE(
              SUM(
                total_refund_paisa
              ),
              0
            ) AS refundPaisa

          FROM refunds

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

        exchange_activity AS (
          SELECT
            COALESCE(
              SUM(
                ep.amount_paisa
              ),
              0
            ) AS exchangeRevenuePaisa

          FROM exchange_payments ep

          INNER JOIN exchanges e
            ON e.id =
              ep.exchange_id

          WHERE
            e.status =
              'completed'

            AND date(
              ep.confirmed_at,
              'localtime'
            ) = date(
              'now',
              'localtime'
            )
        ),

        unit_activity AS (
          SELECT
            COALESCE(
              SUM(
                si.quantity
              ),
              0
            ) AS todayUnitsSold

          FROM sale_items si

          INNER JOIN sales s
            ON s.id =
              si.sale_id

          WHERE
            s.status IN (
              'completed',
              'partially_refunded',
              'refunded'
            )

            AND date(
              s.created_at,
              'localtime'
            ) = date(
              'now',
              'localtime'
            )
        )

        SELECT
          sa.grossSalesPaisa,

          ra.refundPaisa,

          ea.exchangeRevenuePaisa,

          (
            sa.grossSalesPaisa
            +
            ea.exchangeRevenuePaisa
            -
            ra.refundPaisa
          ) AS netSalesPaisa,

          sa.transactions
            AS todayTransactions,

          ua.todayUnitsSold,

          CASE
            WHEN
              sa.transactions > 0
            THEN
              CAST(
                (
                  sa.grossSalesPaisa
                  +
                  ea.exchangeRevenuePaisa
                  -
                  ra.refundPaisa
                )
                /
                sa.transactions

                AS INTEGER
              )

            ELSE 0
          END
            AS averageSalePaisa,

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
          ) AS lowStockVariants

        FROM sale_activity sa

        CROSS JOIN refund_activity ra
        CROSS JOIN exchange_activity ea
        CROSS JOIN unit_activity ua;
      `
    ),

    db.select<RecentSale[]>(
      `
        SELECT
          s.id, s.status,

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
          s.status IN (
            'completed',
            'partially_refunded',
            'refunded'
          )

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
      grossSalesPaisa:
        Number(
          metrics.grossSalesPaisa
        ),

      refundPaisa:
        Number(
          metrics.refundPaisa
        ),

      exchangeRevenuePaisa:
        Number(
          metrics.exchangeRevenuePaisa
        ),

      netSalesPaisa:
        Number(
          metrics.netSalesPaisa
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