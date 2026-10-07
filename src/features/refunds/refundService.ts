import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getDatabase,
} from "../../lib/database";

export type RefundMethod =
  | "cash"
  | "qr";

export interface RefundPreview {
  saleItemId: number;
  saleId: number;

  receiptNumber: string;

  variantId: number;

  productName: string;
  sku: string;

  size: string | null;
  color: string | null;

  originalQuantity: number;

  alreadyRefunded: number;
  alreadyExchanged: number;

  refundableQuantity: number;

  unitPricePaisa: number;

  lineTotalPaisa: number;

  saleSubtotalPaisa: number;
  saleDiscountPaisa: number;
  saleTaxPaisa: number;
}

export interface CompleteRefundResult {
  refundId: number;

  originalReceiptNumber:
    string;

  productName: string;

  sku: string;

  size: string | null;
  color: string | null;

  quantity: number;

  grossAmountPaisa: number;

  discountRefundPaisa:
    number;

  taxRefundPaisa: number;

  refundAmountPaisa:
    number;

  refundMethod:
    RefundMethod;

  saleStatus:
    string;
}

function roundRatio(
  amount: number,
  numerator: number,
  denominator: number
): number {
  if (
    denominator <= 0
  ) {
    return 0;
  }

  return Math.round(
    (
      amount *
      numerator
    ) /
      denominator
  );
}

export function calculateRefundAmount(
  preview: RefundPreview,
  quantity: number
) {
  const fullDiscount =
    preview
      .saleSubtotalPaisa >
    0
      ? roundRatio(
          preview
            .saleDiscountPaisa,

          preview
            .lineTotalPaisa,

          preview
            .saleSubtotalPaisa
        )
      : 0;

  const totalTaxable =
    preview
      .saleSubtotalPaisa
    -
    preview
      .saleDiscountPaisa;

  const lineTaxable =
    preview
      .lineTotalPaisa
    -
    fullDiscount;

  const fullTax =
    totalTaxable > 0
      ? roundRatio(
          preview
            .saleTaxPaisa,

          lineTaxable,

          totalTaxable
        )
      : 0;

  const before =
    preview.alreadyRefunded;

  const after =
    before + quantity;

  const discountBefore =
    roundRatio(
      fullDiscount,
      before,
      preview.originalQuantity
    );

  const discountAfter =
    roundRatio(
      fullDiscount,
      after,
      preview.originalQuantity
    );

  const taxBefore =
    roundRatio(
      fullTax,
      before,
      preview.originalQuantity
    );

  const taxAfter =
    roundRatio(
      fullTax,
      after,
      preview.originalQuantity
    );

  const discount =
    discountAfter -
    discountBefore;

  const tax =
    taxAfter -
    taxBefore;

  const gross =
    preview.unitPricePaisa
    * quantity;

  return {
    grossPaisa:
      gross,

    discountPaisa:
      discount,

    taxPaisa:
      tax,

    refundPaisa:
      gross
      - discount
      + tax,
  };
}

export async function getRefundPreview(
  saleItemId: number
): Promise<RefundPreview> {
  const db =
    await getDatabase();

  const rows =
    await db.select<
      Omit<
        RefundPreview,
        | "alreadyRefunded"
        | "alreadyExchanged"
        | "refundableQuantity"
      >[]
    >(
      `
        SELECT
          si.id
            AS saleItemId,

          si.sale_id
            AS saleId,

          s.receipt_number
            AS receiptNumber,

          si.variant_id
            AS variantId,

          si.product_name
            AS productName,

          si.sku,

          si.size,
          si.color,

          si.quantity
            AS originalQuantity,

          si.unit_price_paisa
            AS unitPricePaisa,

          si.line_total_paisa
            AS lineTotalPaisa,

          s.subtotal_paisa
            AS saleSubtotalPaisa,

          s.discount_paisa
            AS saleDiscountPaisa,

          s.tax_paisa
            AS saleTaxPaisa

        FROM sale_items si

        INNER JOIN sales s
          ON s.id =
            si.sale_id

        WHERE
          si.id = $1

          AND s.status IN (
            'completed',
            'partially_refunded'
          )

        LIMIT 1;
      `,
      [saleItemId]
    );

  const row =
    rows[0];

  if (!row) {
    throw new Error(
      "Sale item is not available for refund."
    );
  }

  const refundRows =
    await db.select<
      {
        quantity: number;
      }[]
    >(
      `
        SELECT
          COALESCE(
            SUM(
              ri.quantity
            ),
            0
          ) AS quantity

        FROM refund_items ri

        INNER JOIN refunds r
          ON r.id =
            ri.refund_id

        WHERE
          ri.original_sale_item_id
            = $1

          AND r.status =
            'completed';
      `,
      [saleItemId]
    );

  const exchangeRows =
    await db.select<
      {
        quantity: number;
      }[]
    >(
      `
        SELECT
          COALESCE(
            SUM(
              ei.quantity
            ),
            0
          ) AS quantity

        FROM exchange_items ei

        INNER JOIN exchanges e
          ON e.id =
            ei.exchange_id

        WHERE
          ei.original_sale_item_id
            = $1

          AND e.status =
            'completed';
      `,
      [saleItemId]
    );

  const originalQuantity =
    Number(
      row.originalQuantity
    );

  const alreadyRefunded =
    Number(
      refundRows[0]
        ?.quantity ?? 0
    );

  const alreadyExchanged =
    Number(
      exchangeRows[0]
        ?.quantity ?? 0
    );

  return {
    ...row,

    saleItemId:
      Number(row.saleItemId),

    saleId:
      Number(row.saleId),

    variantId:
      Number(row.variantId),

    originalQuantity,

    unitPricePaisa:
      Number(
        row.unitPricePaisa
      ),

    lineTotalPaisa:
      Number(
        row.lineTotalPaisa
      ),

    saleSubtotalPaisa:
      Number(
        row.saleSubtotalPaisa
      ),

    saleDiscountPaisa:
      Number(
        row.saleDiscountPaisa
      ),

    saleTaxPaisa:
      Number(
        row.saleTaxPaisa
      ),

    alreadyRefunded,

    alreadyExchanged,

    refundableQuantity:
      originalQuantity
      -
      alreadyRefunded
      -
      alreadyExchanged,
  };
}

export async function completeRefund(
  input: {
    originalSaleItemId:
      number;

    quantity: number;

    refundMethod:
      RefundMethod;

    refundReference:
      string | null;

    reason: string;

    processedBy:
      number;
  }
): Promise<
  CompleteRefundResult
> {
  return invoke<
    CompleteRefundResult
  >(
    "complete_refund",
    {
      input,
    }
  );
}