CREATE TABLE exchanges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    original_sale_id INTEGER NOT NULL,

    processed_by INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'completed',
                'voided'
            )
        ),

    price_difference_paisa INTEGER NOT NULL DEFAULT 0
        CHECK (
            price_difference_paisa >= 0
        ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (original_sale_id)
        REFERENCES sales(id),

    FOREIGN KEY (processed_by)
        REFERENCES users(id)
);


CREATE TABLE exchange_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    exchange_id INTEGER NOT NULL,

    original_sale_item_id INTEGER NOT NULL,

    returned_variant_id INTEGER NOT NULL,

    replacement_variant_id INTEGER NOT NULL,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    returned_product_name TEXT NOT NULL,
    returned_sku TEXT NOT NULL,
    returned_size TEXT,
    returned_color TEXT,

    replacement_product_name TEXT NOT NULL,
    replacement_sku TEXT NOT NULL,
    replacement_size TEXT,
    replacement_color TEXT,

    original_unit_price_paisa INTEGER NOT NULL
        CHECK (
            original_unit_price_paisa >= 0
        ),

    replacement_unit_price_paisa INTEGER NOT NULL
        CHECK (
            replacement_unit_price_paisa >= 0
        ),

    FOREIGN KEY (exchange_id)
        REFERENCES exchanges(id),

    FOREIGN KEY (original_sale_item_id)
        REFERENCES sale_items(id),

    FOREIGN KEY (returned_variant_id)
        REFERENCES product_variants(id),

    FOREIGN KEY (replacement_variant_id)
        REFERENCES product_variants(id)
);


CREATE TABLE exchange_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    exchange_id INTEGER NOT NULL,

    method TEXT NOT NULL
        CHECK (
            method IN (
                'cash',
                'qr'
            )
        ),

    amount_paisa INTEGER NOT NULL
        CHECK (
            amount_paisa > 0
        ),

    reference_number TEXT,

    cash_received_paisa INTEGER,

    change_paisa INTEGER,

    confirmed_by INTEGER NOT NULL,

    confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (exchange_id)
        REFERENCES exchanges(id),

    FOREIGN KEY (confirmed_by)
        REFERENCES users(id)
);


CREATE INDEX idx_exchanges_sale
ON exchanges(original_sale_id);


CREATE INDEX idx_exchange_items_sale_item
ON exchange_items(original_sale_item_id);


CREATE INDEX idx_exchange_items_exchange
ON exchange_items(exchange_id);


/*
 * Rebuild inventory_movements so that
 * exchanges have explicit audit types.
 */

ALTER TABLE inventory_movements
RENAME TO inventory_movements_old;


CREATE TABLE inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    variant_id INTEGER NOT NULL,

    movement_type TEXT NOT NULL
        CHECK (
            movement_type IN (
                'initial_stock',
                'restock',
                'sale',
                'return',
                'adjustment',
                'exchange_return',
                'exchange_out'
            )
        ),

    quantity_change INTEGER NOT NULL,

    reference_type TEXT,

    reference_id INTEGER,

    note TEXT,

    created_by INTEGER,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (variant_id)
        REFERENCES product_variants(id),

    FOREIGN KEY (created_by)
        REFERENCES users(id)
);


INSERT INTO inventory_movements (
    id,
    variant_id,
    movement_type,
    quantity_change,
    reference_type,
    reference_id,
    note,
    created_by,
    created_at
)
SELECT
    id,
    variant_id,
    movement_type,
    quantity_change,
    reference_type,
    reference_id,
    note,
    created_by,
    created_at
FROM inventory_movements_old;


DROP TABLE inventory_movements_old;


CREATE INDEX idx_inventory_movements_variant
ON inventory_movements(variant_id);