import type {
  CompleteSaleResult,
} from "./checkoutService";

interface SaleCompleteModalProps {
  sale: CompleteSaleResult;

  onNewSale: () => void;
}

function formatMoney(
  paisa: number
): string {
  return `Rs. ${(
    paisa / 100
  ).toLocaleString(
    "en-NP",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

export default function SaleCompleteModal({
  sale,
  onNewSale,
}: SaleCompleteModalProps) {
  return (
    <div className="payment-overlay">
      <section className="sale-complete-modal">
        <div className="sale-success-icon">
          ✓
        </div>

        <p className="page-eyebrow">
          SALE COMPLETE
        </p>

        <h2>
          Payment confirmed
        </h2>

        <p className="receipt-number">
          {sale.receiptNumber}
        </p>

        <div className="sale-complete-summary">
          <div>
            <span>
              Subtotal
            </span>

            <strong>
              {formatMoney(
                sale.subtotalPaisa
              )}
            </strong>
          </div>

          <div>
            <span>
              Discount
            </span>

            <strong>
              −{" "}
              {formatMoney(
                sale.discountPaisa
              )}
            </strong>
          </div>

          <div>
            <span>
              Tax
            </span>

            <strong>
              {formatMoney(
                sale.taxPaisa
              )}
            </strong>
          </div>

          <div className="sale-complete-total">
            <span>
              Total
            </span>

            <strong>
              {formatMoney(
                sale.totalPaisa
              )}
            </strong>
          </div>

          {sale.cashReceivedPaisa !==
            null && (
            <>
              <div>
                <span>
                  Cash received
                </span>

                <strong>
                  {formatMoney(
                    sale.cashReceivedPaisa
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Change
                </span>

                <strong>
                  {formatMoney(
                    sale.changePaisa ??
                      0
                  )}
                </strong>
              </div>
            </>
          )}
        </div>

        <button
          className="payment-confirm sale-new-button"
          onClick={onNewSale}
        >
          Start New Sale
        </button>
      </section>
    </div>
  );
}