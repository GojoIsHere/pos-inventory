use argon2::{
    password_hash::{PasswordHasher, PasswordVerifier},
    Argon2,
};

use serde::Deserialize;

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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
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
            create_product
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}