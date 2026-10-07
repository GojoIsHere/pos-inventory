import { getDatabase } from "../../lib/database";

export type SaleStatus =
  | "completed"
  | "voided"
  | "refunded"
  | "partially_refunded";

export type SalePaymentMethod =
  | "cash"
  | "qr";

export interface SaleSummary {
  id: number;

  receiptNumber: string;
  createdAt: string;

  cashierName: string;
  cashierUsername: string;

  paymentMethod:
    SalePaymentMethod | null;

  totalPaisa: number;

  status: SaleStatus;
}

export interface SaleItemDetails {
  id: number;

  productName: string;
  sku: string;

  size: string | null;
  color: string | null;

  quantity: number;

  unitPricePaisa: number;
  lineTotalPaisa: number;
}

export interface SaleDetails {
  id: number;

  receiptNumber: string;
  createdAt: string;

  cashierName: string;
  cashierUsername: string;

  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  totalPaisa: number;

  status: SaleStatus;

  paymentMethod:
    SalePaymentMethod | null;

  paymentReference:
    string | null;

  cashReceivedPaisa:
    number | null;

  changePaisa:
    number | null;

  paymentConfirmedAt:
    string | null;

  items: SaleItemDetails[];
}

export async function getSales(
  search = "",
  paymentMethod = "",
  status = ""
): Promise<SaleSummary[]> {
  const db = await getDatabase();

  const cleanSearch =
    search.trim();

  const likeSearch =
    `%${cleanSearch}%`;

  const rows =
    await db.select<SaleSummary[]>(
      `
        SELECT
          s.id,

          s.receipt_number
            AS receiptNumber,

          s.created_at
            AS createdAt,

          u.full_name
            AS cashierName,

          u.username
            AS cashierUsername,

          p.method
            AS paymentMethod,

          s.total_paisa
            AS totalPaisa,

          s.status

        FROM sales s

        INNER JOIN users u
          ON u.id = s.cashier_id

        LEFT JOIN payments p
          ON p.sale_id = s.id

        WHERE
          (
            $1 = ''
            OR s.receipt_number
              LIKE $2
            OR u.full_name
              LIKE $2
            OR u.username
              LIKE $2
          )

          AND (
            $3 = ''
            OR p.method = $3
          )

          AND (
            $4 = ''
            OR s.status = $4
          )

        ORDER BY
          s.created_at DESC,
          s.id DESC

        LIMIT 200;
      `,
      [
        cleanSearch,
        likeSearch,
        paymentMethod,
        status,
      ]
    );

  return rows.map(
    (row) => ({
      ...row,

      id:
        Number(row.id),

      totalPaisa:
        Number(row.totalPaisa),
    })
  );
}

export async function getSaleDetails(
  saleId: number
): Promise<SaleDetails> {
  const db = await getDatabase();

  const sales = await db.select<
    {
      id: number;

      receiptNumber: string;
      createdAt: string;

      cashierName: string;
      cashierUsername: string;

      subtotalPaisa: number;
      discountPaisa: number;
      taxPaisa: number;
      totalPaisa: number;

      status: SaleStatus;

      paymentMethod:
        SalePaymentMethod | null;

      paymentReference:
        string | null;

      cashReceivedPaisa:
        number | null;

      changePaisa:
        number | null;

      paymentConfirmedAt:
        string | null;
    }[]
  >(
    `
      SELECT
        s.id,

        s.receipt_number
          AS receiptNumber,

        s.created_at
          AS createdAt,

        u.full_name
          AS cashierName,

        u.username
          AS cashierUsername,

        s.subtotal_paisa
          AS subtotalPaisa,

        s.discount_paisa
          AS discountPaisa,

        s.tax_paisa
          AS taxPaisa,

        s.total_paisa
          AS totalPaisa,

        s.status,

        p.method
          AS paymentMethod,

        p.reference_number
          AS paymentReference,

        p.cash_received_paisa
          AS cashReceivedPaisa,

        p.change_paisa
          AS changePaisa,

        p.confirmed_at
          AS paymentConfirmedAt

      FROM sales s

      INNER JOIN users u
        ON u.id = s.cashier_id

      LEFT JOIN payments p
        ON p.sale_id = s.id

      WHERE s.id = $1

      LIMIT 1;
    `,
    [saleId]
  );

  const sale = sales[0];

  if (!sale) {
    throw new Error(
      "Sale not found."
    );
  }

  const items =
    await db.select<
      SaleItemDetails[]
    >(
      `
        SELECT
          id,

          product_name
            AS productName,

          sku,

          size,
          color,

          quantity,

          unit_price_paisa
            AS unitPricePaisa,

          line_total_paisa
            AS lineTotalPaisa

        FROM sale_items

        WHERE sale_id = $1

        ORDER BY id;
      `,
      [saleId]
    );

  return {
    ...sale,

    id:
      Number(sale.id),

    subtotalPaisa:
      Number(
        sale.subtotalPaisa
      ),

    discountPaisa:
      Number(
        sale.discountPaisa
      ),

    taxPaisa:
      Number(
        sale.taxPaisa
      ),

    totalPaisa:
      Number(
        sale.totalPaisa
      ),

    cashReceivedPaisa:
      sale.cashReceivedPaisa ===
      null
        ? null
        : Number(
            sale.cashReceivedPaisa
          ),

    changePaisa:
      sale.changePaisa === null
        ? null
        : Number(
            sale.changePaisa
          ),

    items:
      items.map(
        (item) => ({
          ...item,

          id:
            Number(item.id),

          quantity:
            Number(
              item.quantity
            ),

          unitPricePaisa:
            Number(
              item.unitPricePaisa
            ),

          lineTotalPaisa:
            Number(
              item.lineTotalPaisa
            ),
        })
      ),
  };
}