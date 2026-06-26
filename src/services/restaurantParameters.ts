import { supabase } from '../lib/supabase';

/** 雲端 `restaurant_parameters` 表（id 固定為 1） */
export interface RestaurantParameters {
  id: number;
  tax_rate: number;
  year_end_monthly: number;
  employee_bonus_pct: number;
  reserve_rate: number;
}

export const DEFAULT_RESTAURANT_PARAMETERS: Omit<RestaurantParameters, 'id'> = {
  tax_rate: 0,
  year_end_monthly: 69000,
  employee_bonus_pct: 10,
  reserve_rate: 0,
};

const PARAMS_ROW_ID = 1;

let cachedParams: RestaurantParameters | null = null;
let preloadPromise: Promise<RestaurantParameters> | null = null;

function toSafeNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapRow(row: Record<string, unknown>): RestaurantParameters {
  return {
    id: PARAMS_ROW_ID,
    tax_rate: toSafeNumber(row.tax_rate, DEFAULT_RESTAURANT_PARAMETERS.tax_rate),
    year_end_monthly: toSafeNumber(
      row.year_end_monthly,
      DEFAULT_RESTAURANT_PARAMETERS.year_end_monthly,
    ),
    employee_bonus_pct: toSafeNumber(
      row.employee_bonus_pct,
      DEFAULT_RESTAURANT_PARAMETERS.employee_bonus_pct,
    ),
    reserve_rate: toSafeNumber(
      row.reserve_rate,
      DEFAULT_RESTAURANT_PARAMETERS.reserve_rate,
    ),
  };
}

export async function fetchRestaurantParameters(): Promise<RestaurantParameters> {
  const { data, error } = await supabase
    .from('restaurant_parameters')
    .select('*')
    .eq('id', PARAMS_ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('[restaurantParameters] 載入失敗：', error.message);
    return { id: PARAMS_ROW_ID, ...DEFAULT_RESTAURANT_PARAMETERS };
  }

  if (!data) {
    return { id: PARAMS_ROW_ID, ...DEFAULT_RESTAURANT_PARAMETERS };
  }

  return mapRow(data as Record<string, unknown>);
}

/** App 初始化時預載，避免股東報表參數歸零 */
export function preloadRestaurantParameters(): Promise<RestaurantParameters> {
  if (cachedParams) return Promise.resolve(cachedParams);
  if (!preloadPromise) {
    preloadPromise = fetchRestaurantParameters().then((params) => {
      cachedParams = params;
      return params;
    });
  }
  return preloadPromise;
}

export function invalidateRestaurantParametersCache(): void {
  cachedParams = null;
  preloadPromise = null;
}

export async function saveRestaurantParameters(
  params: Omit<RestaurantParameters, 'id'>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const payload = {
    id: PARAMS_ROW_ID,
    tax_rate: params.tax_rate,
    year_end_monthly: params.year_end_monthly,
    employee_bonus_pct: params.employee_bonus_pct,
    reserve_rate: params.reserve_rate,
  };

  const { error } = await supabase
    .from('restaurant_parameters')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[restaurantParameters] 儲存失敗：', error.message);
    return { ok: false, message: error.message };
  }

  cachedParams = { id: PARAMS_ROW_ID, ...params };
  return { ok: true };
}
