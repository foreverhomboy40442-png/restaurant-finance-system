/**
 * 粵香園帳務系統 — 財務核心基礎型別
 *
 * 本檔案定義全系統共用的三個「原子單位」：
 * - Money：所有金額欄位的唯一合法型別
 * - FinancialDate：帳目歸屬的財務日（非操作當下時間）
 * - AuditStatus：帳目生命週期狀態（草稿 → 已審計 → 已鎖定）
 *
 * 後續模組（每日交易、經營支出、報表）皆應引用此處型別，避免各自發明不一致的表示法。
 */

// ---------------------------------------------------------------------------
// 一、財務金額（Money）
// ---------------------------------------------------------------------------

/**
 * 內部品牌標記，用於在編譯期區分「一般 number」與「已驗證的財務金額」。
 * 外部模組不應直接存取此符號。
 */
declare const MoneyBrand: unique symbol;

/**
 * 財務金額。
 *
 * 語意：
 * - 代表新台幣（TWD）的實際金額，單位為「元」，可含小數（如均攤後的 10000.5）。
 * - 必須為有限數字（finite），不可為 NaN、Infinity 或 undefined。
 * - 預設不可為負數；若業務上需表達退款或沖銷，應在領域層另行定義方向欄位，
 *   而非直接允許負的 Money。
 *
 * 使用方式：
 * - 請透過 {@link createMoney} 建立，以確保執行期驗證通過。
 * - 報表加總、百分比計算等運算結果，也應再次以 createMoney 包裝後再寫回。
 */
export type Money = number & { readonly [MoneyBrand]: typeof MoneyBrand };

/** 建立財務金額時的可選設定 */
export interface CreateMoneyOptions {
  /**
   * 是否允許零元。
   * @default true
   */
  allowZero?: boolean;
}

/**
 * 建立並驗證一筆財務金額。
 *
 * @param value - 原始數值（通常來自表單輸入或計算結果）
 * @param options - 驗證選項
 * @returns 通過驗證的 Money
 * @throws 若數值不合法（非數字、NaN、Infinity、負數等）
 */
export function createMoney(
  value: unknown,
  options: CreateMoneyOptions = {},
): Money {
  const { allowZero = true } = options;

  if (typeof value !== 'number') {
    throw new Error(`財務金額必須為數字，收到：${typeof value}`);
  }
  if (!Number.isFinite(value)) {
    throw new Error('財務金額不可為 NaN 或 Infinity');
  }
  if (value < 0) {
    throw new Error('財務金額不可為負數');
  }
  if (!allowZero && value === 0) {
    throw new Error('財務金額不可為零');
  }

  return value as Money;
}

/**
 * 執行期檢查：判斷未知值是否為合法的財務金額。
 * 常用於 localStorage 反序列化或 API 回應的防呆驗證。
 */
export function isMoney(value: unknown): value is Money {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
  );
}

// ---------------------------------------------------------------------------
// 二、財務日期（FinancialDate）
// ---------------------------------------------------------------------------

/**
 * 內部品牌標記，用於區分「一般字串」與「已驗證的財務歸屬日」。
 */
declare const FinancialDateBrand: unique symbol;

/**
 * 財務歸屬日期（Financial Date / Accounting Date）。
 *
 * 語意：
 * - 代表「這筆帳目算在哪一天」，格式固定為 ISO 8601 本地日曆日：`YYYY-MM-DD`。
 * - 與「使用者實際操作時間（createdAt）」不同。
 *   例如：老闆在 6/7 凌晨結算 6/6 的營收，FinancialDate 應為 `2026-06-06`，
 *   而非操作當下的 6/7，以確保日報、月報、股東報表的時間軸正確。
 *
 * PRD 對應：
 * - 每日交易的「當日 / 前一日 / 自訂日期」勾選，最終都應轉換為此型別後入帳。
 */
export type FinancialDate = string & {
  readonly [FinancialDateBrand]: typeof FinancialDateBrand;
};

/** ISO 本地日曆日格式：YYYY-MM-DD */
const FINANCIAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 建立並驗證一筆財務歸屬日期。
 *
 * @param value - 日期字串，必須符合 YYYY-MM-DD
 * @returns 通過驗證的 FinancialDate
 * @throws 若格式不符或日期本身不合法（如 2026-02-30）
 */
export function createFinancialDate(value: unknown): FinancialDate {
  if (typeof value !== 'string' || !FINANCIAL_DATE_PATTERN.test(value)) {
    throw new Error(
      `財務日期格式必須為 YYYY-MM-DD，收到：${String(value)}`,
    );
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`財務日期不存在或不合法：${value}`);
  }

  return value as FinancialDate;
}

/**
 * 執行期檢查：判斷未知值是否為合法的財務歸屬日期。
 */
export function isFinancialDate(value: unknown): value is FinancialDate {
  try {
    createFinancialDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 將 Date 物件轉換為財務歸屬日期（以本地時區的日曆日為準）。
 * 常用於「當日」快捷選項的預設值。
 */
export function toFinancialDateFromDate(date: Date): FinancialDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return createFinancialDate(`${year}-${month}-${day}`);
}

// ---------------------------------------------------------------------------
// 三、審計狀態（AuditStatus）
// ---------------------------------------------------------------------------

/**
 * 帳目審計生命週期狀態。
 *
 * 狀態流轉（單向，不可逆）：
 * ```
 * draft → audited → locked
 * ```
 *
 * | 狀態     | 語意                                   | 允許的操作           |
 * |----------|----------------------------------------|----------------------|
 * | draft    | 草稿：尚未確認，可自由修改或刪除       | 新增、編輯、刪除     |
 * | audited  | 已審計：經老闆確認，數值已核對         | 僅可檢視；可升級鎖定 |
 * | locked   | 已鎖定：核心帳目結案，進入唯讀防線     | 僅可檢視，不可變更   |
 *
 * PRD / .cursorrules 對應：
 * - 核心帳目一經 Audited / Locked，即不可修改或刪除，保障報表與股東分紅的可稽核性。
 */
export type AuditStatus = 'draft' | 'audited' | 'locked';

/** 各審計狀態的常數值，避免魔術字串散落各處 */
export const AUDIT_STATUS = {
  /** 草稿：尚未確認 */
  DRAFT: 'draft',
  /** 已審計：數值已核對 */
  AUDITED: 'audited',
  /** 已鎖定：唯讀，不可變更 */
  LOCKED: 'locked',
} as const satisfies Record<string, AuditStatus>;

/** 審計狀態的中文顯示標籤（供 UI 使用） */
export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  draft: '草稿',
  audited: '已審計',
  locked: '已鎖定',
};

/**
 * 執行期檢查：判斷未知值是否為合法的審計狀態。
 */
export function isAuditStatus(value: unknown): value is AuditStatus {
  return (
    value === AUDIT_STATUS.DRAFT ||
    value === AUDIT_STATUS.AUDITED ||
    value === AUDIT_STATUS.LOCKED
  );
}

/**
 * 判斷帳目是否已進入唯讀狀態（audited 或 locked）。
 * UI 層可用此函式決定是否顯示編輯 / 刪除按鈕。
 */
export function isReadOnlyAuditStatus(status: AuditStatus): boolean {
  return status === AUDIT_STATUS.AUDITED || status === AUDIT_STATUS.LOCKED;
}

/**
 * 判斷帳目是否已完全鎖定（最終防線）。
 * locked 狀態下，連「升級審計」等操作也應禁止。
 */
export function isLockedAuditStatus(status: AuditStatus): boolean {
  return status === AUDIT_STATUS.LOCKED;
}
