CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,

    role TEXT NOT NULL
        CHECK (role IN ('admin', 'cashier')),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    category_id INTEGER,

    brand TEXT,
    description TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    product_id INTEGER NOT NULL,

    sku TEXT NOT NULL UNIQUE,
    barcode TEXT UNIQUE,

    size TEXT,
    color TEXT,

    cost_price_paisa INTEGER NOT NULL DEFAULT 0
        CHECK (cost_price_paisa >= 0),

    selling_price_paisa INTEGER NOT NULL
        CHECK (selling_price_paisa >= 0),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS inventory (
    variant_id INTEGER PRIMARY KEY,

    quantity_on_hand INTEGER NOT NULL DEFAULT 0
        CHECK (quantity_on_hand >= 0),

    reorder_level INTEGER NOT NULL DEFAULT 0
        CHECK (reorder_level >= 0),

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (variant_id)
        REFERENCES product_variants(id)
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    receipt_number TEXT NOT NULL UNIQUE,

    cashier_id INTEGER NOT NULL,

    subtotal_paisa INTEGER NOT NULL
        CHECK (subtotal_paisa >= 0),

    discount_paisa INTEGER NOT NULL DEFAULT 0
        CHECK (discount_paisa >= 0),

    tax_paisa INTEGER NOT NULL DEFAULT 0
        CHECK (tax_paisa >= 0),

    total_paisa INTEGER NOT NULL
        CHECK (total_paisa >= 0),

    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (
            status IN (
                'completed',
                'voided',
                'refunded',
                'partially_refunded'
            )
        ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cashier_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    sale_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,

    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    size TEXT,
    color TEXT,

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    unit_price_paisa INTEGER NOT NULL
        CHECK (unit_price_paisa >= 0),

    discount_paisa INTEGER NOT NULL DEFAULT 0
        CHECK (discount_paisa >= 0),

    tax_paisa INTEGER NOT NULL DEFAULT 0
        CHECK (tax_paisa >= 0),

    line_total_paisa INTEGER NOT NULL
        CHECK (line_total_paisa >= 0),

    FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (variant_id)
        REFERENCES product_variants(id)
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    sale_id INTEGER NOT NULL,

    method TEXT NOT NULL
        CHECK (method IN ('cash', 'qr')),

    amount_paisa INTEGER NOT NULL
        CHECK (amount_paisa >= 0),

    reference_number TEXT,

    confirmed_by INTEGER NOT NULL,

    confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (sale_id)
        REFERENCES sales(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (confirmed_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS inventory_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    variant_id INTEGER NOT NULL,

    movement_type TEXT NOT NULL
        CHECK (
            movement_type IN (
                'initial_stock',
                'restock',
                'sale',
                'return',
                'adjustment'
            )
        ),

    quantity_change INTEGER NOT NULL,

    reference_type TEXT,
    reference_id INTEGER,

    note TEXT,

    created_by INTEGER,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (variant_id)
        REFERENCES product_variants(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_products_category
ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_variants_product
ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_sales_cashier
ON sales(cashier_id);

CREATE INDEX IF NOT EXISTS idx_sales_created_at
ON sales(created_at);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale
ON sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant
ON inventory_movements(variant_id);