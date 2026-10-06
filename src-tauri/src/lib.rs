use argon2::{
    password_hash::{PasswordHasher, PasswordVerifier},
    Argon2,
};

use tauri_plugin_sql::{Migration, MigrationKind};

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
            verify_password
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}