const DEFAULT_SETTINGS = Object.freeze({
  masterEnabled: false,
  productsEnabled: false,
  inventoryEnabled: false,
  customersEnabled: false,
  ordersEnabled: false,
  updatedBy: null,
  updatedAt: null,
});

const COLUMN_BY_ENTITY_TYPE = Object.freeze({
  product: 'products_enabled',
  inventory: 'inventory_enabled',
  customer: 'customers_enabled',
  order: 'orders_enabled',
});

const KEY_BY_ENTITY_TYPE = Object.freeze({
  product: 'productsEnabled',
  inventory: 'inventoryEnabled',
  customer: 'customersEnabled',
  order: 'ordersEnabled',
});

const asBoolean = (value) => Number(value || 0) === 1;

export const parsePancakeSyncSettings = (row) => {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    masterEnabled: asBoolean(row.master_enabled),
    productsEnabled: asBoolean(row.products_enabled),
    inventoryEnabled: asBoolean(row.inventory_enabled),
    customersEnabled: asBoolean(row.customers_enabled),
    ordersEnabled: asBoolean(row.orders_enabled),
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at || null,
  };
};

export const getPancakeSyncSettings = async (db) => {
  if (!db) return { ...DEFAULT_SETTINGS };
  try {
    const row = await db
      .prepare('SELECT * FROM pancake_sync_settings WHERE id = 1 LIMIT 1')
      .first();
    return parsePancakeSyncSettings(row);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const getPancakeSettingColumn = (entityType) => COLUMN_BY_ENTITY_TYPE[entityType] || null;

export const isPancakeEntityEnabled = (settings, entityType) => {
  const key = KEY_BY_ENTITY_TYPE[entityType];
  return Boolean(settings?.masterEnabled && key && settings[key]);
};

export const getEnabledPancakeEntityTypes = (settings) =>
  Object.keys(KEY_BY_ENTITY_TYPE).filter((entityType) => isPancakeEntityEnabled(settings, entityType));

export const PANCAKE_SYNC_SETTING_KEYS = Object.freeze([
  'masterEnabled',
  'productsEnabled',
  'inventoryEnabled',
  'customersEnabled',
  'ordersEnabled',
]);
