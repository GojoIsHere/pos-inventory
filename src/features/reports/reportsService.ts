import {
  getDatabase,
} from "../../lib/database";

export interface ReportMetrics {
  grossSalesPaisa: number;

  exchangeRevenuePaisa: number;

  refundsPaisa: number;

  netSalesPaisa: number;

  transactions: number;

  unitsSold: number;

  unitsReturned: number;

  netUnits: number;

  averageSalePaisa: number;

  netDiscountPaisa: number;

  netTaxPaisa: number;

  estimatedGrossProfitPaisa:
    number;
}

export interface PaymentBreakdown {
  method: "cash" | "qr";

  paymentTransactions: number;

  refundTransactions: number;

  collectedPaisa: number;

  refundedPaisa: number;

  netAmountPaisa: number;
}

export interface DailySales {
  saleDate: string;

  grossSalesPaisa: number;

  exchangeRevenuePaisa: number;

  refundsPaisa: number;

  netSalesPaisa: number;

  transactions: number;
}

export interface TopProductReport {
  productId: number;

  productName: string;

  unitsSold: number;

  revenuePaisa: number;
}

export interface CashierReport {
  cashierId: number;

  cashierName: string;

  username: string;

  transactions: number;

  unitsSold: number;

  revenuePaisa: number;
}

export interface ReportsData {
  metrics: ReportMetrics;

  paymentBreakdown:
    PaymentBreakdown[];

  dailySales:
    DailySales[];

  topProducts:
    TopProductReport[];

  cashierPerformance:
    CashierReport[];
}

export async function getReports(
  startDate: string,
  endDate: string
): Promise<ReportsData> {
  const db =
    await getDatabase();

  const [
    metricRows,
    paymentRows,
    dailyRows,
    productRows,
    cashierRows,
  ] = await Promise.all([
    /*
     * Summary metrics
     */
    db.select<ReportMetrics[]>(
        `
            WITH

            sale_activity AS (
            SELECT
                COALESCE(
                SUM(
                    s.total_paisa
                ),
                0
                ) AS grossSalesPaisa,

                COUNT(*)
                AS transactions,

                COALESCE(
                SUM(
                    s.discount_paisa
                ),
                0
                ) AS discountPaisa,

                COALESCE(
                SUM(
                    s.tax_paisa
                ),
                0
                ) AS taxPaisa,

                COALESCE(
                SUM(
                    s.subtotal_paisa
                    -
                    s.discount_paisa
                ),
                0
                ) AS merchandiseRevenuePaisa

            FROM sales s

            WHERE
                s.status IN (
                'completed',
                'partially_refunded',
                'refunded'
                )

                AND date(
                s.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2
            ),

            sold_items AS (
            SELECT
                COALESCE(
                SUM(
                    si.quantity
                ),
                0
                ) AS unitsSold,

                COALESCE(
                SUM(
                    si.quantity
                    *
                    pv.cost_price_paisa
                ),
                0
                ) AS costOfGoodsPaisa

            FROM sale_items si

            INNER JOIN sales s
                ON s.id =
                si.sale_id

            INNER JOIN
                product_variants pv
                ON pv.id =
                si.variant_id

            WHERE
                s.status IN (
                'completed',
                'partially_refunded',
                'refunded'
                )

                AND date(
                s.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2
            ),

            refund_activity AS (
            SELECT
                COALESCE(
                SUM(
                    r.total_refund_paisa
                ),
                0
                ) AS refundsPaisa

            FROM refunds r

            WHERE
                r.status =
                'completed'

                AND date(
                r.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2
            ),

            refunded_items AS (
            SELECT
                COALESCE(
                SUM(
                    ri.quantity
                ),
                0
                ) AS unitsReturned,

                COALESCE(
                SUM(
                    ri.discount_refund_paisa
                ),
                0
                ) AS discountReturnedPaisa,

                COALESCE(
                SUM(
                    ri.tax_refund_paisa
                ),
                0
                ) AS taxReturnedPaisa,

                COALESCE(
                SUM(
                    ri.refund_amount_paisa
                    -
                    ri.tax_refund_paisa
                ),
                0
                ) AS merchandiseRefundedPaisa,

                COALESCE(
                SUM(
                    ri.quantity
                    *
                    pv.cost_price_paisa
                ),
                0
                ) AS returnedCostPaisa

            FROM refund_items ri

            INNER JOIN refunds r
                ON r.id =
                ri.refund_id

            INNER JOIN
                product_variants pv
                ON pv.id =
                ri.variant_id

            WHERE
                r.status =
                'completed'

                AND date(
                r.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2
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
                )
                BETWEEN $1 AND $2
            ),

            exchange_profit AS (
            SELECT
                COALESCE(
                SUM(
                    (
                    ei.replacement_unit_price_paisa
                    -
                    ei.original_unit_price_paisa
                    )
                    *
                    ei.quantity

                    +

                    (
                    returned_variant.cost_price_paisa
                    *
                    ei.quantity
                    )

                    -

                    (
                    replacement_variant.cost_price_paisa
                    *
                    ei.quantity
                    )
                ),
                0
                ) AS exchangeProfitAdjustmentPaisa

            FROM exchange_items ei

            INNER JOIN exchanges e
                ON e.id =
                ei.exchange_id

            INNER JOIN
                product_variants
                returned_variant
                ON returned_variant.id =
                ei.returned_variant_id

            INNER JOIN
                product_variants
                replacement_variant
                ON replacement_variant.id =
                ei.replacement_variant_id

            WHERE
                e.status =
                'completed'

                AND date(
                e.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2
            )

            SELECT
            sa.grossSalesPaisa,

            ea.exchangeRevenuePaisa,

            ra.refundsPaisa,

            (
                sa.grossSalesPaisa
                +
                ea.exchangeRevenuePaisa
                -
                ra.refundsPaisa
            ) AS netSalesPaisa,

            sa.transactions,

            si.unitsSold,

            ri.unitsReturned,

            (
                si.unitsSold
                -
                ri.unitsReturned
            ) AS netUnits,

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
                    ra.refundsPaisa
                    )
                    /
                    sa.transactions

                    AS INTEGER
                )

                ELSE 0
            END
                AS averageSalePaisa,

            (
                sa.discountPaisa
                -
                ri.discountReturnedPaisa
            ) AS netDiscountPaisa,

            (
                sa.taxPaisa
                -
                ri.taxReturnedPaisa
            ) AS netTaxPaisa,

            (
                (
                sa.merchandiseRevenuePaisa
                -
                si.costOfGoodsPaisa
                )

                -

                (
                ri.merchandiseRefundedPaisa
                -
                ri.returnedCostPaisa
                )

                +

                ep.exchangeProfitAdjustmentPaisa
            )
                AS estimatedGrossProfitPaisa

            FROM sale_activity sa

            CROSS JOIN sold_items si

            CROSS JOIN refund_activity ra

            CROSS JOIN refunded_items ri

            CROSS JOIN exchange_activity ea

            CROSS JOIN exchange_profit ep;
        `,
        [
            startDate,
            endDate,
        ]
        ),

    /*
     * Cash vs QR
     */
    db.select<
        PaymentBreakdown[]
        >(
        `
            WITH payment_activity AS (

            SELECT
                p.method,

                COUNT(*)
                AS paymentTransactions,

                0
                AS refundTransactions,

                COALESCE(
                SUM(
                    p.amount_paisa
                ),
                0
                ) AS collectedPaisa,

                0
                AS refundedPaisa

            FROM payments p

            INNER JOIN sales s
                ON s.id =
                p.sale_id

            WHERE
                s.status IN (
                'completed',
                'partially_refunded',
                'refunded'
                )

                AND date(
                p.confirmed_at,
                'localtime'
                )
                BETWEEN $1 AND $2

            GROUP BY
                p.method


            UNION ALL


            SELECT
                ep.method,

                COUNT(*),

                0,

                COALESCE(
                SUM(
                    ep.amount_paisa
                ),
                0
                ),

                0

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
                )
                BETWEEN $1 AND $2

            GROUP BY
                ep.method


            UNION ALL


            SELECT
                rp.method,

                0,

                COUNT(*),

                0,

                COALESCE(
                SUM(
                    rp.amount_paisa
                ),
                0
                )

            FROM refund_payments rp

            INNER JOIN refunds r
                ON r.id =
                rp.refund_id

            WHERE
                r.status =
                'completed'

                AND date(
                rp.processed_at,
                'localtime'
                )
                BETWEEN $1 AND $2

            GROUP BY
                rp.method
            )

            SELECT
            method,

            SUM(
                paymentTransactions
            ) AS paymentTransactions,

            SUM(
                refundTransactions
            ) AS refundTransactions,

            SUM(
                collectedPaisa
            ) AS collectedPaisa,

            SUM(
                refundedPaisa
            ) AS refundedPaisa,

            (
                SUM(
                collectedPaisa
                )
                -
                SUM(
                refundedPaisa
                )
            ) AS netAmountPaisa

            FROM payment_activity

            GROUP BY method

            ORDER BY
            netAmountPaisa DESC;
        `,
        [
            startDate,
            endDate,
        ]
        ),

    /*
     * Daily revenue
     */
    db.select<
        DailySales[]
        >(
        `
            WITH daily_activity AS (

            SELECT
                date(
                s.created_at,
                'localtime'
                ) AS saleDate,

                SUM(
                s.total_paisa
                ) AS grossSalesPaisa,

                0 AS exchangeRevenuePaisa,

                0 AS refundsPaisa,

                COUNT(*)
                AS transactions

            FROM sales s

            WHERE
                s.status IN (
                'completed',
                'partially_refunded',
                'refunded'
                )

                AND date(
                s.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2

            GROUP BY saleDate


            UNION ALL


            SELECT
                date(
                ep.confirmed_at,
                'localtime'
                ),

                0,

                SUM(
                ep.amount_paisa
                ),

                0,

                0

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
                )
                BETWEEN $1 AND $2

            GROUP BY
                date(
                ep.confirmed_at,
                'localtime'
                )


            UNION ALL


            SELECT
                date(
                r.created_at,
                'localtime'
                ),

                0,

                0,

                SUM(
                r.total_refund_paisa
                ),

                0

            FROM refunds r

            WHERE
                r.status =
                'completed'

                AND date(
                r.created_at,
                'localtime'
                )
                BETWEEN $1 AND $2

            GROUP BY
                date(
                r.created_at,
                'localtime'
                )
            )

            SELECT
            saleDate,

            SUM(
                grossSalesPaisa
            ) AS grossSalesPaisa,

            SUM(
                exchangeRevenuePaisa
            ) AS exchangeRevenuePaisa,

            SUM(
                refundsPaisa
            ) AS refundsPaisa,

            (
                SUM(
                grossSalesPaisa
                )
                +
                SUM(
                exchangeRevenuePaisa
                )
                -
                SUM(
                refundsPaisa
                )
            ) AS netSalesPaisa,

            SUM(
                transactions
            ) AS transactions

            FROM daily_activity

            GROUP BY saleDate

            ORDER BY saleDate ASC;
        `,
        [
            startDate,
            endDate,
        ]
        ),

    /*
     * Best-selling products
     */
    db.select<
      TopProductReport[]
    >(
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

        INNER JOIN
          product_variants pv
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
          )
          BETWEEN $1 AND $2

        GROUP BY
          p.id,
          p.name

        ORDER BY
          unitsSold DESC,
          revenuePaisa DESC

        LIMIT 10;
      `,
      [
        startDate,
        endDate,
      ]
    ),

    /*
     * Cashier performance
     */
    db.select<
      CashierReport[]
    >(
      `
        SELECT
          u.id
            AS cashierId,

          u.full_name
            AS cashierName,

          u.username,

          COUNT(
            s.id
          ) AS transactions,

          COALESCE(
            SUM(
              (
                SELECT
                  COALESCE(
                    SUM(
                      si.quantity
                    ),
                    0
                  )

                FROM sale_items si

                WHERE
                  si.sale_id =
                    s.id
              )
            ),
            0
          ) AS unitsSold,

          COALESCE(
            SUM(
              s.total_paisa
            ),
            0
          ) AS revenuePaisa

        FROM sales s

        INNER JOIN users u
          ON u.id =
            s.cashier_id

        WHERE
          s.status =
            'completed'

          AND date(
            s.created_at,
            'localtime'
          )
          BETWEEN $1 AND $2

        GROUP BY
          u.id,
          u.full_name,
          u.username

        ORDER BY
          revenuePaisa DESC;
      `,
      [
        startDate,
        endDate,
      ]
    ),
  ]);

  const metrics =
    metricRows[0] ?? {
      revenuePaisa: 0,
      transactions: 0,
      unitsSold: 0,
      averageSalePaisa: 0,

      discountPaisa: 0,
      taxPaisa: 0,

      estimatedGrossProfitPaisa:
        0,
    };

  return {
    metrics: {
        grossSalesPaisa:
            Number(
            metrics.grossSalesPaisa
            ),

        exchangeRevenuePaisa:
            Number(
            metrics.exchangeRevenuePaisa
            ),

        refundsPaisa:
            Number(
            metrics.refundsPaisa
            ),

        netSalesPaisa:
            Number(
            metrics.netSalesPaisa
            ),

        transactions:
            Number(
            metrics.transactions
            ),

        unitsSold:
            Number(
            metrics.unitsSold
            ),

        unitsReturned:
            Number(
            metrics.unitsReturned
            ),

        netUnits:
            Number(
            metrics.netUnits
            ),

        averageSalePaisa:
            Number(
            metrics.averageSalePaisa
            ),

        netDiscountPaisa:
            Number(
            metrics.netDiscountPaisa
            ),

        netTaxPaisa:
            Number(
            metrics.netTaxPaisa
            ),

        estimatedGrossProfitPaisa:
            Number(
            metrics
                .estimatedGrossProfitPaisa
            ),
        },

    paymentBreakdown:
        paymentRows.map(
            (row) => ({
            ...row,

            paymentTransactions:
                Number(
                row.paymentTransactions
                ),

            refundTransactions:
                Number(
                row.refundTransactions
                ),

            collectedPaisa:
                Number(
                row.collectedPaisa
                ),

            refundedPaisa:
                Number(
                row.refundedPaisa
                ),

            netAmountPaisa:
                Number(
                row.netAmountPaisa
                ),
            })
        ),

    dailySales:
        dailyRows.map(
            (row) => ({
            ...row,

            grossSalesPaisa:
                Number(
                row.grossSalesPaisa
                ),

            exchangeRevenuePaisa:
                Number(
                row.exchangeRevenuePaisa
                ),

            refundsPaisa:
                Number(
                row.refundsPaisa
                ),

            netSalesPaisa:
                Number(
                row.netSalesPaisa
                ),

            transactions:
                Number(
                row.transactions
                ),
            })
        ),

    topProducts:
      productRows.map(
        (row) => ({
          ...row,

          productId:
            Number(
              row.productId
            ),

          unitsSold:
            Number(
              row.unitsSold
            ),

          revenuePaisa:
            Number(
              row.revenuePaisa
            ),
        })
      ),

    cashierPerformance:
      cashierRows.map(
        (row) => ({
          ...row,

          cashierId:
            Number(
              row.cashierId
            ),

          transactions:
            Number(
              row.transactions
            ),

          unitsSold:
            Number(
              row.unitsSold
            ),

          revenuePaisa:
            Number(
              row.revenuePaisa
            ),
        })
      ),
  };
}