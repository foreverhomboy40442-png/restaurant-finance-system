/**
 * 營收表單金額欄位的前端即時驗證。
 * 規則：必須為非負整數（不含小數）。
 */
export interface AmountValidation {
  valid: boolean;
  error: string | null;
  parsedValue: number | null;
}

export function validateRevenueAmountInput(raw: string): AmountValidation {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { valid: false, error: null, parsedValue: null };
  }

  if (!/^\d+$/.test(trimmed)) {
    if (/[.-]/.test(trimmed) || trimmed.includes('e') || trimmed.includes('E')) {
      return { valid: false, error: '金額不可包含小數或負數', parsedValue: null };
    }
    return { valid: false, error: '請輸入有效的整數金額', parsedValue: null };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return { valid: false, error: '金額超出可接受範圍', parsedValue: null };
  }

  return { valid: true, error: null, parsedValue: parsed };
}

/** 金額顯示：千分位格式（等寬數字） */
export function formatMoneyDisplay(amount: number): string {
  return amount.toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
