import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getDatabase,
} from "../../lib/database";

export type ExchangePaymentMethod =
  | "cash"
  | "qr";

export interface ExchangeOriginalItem {
  saleItemId: number;

  receiptNumber: string;

  returnedVariantId: number;
  productId: number;

  productName: string;
  sku: string;

  size: string | null;
  color: string | null;

  originalQuantity: number;

  alreadyExchanged: number;

  remainingQuantity: number;

  unitPricePaisa: number;
}

export interface ExchangeCandidate {
  variantId: number;

  sku: string;

  size: string | null;
  color: string | null;

  sellingPricePaisa: number;

  quantityOnHand: number;
}

export interface ExchangePreview {
  original:
    ExchangeOriginalItem;

  replacements:
    ExchangeCandidate[];
}

export interface CompleteExchangeInput {
  originalSaleItemId: number;

  replacementVariantId:
    number;

  quantity: number;

  processedBy: number;

  paymentMethod:
    ExchangePaymentMethod
    | null;

  paymentReference:
    string | null;

  cashReceivedPaisa:
    number | null;
}

export interface CompleteExchangeResult {
  exchangeId: number;

  originalReceiptNumber:
    string;

  returnedProductName:
    string;

  returnedSku: string;

  returnedSize:
    string | null;

  returnedColor:
    string | null;

  replacementProductName:
    string;

  replacementSku:
    string;

  replacementSize:
    string | null;

  replacementColor:
    string | null;

  quantity: number;

  priceDifferencePaisa:
    number;

  paymentMethod:
    ExchangePaymentMethod
    | null;

  cashReceivedPaisa:
    number | null;

  changePaisa:
    number | null;
}

export async function getExchangePreview(
  saleItemId: number
): Promise<ExchangePreview> {
  const db =
    await getDatabase();

  const originals =
    await db.select<
      {
        saleItemId: number;

        receiptNumber:
          string;

        returnedVariantId:
          number;

        productId: number;

        productName:
          string;

        sku: string;

        size: string | null;

        color:
          string | null;

        originalQuantity:
          number;

        unitPricePaisa:
          number;
      }[]
    >(
      `
        SELECT
          si.id
            AS saleItemId,

          s.receipt_number
            AS receiptNumber,

          si.variant_id
            AS returnedVariantId,

          pv.product_id
            AS productId,

          si.product_name
            AS productName,

          si.sku,

          si.size,
          si.color,

          si.quantity
            AS originalQuantity,

          si.unit_price_paisa
            AS unitPricePaisa

        FROM sale_items si

        INNER JOIN sales s
          ON s.id =
            si.sale_id

        INNER JOIN
          product_variants pv
          ON pv.id =
            si.variant_id

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

  const originalRow =
    originals[0];

  if (!originalRow) {
    throw new Error(
      "Sale item is not available for exchange."
    );
  }

  const exchangeRows =
    await db.select<
      {
        exchangedQuantity:
          number;
      }[]
    >(
      `
        SELECT
          COALESCE(
            SUM(
              ei.quantity
            ),
            0
          ) AS exchangedQuantity

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

  const alreadyExchanged =
    Number(
      exchangeRows[0]
        ?.exchangedQuantity ??
        0
    );

  const original:
    ExchangeOriginalItem = {
    ...originalRow,

    saleItemId:
      Number(
        originalRow.saleItemId
      ),

    returnedVariantId:
      Number(
        originalRow.returnedVariantId
      ),

    productId:
      Number(
        originalRow.productId
      ),

    originalQuantity:
      Number(
        originalRow.originalQuantity
      ),

    alreadyExchanged,

    remainingQuantity:
      Number(
        originalRow.originalQuantity
      ) -
      alreadyExchanged,

    unitPricePaisa:
      Number(
        originalRow.unitPricePaisa
      ),
  };

  const replacements =
    await db.select<
      ExchangeCandidate[]
    >(
      `
        SELECT
          pv.id
            AS variantId,

          pv.sku,

          pv.size,
          pv.color,

          pv.selling_price_paisa
            AS sellingPricePaisa,

          i.quantity_on_hand
            AS quantityOnHand

        FROM product_variants pv

        INNER JOIN inventory i
          ON i.variant_id =
            pv.id

        WHERE
          pv.product_id =
            $1

          AND pv.id != $2

          AND pv.is_active = 1

        ORDER BY
          pv.color COLLATE NOCASE,
          pv.size COLLATE NOCASE,
          pv.sku COLLATE NOCASE;
      `,
      [
        original.productId,
        original.returnedVariantId,
      ]
    );

  return {
    original,

    replacements:
      replacements.map(
        (row) => ({
          ...row,

          variantId:
            Number(
              row.variantId
            ),

          sellingPricePaisa:
            Number(
              row.sellingPricePaisa
            ),

          quantityOnHand:
            Number(
              row.quantityOnHand
            ),
        })
      ),
  };
}

export async function completeExchange(
  input: CompleteExchangeInput
): Promise<
  CompleteExchangeResult
> {
  return invoke<
    CompleteExchangeResult
  >(
    "complete_exchange",
    {
      input,
    }
  );
}