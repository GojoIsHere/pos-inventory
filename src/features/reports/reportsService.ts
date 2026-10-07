import {
  getDatabase,
} from "../../lib/database";

export interface ReportMetrics {
  revenuePaisa: number;
  transactions: number;
  unitsSold: number;
  averageSalePaisa: number;

  discountPaisa: number;
  taxPaisa: number;

  estimatedGrossProfitPaisa:
    number;
}

export interface PaymentBreakdown {
  method: "cash" | "qr";

  transactions: number;

  amountPaisa: number;
}

export interface DailySales {
  saleDate: string;

  revenuePaisa: number;

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
        SELECT

          COALESCE(
            SUM(
              s.total_paisa
            ),
            0
          ) AS revenuePaisa,

          COUNT(*)
            AS transactions,

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
            CAST(
              AVG(
                s.total_paisa
              )
              AS INTEGER
            ),
            0
          ) AS averageSalePaisa,

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
              (
                s.subtotal_paisa
                -
                s.discount_paisa
              )
              -
              COALESCE(
                (
                  SELECT
                    SUM(
                      si.quantity
                      *
                      pv.cost_price_paisa
                    )

                  FROM sale_items si

                  INNER JOIN
                    product_variants pv
                    ON pv.id =
                      si.variant_id

                  WHERE
                    si.sale_id =
                      s.id
                ),
                0
              )
            ),
            0
          )
            AS estimatedGrossProfitPaisa

        FROM sales s

        WHERE
          s.status =
            'completed'

          AND date(
            s.created_at,
            'localtime'
          )
          BETWEEN $1 AND $2;
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
        SELECT
          p.method,

          COUNT(
            DISTINCT s.id
          ) AS transactions,

          COALESCE(
            SUM(
              p.amount_paisa
            ),
            0
          ) AS amountPaisa

        FROM payments p

        INNER JOIN sales s
          ON s.id =
            p.sale_id

        WHERE
          s.status =
            'completed'

          AND date(
            s.created_at,
            'localtime'
          )
          BETWEEN $1 AND $2

        GROUP BY
          p.method

        ORDER BY
          amountPaisa DESC;
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
        SELECT
          date(
            s.created_at,
            'localtime'
          ) AS saleDate,

          COALESCE(
            SUM(
              s.total_paisa
            ),
            0
          ) AS revenuePaisa,

          COUNT(*)
            AS transactions

        FROM sales s

        WHERE
          s.status =
            'completed'

          AND date(
            s.created_at,
            'localtime'
          )
          BETWEEN $1 AND $2

        GROUP BY
          date(
            s.created_at,
            'localtime'
          )

        ORDER BY
          saleDate ASC;
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
      revenuePaisa:
        Number(
          metrics.revenuePaisa
        ),

      transactions:
        Number(
          metrics.transactions
        ),

      unitsSold:
        Number(
          metrics.unitsSold
        ),

      averageSalePaisa:
        Number(
          metrics.averageSalePaisa
        ),

      discountPaisa:
        Number(
          metrics.discountPaisa
        ),

      taxPaisa:
        Number(
          metrics.taxPaisa
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

          transactions:
            Number(
              row.transactions
            ),

          amountPaisa:
            Number(
              row.amountPaisa
            ),
        })
      ),

    dailySales:
      dailyRows.map(
        (row) => ({
          ...row,

          revenuePaisa:
            Number(
              row.revenuePaisa
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