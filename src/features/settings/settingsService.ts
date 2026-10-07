import { invoke } from "@tauri-apps/api/core";

import {
  getDatabase,
} from "../../lib/database";

export interface AppSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;

  taxEnabled: boolean;

  /*
   * 13% = 1300
   */
  defaultTaxRateBps: number;

  receiptFooter: string;

  requireQrReference: boolean;
}

export const DEFAULT_SETTINGS:
  AppSettings = {
    storeName: "Project S",
    storeAddress: "",
    storePhone: "",

    taxEnabled: false,
    defaultTaxRateBps: 0,

    receiptFooter:
      "Thank you for your purchase.",

    requireQrReference: false,
  };

interface SettingRow {
  key: string;
  value: string;
}

export async function getAppSettings():
  Promise<AppSettings> {
  const db =
    await getDatabase();

  const rows =
    await db.select<
      SettingRow[]
    >(
      `
        SELECT
          key,
          value

        FROM settings;
      `
    );

  const map =
    new Map(
      rows.map(
        (row) => [
          row.key,
          row.value,
        ]
      )
    );

  return {
    storeName:
      map.get(
        "store_name"
      ) ??
      DEFAULT_SETTINGS.storeName,

    storeAddress:
      map.get(
        "store_address"
      ) ??
      DEFAULT_SETTINGS.storeAddress,

    storePhone:
      map.get(
        "store_phone"
      ) ??
      DEFAULT_SETTINGS.storePhone,

    taxEnabled:
      (
        map.get(
          "tax_enabled"
        ) ??
        String(
          DEFAULT_SETTINGS.taxEnabled
        )
      ) === "true",

    defaultTaxRateBps:
      Number(
        map.get(
          "default_tax_rate_bps"
        ) ??
        DEFAULT_SETTINGS
          .defaultTaxRateBps
      ),

    receiptFooter:
      map.get(
        "receipt_footer"
      ) ??
      DEFAULT_SETTINGS.receiptFooter,

    requireQrReference:
      (
        map.get(
          "require_qr_reference"
        ) ??
        String(
          DEFAULT_SETTINGS
            .requireQrReference
        )
      ) === "true",
  };
}

export async function saveAppSettings(
  settings: AppSettings,
  updatedBy: number
): Promise<void> {
  await invoke(
    "save_settings",
    {
      updatedBy,

      settings: [
        {
          key: "store_name",
          value:
            settings.storeName,
        },

        {
          key: "store_address",
          value:
            settings.storeAddress,
        },

        {
          key: "store_phone",
          value:
            settings.storePhone,
        },

        {
          key: "tax_enabled",
          value:
            String(
              settings.taxEnabled
            ),
        },

        {
          key:
            "default_tax_rate_bps",

          value:
            String(
              settings
                .defaultTaxRateBps
            ),
        },

        {
          key:
            "receipt_footer",

          value:
            settings.receiptFooter,
        },

        {
          key:
            "require_qr_reference",

          value:
            String(
              settings
                .requireQrReference
            ),
        },
      ],
    }
  );
}