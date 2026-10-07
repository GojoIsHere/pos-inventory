CREATE TABLE refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    original_sale_id INTEGER NOT NULL,

    processed_by INTEGER NOT NULL,

    /*
     * Reserved for our later
     * supervisor/admin approval system.
     */
    approved_by INTEGER,

    total_refund_paisa INTEGER NOT NULL
        CHECK (total_refund_paisa >= 0),

    reason TEXT,

    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'completed',
                'voided'
            )
        ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (original_sale_id)
        REFERENCES sales(id),

    FOREIGN KEY (processed_by)
        REFERENCES users(id),

    FOREIGN KEY (approved_by)
        REFERENCES users(id)
);


CREATE TABLE refund_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    refund_id INTEGER NOT NULL,

    original_sale_item_id INTEGER NOT NULL,

    variant_id INTEGER NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,

    size TEXT,
    color TEXT,

    unit_price_paisa INTEGER NOT NULL,

    gross_amount_paisa INTEGER NOT NULL,

    discount_refund_paisa INTEGER NOT NULL,

    tax_refund_paisa INTEGER NOT NULL,

    refund_amount_paisa INTEGER NOT NULL,

    restocked INTEGER NOT NULL DEFAULT 1
        CHECK (
            restocked IN (0, 1)
        ),

    FOREIGN KEY (refund_id)
        REFERENCES refunds(id),

    FOREIGN KEY (original_sale_item_id)
        REFERENCES sale_items(id),

    FOREIGN KEY (variant_id)
        REFERENCES product_variants(id)
);


CREATE TABLE refund_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    refund_id INTEGER NOT NULL,

    method TEXT NOT NULL
        CHECK (
            method IN (
                'cash',
                'qr'
            )
        ),

    amount_paisa INTEGER NOT NULL
        CHECK (amount_paisa >= 0),

    reference_number TEXT,

    processed_by INTEGER NOT NULL,

    processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (refund_id)
        REFERENCES refunds(id),

    FOREIGN KEY (processed_by)
        REFERENCES users(id)
);


CREATE INDEX idx_refunds_sale
ON refunds(original_sale_id);


CREATE INDEX idx_refund_items_sale_item
ON refund_items(original_sale_item_id);


CREATE INDEX idx_refund_items_refund
ON refund_items(refund_id);