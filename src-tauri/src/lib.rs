use argon2::{
    password_hash::{PasswordHasher, PasswordVerifier},
    Argon2,
};

use serde::{Deserialize, Serialize};

use std::collections::HashSet;
use tauri::State;
use tauri_plugin_sql::{
    DbInstances,
    DbPool,
    Migration,
    MigrationKind,
};

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    if password.len() < 8 {
        return Err("Password must contain at least 8 characters.".to_string());
    }

    let argon2 = Argon2::default();

    argon2
        .hash_password(password.as_bytes())
        .map(|hash| hash.to_string())
        .map_err(|error| format!("Failed to hash password: {}", error))
}

#[tauri::command]
fn verify_password(
    password: String,
    password_hash: String,
) -> Result<bool, String> {
    let argon2 = Argon2::default();

    match argon2.verify_password(
        password.as_bytes(),
        password_hash.as_str(),
    ) {
        Ok(()) => Ok(true),

        Err(argon2::password_hash::Error::PasswordInvalid) => {
            Ok(false)
        }

        Err(error) => {
            Err(format!("Failed to verify password: {}", error))
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductVariantInput {
    size: Option<String>,
    color: Option<String>,
    sku: String,
    barcode: Option<String>,

    cost_price_paisa: i64,
    selling_price_paisa: i64,

    initial_stock: i64,
    reorder_level: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateProductInput {
    name: String,
    category_id: Option<i64>,
    brand: Option<String>,
    description: Option<String>,

    variants: Vec<ProductVariantInput>,

    created_by: i64,
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

async fn ensure_admin(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    user_id: i64,
) -> Result<(), String> {
    let user: Option<(String, i64)> = sqlx::query_as(
        "
        SELECT role, is_active
        FROM users
        WHERE id = $1
        LIMIT 1;
        ",
    )
    .bind(user_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| {
        format!("Failed to verify administrator: {}", error)
    })?;

    match user {
        Some((role, 1)) if role == "admin" => Ok(()),

        _ => Err(
            "Administrator access is required."
                .to_string(),
        ),
    }
}

#[tauri::command]
async fn create_category(
    name: String,
    created_by: i64,
    db_instances: State<'_, DbInstances>,
) -> Result<i64, String> {
    let clean_name = name.trim().to_string();

    if clean_name.is_empty() {
        return Err(
            "Category name is required.".to_string()
        );
    }

    let instances = db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            )
        }
    };

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| {
            format!(
                "Could not start database transaction: {}",
                error
            )
        })?;

    ensure_admin(
        &mut transaction,
        created_by,
    )
    .await?;

    let result = sqlx::query(
        "
        INSERT INTO categories (name)
        VALUES ($1);
        ",
    )
    .bind(&clean_name)
    .execute(&mut *transaction)
    .await;

    let result = match result {
        Ok(result) => result,

        Err(error) => {
            let message = error.to_string();

            if message.contains(
                "UNIQUE constraint failed"
            ) {
                return Err(
                    "That category already exists."
                        .to_string(),
                );
            }

            return Err(format!(
                "Failed to create category: {}",
                message
            ));
        }
    };

    let category_id =
        result.last_insert_rowid();

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to save category: {}",
                error
            )
        })?;

    Ok(category_id)
}

#[tauri::command]
async fn create_product(
    input: CreateProductInput,
    db_instances: State<'_, DbInstances>,
) -> Result<i64, String> {
    let CreateProductInput {
        name,
        category_id,
        brand,
        description,
        variants,
        created_by,
    } = input;

    let clean_name =
        name.trim().to_string();

    if clean_name.is_empty() {
        return Err(
            "Product name is required."
                .to_string(),
        );
    }

    if variants.is_empty() {
        return Err(
            "At least one product variant is required."
                .to_string(),
        );
    }

    let mut skus =
        HashSet::<String>::new();

    let mut barcodes =
        HashSet::<String>::new();

    for variant in &variants {
        let sku =
            variant.sku.trim().to_uppercase();

        if sku.is_empty() {
            return Err(
                "Every variant requires a SKU."
                    .to_string(),
            );
        }

        if !skus.insert(sku.clone()) {
            return Err(format!(
                "Duplicate SKU in this product: {}",
                sku
            ));
        }

        if let Some(barcode) =
            clean_optional(
                variant.barcode.clone()
            )
        {
            if !barcodes.insert(
                barcode.clone()
            ) {
                return Err(format!(
                    "Duplicate barcode in this product: {}",
                    barcode
                ));
            }
        }

        if variant.cost_price_paisa < 0 {
            return Err(
                "Cost price cannot be negative."
                    .to_string(),
            );
        }

        if variant.selling_price_paisa < 0 {
            return Err(
                "Selling price cannot be negative."
                    .to_string(),
            );
        }

        if variant.initial_stock < 0 {
            return Err(
                "Initial stock cannot be negative."
                    .to_string(),
            );
        }

        if variant.reorder_level < 0 {
            return Err(
                "Reorder level cannot be negative."
                    .to_string(),
            );
        }
    }

    let clean_brand =
        clean_optional(brand);

    let clean_description =
        clean_optional(description);

    let instances =
        db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            )
        }
    };

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| {
            format!(
                "Could not start database transaction: {}",
                error
            )
        })?;

    ensure_admin(
        &mut transaction,
        created_by,
    )
    .await?;

    let product_result = sqlx::query(
        "
        INSERT INTO products (
            name,
            category_id,
            brand,
            description,
            is_active
        )
        VALUES ($1, $2, $3, $4, 1);
        ",
    )
    .bind(&clean_name)
    .bind(category_id)
    .bind(clean_brand)
    .bind(clean_description)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Failed to create product: {}",
            error
        )
    })?;

    let product_id =
        product_result.last_insert_rowid();

    for variant in variants {
        let sku =
            variant.sku.trim().to_uppercase();

        let size =
            clean_optional(variant.size);

        let color =
            clean_optional(variant.color);

        let barcode =
            clean_optional(variant.barcode);

        let variant_result = sqlx::query(
            "
            INSERT INTO product_variants (
                product_id,
                sku,
                barcode,
                size,
                color,
                cost_price_paisa,
                selling_price_paisa,
                is_active
            )
            VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, 1
            );
            ",
        )
        .bind(product_id)
        .bind(&sku)
        .bind(barcode)
        .bind(size)
        .bind(color)
        .bind(variant.cost_price_paisa)
        .bind(variant.selling_price_paisa)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Failed to create variant {}: {}",
                sku,
                error
            )
        })?;

        let variant_id =
            variant_result.last_insert_rowid();

        sqlx::query(
            "
            INSERT INTO inventory (
                variant_id,
                quantity_on_hand,
                reorder_level
            )
            VALUES ($1, $2, $3);
            ",
        )
        .bind(variant_id)
        .bind(variant.initial_stock)
        .bind(variant.reorder_level)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            format!(
                "Failed to create inventory for {}: {}",
                sku,
                error
            )
        })?;

        if variant.initial_stock > 0 {
            sqlx::query(
                "
                INSERT INTO inventory_movements (
                    variant_id,
                    movement_type,
                    quantity_change,
                    reference_type,
                    reference_id,
                    note,
                    created_by
                )
                VALUES (
                    $1,
                    'initial_stock',
                    $2,
                    'product',
                    $3,
                    'Initial stock',
                    $4
                );
                ",
            )
            .bind(variant_id)
            .bind(variant.initial_stock)
            .bind(product_id)
            .bind(created_by)
            .execute(&mut *transaction)
            .await
            .map_err(|error| {
                format!(
                    "Failed to record initial stock for {}: {}",
                    sku,
                    error
                )
            })?;
        }
    }

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to save product: {}",
                error
            )
        })?;

    Ok(product_id)
}

#[tauri::command]
async fn change_inventory(
    variant_id: i64,
    movement_type: String,
    quantity_change: i64,
    note: Option<String>,
    created_by: i64,
    db_instances: State<'_, DbInstances>,
) -> Result<i64, String> {
    let clean_type =
        movement_type.trim().to_lowercase();

    if clean_type != "restock"
        && clean_type != "adjustment"
    {
        return Err(
            "Invalid inventory movement type."
                .to_string(),
        );
    }

    if quantity_change == 0 {
        return Err(
            "Inventory change cannot be zero."
                .to_string(),
        );
    }

    if clean_type == "restock"
        && quantity_change < 0
    {
        return Err(
            "Restock quantity must be positive."
                .to_string(),
        );
    }

    let clean_note =
        clean_optional(note);

    let instances =
        db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            );
        }
    };

    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| {
            format!(
                "Could not start inventory transaction: {}",
                error
            )
        })?;

    ensure_admin(
        &mut transaction,
        created_by,
    )
    .await?;

    let inventory: Option<(i64,)> =
        sqlx::query_as(
            "
            SELECT quantity_on_hand
            FROM inventory
            WHERE variant_id = $1
            LIMIT 1;
            ",
        )
        .bind(variant_id)
        .fetch_optional(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to read inventory: {}",
                error
            )
        })?;

    let current_stock = inventory
        .ok_or_else(|| {
            "Inventory record not found."
                .to_string()
        })?
        .0;

    let new_stock = current_stock
        .checked_add(quantity_change)
        .ok_or_else(|| {
            "Inventory quantity is out of range."
                .to_string()
        })?;

    if new_stock < 0 {
        return Err(format!(
            "Not enough stock. Current stock is {}.",
            current_stock
        ));
    }

    sqlx::query(
        "
        UPDATE inventory
        SET
            quantity_on_hand = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE variant_id = $2;
        ",
    )
    .bind(new_stock)
    .bind(variant_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Failed to update inventory: {}",
            error
        )
    })?;

    sqlx::query(
        "
        INSERT INTO inventory_movements (
            variant_id,
            movement_type,
            quantity_change,
            reference_type,
            reference_id,
            note,
            created_by
        )
        VALUES (
            $1,
            $2,
            $3,
            'manual',
            NULL,
            $4,
            $5
        );
        ",
    )
    .bind(variant_id)
    .bind(&clean_type)
    .bind(quantity_change)
    .bind(clean_note)
    .bind(created_by)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Failed to record inventory movement: {}",
            error
        )
    })?;

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to save inventory change: {}",
                error
            )
        })?;

    Ok(new_stock)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaleItemInput {
    variant_id: i64,
    quantity: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompleteSaleInput {
    cashier_id: i64,

    items: Vec<SaleItemInput>,

    discount_mode: String,

    // Percent:
    // 10% = 1000 basis points
    //
    // Fixed:
    // value is paisa
    discount_value: i64,

    // 13% = 1300 basis points
    tax_rate_bps: i64,

    payment_method: String,

    payment_reference: Option<String>,

    cash_received_paisa: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompleteSaleResult {
    sale_id: i64,

    receipt_number: String,

    subtotal_paisa: i64,
    discount_paisa: i64,
    tax_paisa: i64,
    total_paisa: i64,

    cash_received_paisa: Option<i64>,
    change_paisa: Option<i64>,
}

struct ValidatedSaleItem {
    variant_id: i64,

    product_name: String,
    sku: String,

    size: Option<String>,
    color: Option<String>,

    quantity: i64,

    unit_price_paisa: i64,
    line_total_paisa: i64,
}

async fn ensure_pos_user(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    user_id: i64,
) -> Result<(), String> {
    let user: Option<(String, i64)> =
        sqlx::query_as(
            "
            SELECT role, is_active
            FROM users
            WHERE id = $1
            LIMIT 1;
            ",
        )
        .bind(user_id)
        .fetch_optional(
            &mut **transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to verify user: {}",
                error
            )
        })?;

    match user {
        Some((role, 1))
            if role == "admin"
                || role == "cashier" =>
        {
            Ok(())
        }

        _ => Err(
            "An active administrator or cashier account is required."
                .to_string(),
        ),
    }
}

fn calculate_percentage(
    amount_paisa: i64,
    basis_points: i64,
) -> Result<i64, String> {
    if basis_points < 0 {
        return Err(
            "Percentage cannot be negative."
                .to_string(),
        );
    }

    let amount =
        i128::from(amount_paisa);

    let rate =
        i128::from(basis_points);

    let calculated =
        (amount * rate + 5_000)
            / 10_000;

    i64::try_from(calculated)
        .map_err(|_| {
            "Calculated amount is too large."
                .to_string()
        })
}

#[tauri::command]
async fn complete_sale(
    input: CompleteSaleInput,
    db_instances: State<'_, DbInstances>,
) -> Result<CompleteSaleResult, String> {
    let CompleteSaleInput {
        cashier_id,
        items,
        discount_mode,
        discount_value,
        tax_rate_bps,
        payment_method,
        payment_reference,
        cash_received_paisa,
    } = input;

    if items.is_empty() {
        return Err(
            "The cart is empty."
                .to_string(),
        );
    }

    let clean_payment_method =
        payment_method
            .trim()
            .to_lowercase();

    if clean_payment_method != "cash"
        && clean_payment_method != "qr"
    {
        return Err(
            "Payment method must be cash or QR."
                .to_string(),
        );
    }

    let clean_discount_mode =
        discount_mode
            .trim()
            .to_lowercase();

    if clean_discount_mode != "percent"
        && clean_discount_mode != "fixed"
    {
        return Err(
            "Invalid discount type."
                .to_string(),
        );
    }

    if tax_rate_bps < 0
        || tax_rate_bps > 10_000
    {
        return Err(
            "Tax percentage must be between 0 and 100."
                .to_string(),
        );
    }

    let mut variant_ids =
        HashSet::<i64>::new();

    for item in &items {
        if item.quantity <= 0 {
            return Err(
                "Sale quantities must be greater than zero."
                    .to_string(),
            );
        }

        if !variant_ids.insert(
            item.variant_id
        ) {
            return Err(
                "The cart contains a duplicate variant."
                    .to_string(),
            );
        }
    }

    let clean_reference =
        clean_optional(
            payment_reference
        );

    let instances =
        db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            );
        }
    };

    let mut transaction =
        pool.begin()
            .await
            .map_err(|error| {
                format!(
                    "Could not start sale transaction: {}",
                    error
                )
            })?;

    ensure_pos_user(
        &mut transaction,
        cashier_id,
    )
    .await?;

    /*
     * IMPORTANT:
     *
     * Never trust:
     * - price from React
     * - product name from React
     * - stock from React
     *
     * Reload all authoritative values
     * from SQLite here.
     */

    let mut validated_items:
        Vec<ValidatedSaleItem> =
        Vec::new();

    let mut subtotal_paisa: i64 =
        0;

    for item in items {
        let variant: Option<(
            String,
            String,
            Option<String>,
            Option<String>,
            i64,
            i64,
        )> = sqlx::query_as(
            "
            SELECT
                p.name,
                pv.sku,
                pv.size,
                pv.color,
                pv.selling_price_paisa,
                i.quantity_on_hand

            FROM product_variants pv

            INNER JOIN products p
                ON p.id = pv.product_id

            INNER JOIN inventory i
                ON i.variant_id = pv.id

            WHERE
                pv.id = $1
                AND pv.is_active = 1
                AND p.is_active = 1

            LIMIT 1;
            ",
        )
        .bind(item.variant_id)
        .fetch_optional(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to verify product: {}",
                error
            )
        })?;

        let (
            product_name,
            sku,
            size,
            color,
            unit_price_paisa,
            stock_available,
        ) = variant.ok_or_else(|| {
            format!(
                "Variant {} is no longer available.",
                item.variant_id
            )
        })?;

        if stock_available
            < item.quantity
        {
            return Err(format!(
                "Not enough stock for {}. Available: {}, requested: {}.",
                sku,
                stock_available,
                item.quantity
            ));
        }

        let line_total_paisa =
            unit_price_paisa
                .checked_mul(
                    item.quantity
                )
                .ok_or_else(|| {
                    "Sale total is too large."
                        .to_string()
                })?;

        subtotal_paisa =
            subtotal_paisa
                .checked_add(
                    line_total_paisa
                )
                .ok_or_else(|| {
                    "Sale subtotal is too large."
                        .to_string()
                })?;

        validated_items.push(
            ValidatedSaleItem {
                variant_id:
                    item.variant_id,

                product_name,
                sku,
                size,
                color,

                quantity:
                    item.quantity,

                unit_price_paisa,

                line_total_paisa,
            },
        );
    }

    /*
     * Discount
     */

    let discount_paisa =
        if clean_discount_mode
            == "percent"
        {
            if discount_value < 0
                || discount_value
                    > 10_000
            {
                return Err(
                    "Discount percentage must be between 0 and 100."
                        .to_string(),
                );
            }

            calculate_percentage(
                subtotal_paisa,
                discount_value,
            )?
        } else {
            if discount_value < 0 {
                return Err(
                    "Discount cannot be negative."
                        .to_string(),
                );
            }

            if discount_value
                > subtotal_paisa
            {
                return Err(
                    "Discount cannot exceed the subtotal."
                        .to_string(),
                );
            }

            discount_value
        };

    let taxable_paisa =
        subtotal_paisa
            .checked_sub(
                discount_paisa
            )
            .ok_or_else(|| {
                "Invalid discount."
                    .to_string()
            })?;

    let tax_paisa =
        calculate_percentage(
            taxable_paisa,
            tax_rate_bps,
        )?;

    let total_paisa =
        taxable_paisa
            .checked_add(tax_paisa)
            .ok_or_else(|| {
                "Sale total is too large."
                    .to_string()
            })?;

    /*
     * Payment validation
     */

    let (
        final_cash_received,
        change_paisa,
    ) = if clean_payment_method
        == "cash"
    {
        let received =
            cash_received_paisa
                .ok_or_else(|| {
                    "Enter the amount of cash received."
                        .to_string()
                })?;

        if received < total_paisa {
            return Err(format!(
                "Cash received is less than the amount due."
            ));
        }

        (
            Some(received),
            Some(
                received -
                    total_paisa
            ),
        )
    } else {
        (
            None,
            None,
        )
    };

    /*
     * Generate receipt number
     */

    let receipt_number: String =
        sqlx::query_scalar(
            "
            SELECT
                'PS-'
                ||
                strftime(
                    '%Y%m%d-%H%M%S',
                    'now',
                    'localtime'
                )
                ||
                '-'
                ||
                upper(
                    hex(
                        randomblob(3)
                    )
                );
            ",
        )
        .fetch_one(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to create receipt number: {}",
                error
            )
        })?;

    /*
     * Create sale
     */

    let sale_result =
        sqlx::query(
            "
            INSERT INTO sales (
                receipt_number,
                cashier_id,
                subtotal_paisa,
                discount_paisa,
                tax_paisa,
                total_paisa,
                status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'completed'
            );
            ",
        )
        .bind(&receipt_number)
        .bind(cashier_id)
        .bind(subtotal_paisa)
        .bind(discount_paisa)
        .bind(tax_paisa)
        .bind(total_paisa)
        .execute(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to create sale: {}",
                error
            )
        })?;

    let sale_id =
        sale_result
            .last_insert_rowid();

    /*
     * Sale items + stock deduction
     */

    for item in validated_items {
        sqlx::query(
            "
            INSERT INTO sale_items (
                sale_id,
                variant_id,

                product_name,
                sku,
                size,
                color,

                quantity,

                unit_price_paisa,

                discount_paisa,
                tax_paisa,

                line_total_paisa
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                0,
                0,
                $9
            );
            ",
        )
        .bind(sale_id)
        .bind(item.variant_id)
        .bind(&item.product_name)
        .bind(&item.sku)
        .bind(&item.size)
        .bind(&item.color)
        .bind(item.quantity)
        .bind(item.unit_price_paisa)
        .bind(item.line_total_paisa)
        .execute(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to save sale item {}: {}",
                item.sku,
                error
            )
        })?;

        /*
         * Re-check stock during update.
         *
         * This prevents stock from
         * dropping below zero even if
         * something changed after our
         * earlier SELECT.
         */

        let stock_update =
            sqlx::query(
                "
                UPDATE inventory

                SET
                    quantity_on_hand =
                        quantity_on_hand - $1,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE
                    variant_id = $2

                    AND
                    quantity_on_hand
                        >= $1;
                ",
            )
            .bind(item.quantity)
            .bind(item.variant_id)
            .execute(
                &mut *transaction
            )
            .await
            .map_err(|error| {
                format!(
                    "Failed to update stock for {}: {}",
                    item.sku,
                    error
                )
            })?;

        if stock_update
            .rows_affected()
            != 1
        {
            return Err(format!(
                "Stock changed while completing the sale. Please review {} and try again.",
                item.sku
            ));
        }

        sqlx::query(
            "
            INSERT INTO inventory_movements (
                variant_id,
                movement_type,
                quantity_change,
                reference_type,
                reference_id,
                note,
                created_by
            )
            VALUES (
                $1,
                'sale',
                $2,
                'sale',
                $3,
                $4,
                $5
            );
            ",
        )
        .bind(item.variant_id)
        .bind(-item.quantity)
        .bind(sale_id)
        .bind(
            format!(
                "Sale {}",
                receipt_number
            )
        )
        .bind(cashier_id)
        .execute(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to record inventory movement for {}: {}",
                item.sku,
                error
            )
        })?;
    }

    /*
     * Payment
     */

    sqlx::query(
        "
        INSERT INTO payments (
            sale_id,
            method,
            amount_paisa,
            reference_number,
            confirmed_by,
            cash_received_paisa,
            change_paisa
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
        );
        ",
    )
    .bind(sale_id)
    .bind(&clean_payment_method)
    .bind(total_paisa)
    .bind(
        if clean_payment_method
            == "qr"
        {
            clean_reference
        } else {
            None
        }
    )
    .bind(cashier_id)
    .bind(final_cash_received)
    .bind(change_paisa)
    .execute(
        &mut *transaction
    )
    .await
    .map_err(|error| {
        format!(
            "Failed to save payment: {}",
            error
        )
    })?;

    /*
     * EVERYTHING succeeded.
     *
     * Only now commit.
     */

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to complete sale: {}",
                error
            )
        })?;

    Ok(
        CompleteSaleResult {
            sale_id,

            receipt_number,

            subtotal_paisa,
            discount_paisa,
            tax_paisa,
            total_paisa,

            cash_received_paisa:
                final_cash_received,

            change_paisa,
        }
    )
}

#[tauri::command]
async fn create_cashier(
    full_name: String,
    username: String,
    password: String,
    created_by: i64,
    db_instances: State<'_, DbInstances>,
) -> Result<i64, String> {
    let clean_full_name =
        full_name.trim().to_string();

    let clean_username =
        username.trim().to_lowercase();

    if clean_full_name.is_empty() {
        return Err(
            "Employee name is required."
                .to_string(),
        );
    }

    if clean_username.len() < 3 {
        return Err(
            "Username must be at least 3 characters."
                .to_string(),
        );
    }

    if !clean_username.chars().all(
        |character| {
            character.is_ascii_alphanumeric()
                || character == '_'
                || character == '.'
                || character == '-'
        },
    ) {
        return Err(
            "Username can only contain letters, numbers, dots, hyphens and underscores."
                .to_string(),
        );
    }

    if password.len() < 8 {
        return Err(
            "Password must be at least 8 characters."
                .to_string(),
        );
    }

    /*
     * Hash before storing.
     *
     * Reuses our existing
     * Argon2 password command.
     */
    let password_hash =
        hash_password(password)?;

    let instances =
        db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            );
        }
    };

    let mut transaction =
        pool.begin()
            .await
            .map_err(|error| {
                format!(
                    "Could not start employee transaction: {}",
                    error
                )
            })?;

    /*
     * Only an active admin
     * may create cashiers.
     */
    ensure_admin(
        &mut transaction,
        created_by,
    )
    .await?;

    let result = sqlx::query(
        "
        INSERT INTO users (
            username,
            password_hash,
            full_name,
            role,
            is_active
        )
        VALUES (
            $1,
            $2,
            $3,
            'cashier',
            1
        );
        ",
    )
    .bind(&clean_username)
    .bind(password_hash)
    .bind(&clean_full_name)
    .execute(&mut *transaction)
    .await;

    let result = match result {
        Ok(result) => result,

        Err(error) => {
            let message =
                error.to_string();

            if message.contains(
                "UNIQUE constraint failed",
            ) {
                return Err(
                    "That username is already in use."
                        .to_string(),
                );
            }

            return Err(format!(
                "Failed to create cashier: {}",
                message
            ));
        }
    };

    let cashier_id =
        result.last_insert_rowid();

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to save cashier: {}",
                error
            )
        })?;

    Ok(cashier_id)
}

#[tauri::command]
async fn set_cashier_active(
    cashier_id: i64,
    is_active: bool,
    updated_by: i64,
    db_instances: State<'_, DbInstances>,
) -> Result<(), String> {
    let instances =
        db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            );
        }
    };

    let mut transaction =
        pool.begin()
            .await
            .map_err(|error| {
                format!(
                    "Could not start employee transaction: {}",
                    error
                )
            })?;

    ensure_admin(
        &mut transaction,
        updated_by,
    )
    .await?;

    /*
     * Make sure we're changing
     * a cashier, not an admin.
     */
    let user: Option<(String,)> =
        sqlx::query_as(
            "
            SELECT role
            FROM users
            WHERE id = $1
            LIMIT 1;
            ",
        )
        .bind(cashier_id)
        .fetch_optional(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to find cashier: {}",
                error
            )
        })?;

    match user {
        Some((role,))
            if role == "cashier" => {}

        Some(_) => {
            return Err(
                "Only cashier accounts can be changed here."
                    .to_string(),
            );
        }

        None => {
            return Err(
                "Cashier account not found."
                    .to_string(),
            );
        }
    }

    sqlx::query(
        "
        UPDATE users
        SET
            is_active = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2;
        ",
    )
    .bind(if is_active { 1 } else { 0 })
    .bind(cashier_id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| {
        format!(
            "Failed to update cashier: {}",
            error
        )
    })?;

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to save cashier status: {}",
                error
            )
        })?;

    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingInput {
    key: String,
    value: String,
}

#[tauri::command]
async fn save_settings(
    settings: Vec<SettingInput>,
    updated_by: i64,
    db_instances: State<'_, DbInstances>,
) -> Result<(), String> {
    let allowed_keys = [
        "store_name",
        "store_address",
        "store_phone",
        "tax_enabled",
        "default_tax_rate_bps",
        "receipt_footer",
        "require_qr_reference",
    ];

    if settings.is_empty() {
        return Err(
            "No settings were provided."
                .to_string(),
        );
    }

    /*
     * Validate everything before
     * starting the transaction.
     */
    for setting in &settings {
        if !allowed_keys.contains(
            &setting.key.as_str()
        ) {
            return Err(format!(
                "Unsupported setting: {}",
                setting.key
            ));
        }

        match setting.key.as_str() {
            "tax_enabled"
            | "require_qr_reference" => {
                if setting.value != "true"
                    && setting.value != "false"
                {
                    return Err(format!(
                        "Invalid boolean value for {}.",
                        setting.key
                    ));
                }
            }

            "default_tax_rate_bps" => {
                let rate =
                    setting.value
                        .parse::<i64>()
                        .map_err(|_| {
                            "Invalid tax rate."
                                .to_string()
                        })?;

                if rate < 0
                    || rate > 10_000
                {
                    return Err(
                        "Tax rate must be between 0% and 100%."
                            .to_string(),
                    );
                }
            }

            _ => {}
        }
    }

    let store_name =
        settings.iter()
            .find(
                |setting| {
                    setting.key
                        == "store_name"
                },
            );

    if let Some(store_name) =
        store_name
    {
        if store_name
            .value
            .trim()
            .is_empty()
        {
            return Err(
                "Store name cannot be empty."
                    .to_string(),
            );
        }
    }

    let instances =
        db_instances.0.read().await;

    let database = instances
        .get("sqlite:pos_inventory.db")
        .ok_or_else(|| {
            "Project S database is not loaded."
                .to_string()
        })?;

    #[allow(unreachable_patterns)]
    let pool = match database {
        DbPool::Sqlite(pool) => pool,

        _ => {
            return Err(
                "Project S requires SQLite."
                    .to_string(),
            );
        }
    };

    let mut transaction =
        pool.begin()
            .await
            .map_err(|error| {
                format!(
                    "Could not start settings transaction: {}",
                    error
                )
            })?;

    /*
     * Settings are admin-only.
     */
    ensure_admin(
        &mut transaction,
        updated_by,
    )
    .await?;

    for setting in settings {
        sqlx::query(
            "
            INSERT INTO settings (
                key,
                value,
                updated_at
            )
            VALUES (
                $1,
                $2,
                CURRENT_TIMESTAMP
            )

            ON CONFLICT(key)
            DO UPDATE SET
                value =
                    excluded.value,

                updated_at =
                    CURRENT_TIMESTAMP;
            ",
        )
        .bind(setting.key)
        .bind(setting.value)
        .execute(
            &mut *transaction
        )
        .await
        .map_err(|error| {
            format!(
                "Failed to save setting: {}",
                error
            )
        })?;
    }

    transaction
        .commit()
        .await
        .map_err(|error| {
            format!(
                "Failed to save settings: {}",
                error
            )
        })?;

    Ok(())
}




#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_cash_payment_details",
            sql: include_str!(
                "../migrations/002_cash_payment_details.sql"
            ),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:pos_inventory.db",
                    migrations,
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            hash_password,
            verify_password,
            create_category,
            create_product,
            change_inventory,
            complete_sale,
            create_cashier,
            set_cashier_active,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}