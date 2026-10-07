import {
  invoke,
} from "@tauri-apps/api/core";

export type PaymentMethod =
  | "cash"
  | "qr";

export type CheckoutDiscountMode =
  | "percent"
  | "fixed";

export interface CheckoutItem {
  variantId: number;
  quantity: number;
}

export interface CompleteSaleInput {
  cashierId: number;

  items: CheckoutItem[];

  discountMode:
    CheckoutDiscountMode;

  /*
   * percent:
   * 10% = 1000
   *
   * fixed:
   * paisa
   */
  discountValue: number;

  /*
   * 13% = 1300
   */
  taxRateBps: number;

  paymentMethod:
    PaymentMethod;

  paymentReference:
    string | null;

  cashReceivedPaisa:
    number | null;
}

export interface CompleteSaleResult {
  saleId: number;

  receiptNumber: string;

  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  totalPaisa: number;

  cashReceivedPaisa:
    number | null;

  changePaisa:
    number | null;
}

export async function completeSale(
  input: CompleteSaleInput
): Promise<CompleteSaleResult> {
  return invoke<CompleteSaleResult>(
    "complete_sale",
    {
      input,
    }
  );
}