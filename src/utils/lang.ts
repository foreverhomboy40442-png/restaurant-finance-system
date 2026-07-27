import type { ExpenseCategory, AuditStatus, RevenuePeriod } from '../types';
import { EXPENSE_CATEGORY } from '../types';

export type Lang = 'zh' | 'en';

export const LANG_STORAGE_KEY = 'lang';

const zh = {
  // ── 通用 ──
  brandName: '粵香園',
  appTitle: '財務管理系統',
  loading: '系統載入中…',
  langZh: '繁體中文',
  langEn: 'English',
  selectLanguage: '語系',
  cancel: '取消',
  confirm: '確認',
  unitPercent: '%',
  unitCurrency: '元',

  // ── 登入 ──
  loginEmailLabel: '帳號',
  loginEmailPlaceholder: '請輸入完整 Email',
  passwordLabel: '密碼',
  rememberMe: '記住我',
  signIn: '登入',
  signingIn: '登入中…',
  errInvalidEmail: '請輸入有效的 Email 格式',
  errPasswordRequired: '請輸入密碼',
  errPasswordMin: '密碼長度至少 4 個字元',
  errLoginFailed: '登入失敗，請確認 Email 與密碼',

  // ── 側邊欄 / 導覽 ──
  navDashboard: '首頁',
  navRevenue: '營收',
  navExpense: '支出',
  navReport: '報表',
  navSettings: '設定',
  headingDashboard: '首頁儀表板',
  headingRevenue: '營收管理',
  headingExpense: '支出管理',
  headingReport: '報表中心',
  headingSettings: '帳號設定',
  logout: '登出',
  openMenu: '開啟選單',
  closeMenu: '關閉選單',

  // ── 首頁儀表板 ──
  periodDay: '當日',
  periodWeek: '當週',
  periodMonth: '當月',
  periodCustom: '自訂區間',
  totalRevenue: '總營收',
  totalExpense: '總支出',
  netProfit: '淨損益',
  goAddRevenue: '前往新增營收',
  goAddRevenueLong: '＋ 前往新增每日營收帳目',
  quickAdd: '快速新增',
  todoTitle: '待辦事項',
  todoPlaceholder: '輸入待辦事項，按 Enter 新增…',
  todoAdd: '新增',
  todoEmpty: '今日無待辦事項',
  revenueAlert: '提醒：今日尚未輸入營業收入！',
  dataRange: '資料區間',
  startDate: '開始日期',
  endDate: '結束日期',
  expenseStructure: '支出結構分析',

  // ── 支出 ──
  expenseLogging: '支出記帳',
  expenseLedger: '支出流水帳',
  expenseTabCash: '現金支出',
  expenseTabPt: 'PT 薪資',
  expenseTabPayment: '支付貨款',
  expenseTabRepair: '修繕費用',
  expenseTabFixed: '固定支出',
  quickAddExpense: '快速新增支出',
  dateLabel: '日期',
  amountLabel: '金額（元）',
  noteLabel: '備註（選填）',
  confirmAdd: '確認新增',
  confirmExpense: '確認新增支出',
  confirmUpdateExpense: '確認更新支出',
  confirmDeleteExpense: '確認刪除支出',

  // ── 營收 ──
  revenueDetails: '營收明細',
  revenueAddTitle: '新增營收帳目',
  revenueEditTitle: '編輯營收帳目',
  revenueEditMode: '編輯模式',
  revenueFinancialDate: '財務歸屬日',
  revenueSwitchToday: '切換回今天',
  revenueSwitchYesterday: '帶入前一日',
  revenuePreviousDay: '📅 前一日',
  revenueMealPeriod: '餐期',
  revenueOperator: '經手人',
  revenueAmountPlaceholder: '請輸入整數金額',
  revenueNotePlaceholder: '特殊說明',
  revenueAddEntry: '新增帳目',
  revenueUpdateEntry: '更新帳目',
  revenueCancelEdit: '取消編輯',
  revenuePendingList: '待核銷帳務清單',
  revenueTransactionLogs: '流水帳紀錄',
  revenueLockedCount: '已鎖定 {locked} / {total} 筆',
  revenueConfirmTitle: '確認帳目',
  revenueConfirmUpdateTitle: '確認更新帳目',
  revenueConfirmUpdate: '確認更新',
  revenueSubmit: '確認送出',
  revenueConfirmDeleteTitle: '確認刪除帳目',
  revenueConfirmDelete: '確認刪除',
  revenueConfirmCreatePrompt: '請確認今日帳目：',
  revenueConfirmUpdatePrompt: '請確認更新內容：',
  revenueConfirmTotal: '共 {amount} {currency}',
  revenueConfirmOk: '確認無誤？',
  revenueDeletePrompt: '確定要刪除以下草稿帳目嗎？此操作無法復原。',
  revenueEmptyPending: '目前無待核銷帳目',
  revenueEmptyPendingDesc: '所有帳目均已完成核帳，清單已整潔！',
  revenueOverflowWarning:
    '待核銷帳目已超出上限（僅顯示最新 15 筆），另有 {count} 筆較舊帳目未顯示。請盡速核銷以上帳目，清空待辦佇列。',
  colFinancialDate: '歸屬日',
  colMealPeriod: '餐期',
  colAmount: '金額',
  colOperator: '經手人',
  colNote: '備註',
  colStatus: '狀態',
  colActions: '操作',
  actionEdit: '編輯',
  actionDelete: '刪除',
  revenueLockConfirm: '確認核帳',
  revenuePageSummary: '第 {page} / {totalPages} 頁 · 共 {count} 筆待核銷',
  prevPage: '上一頁',
  nextPage: '下一頁',
  revenuePeriodLunch: '上午',
  revenuePeriodDinner: '下午',
  revenuePeriodAllDay: '全日',
  auditDraft: '草稿',
  auditAudited: '已審計',
  auditLocked: '已鎖定',
  errOperatorRequired: '請填寫經手人',
  errAmountRequired: '請輸入有效金額',
  errAmountInvalid: '金額不合法',
  errFinancialDateInvalid: '財務歸屬日格式不合法',
  errRecordNotFound: '找不到要更新的帳目',
  errSaveFailed: '儲存失敗',
  errDeleteFailed: '刪除失敗',
  errLockFailed: '鎖定失敗',
  errAmountNoDecimalOrNegative: '金額不可包含小數或負數',
  errAmountInvalidInteger: '請輸入有效的整數金額',
  errAmountOutOfRange: '金額超出可接受範圍',

  // ── 報表中心 ──
  reportAnalysis: '營運綜合分析',
  reportShareholder: '股東報表',

  // ── 股東報表 ──
  customMonthCombo: '自訂月份組合',
  selectAll: '全選',
  clearAll: '清除',
  monthsSelected: '已選 {count} 個月',
  financialParams: '財務參數設定',
  lockParams: '鎖定參數設定',
  taxRateLabel: '所得稅率',
  employeeBonusRateLabel: '員工紅利比例',
  yearEndReserveLabel: '月年終儲備',
  reserveRateLabel: '預留盈餘比例',
  confirmChanges: '確定變更',
  syncingParams: '同步至雲端…',
  loadingParams: '正在載入雲端財務參數…',
  shareholderReportTitle: '粵香園 · 股東財務報表',
  reportPeriod: '統計區間：{range}（共 {count} 個月）',
  exportPnl: '匯出損益報表',
  grossRevenue: '營業總收入',
  operatingExpenses: '營業總支出',
  expandDetails: '展開科目明細',
  collapseDetails: '收起明細',
  yearEndBonusReserve: '年終獎金儲備（{monthly}/月 × {months} 月）',
  netProfitBeforeTax: '＝ 稅前淨利',
  incomeTaxRate: '所得稅（{rate}%）',
  employeeBonusRate: '員工紅利（稅後淨利 × {rate}%）',
  shareholderSurplus: '＝ 股東盈餘',
  reservedSurplusRate: '預留盈餘（{rate}% 備用準備金）',
  finalDistributable: '★ 最終可分配盈餘',
  statsFooter: '統計 {count} 個月 · 已扣稅、員工紅利與預留準備金',
  emptyShareholder: '請先新增營收或支出明細，再查看股東報表。',
  emptyMonths: '請至少選取一個月份。',

  // ── 支出科目（報表細項標籤）──
  catIngredients: '食材採購',
  catLabor: '人事成本',
  catRent: '房租',
  catUtilities: '水電瓦斯',
  catMarketing: '行銷推廣',
  catRepair: '修繕',
  catFixedSalary: '固定支出',
  catOther: '雜支',

  // ── 支出科目（表單）──
  expenseCatIngredients: '食材',
  expenseCatLabor: 'PT 薪資',
  expenseCatRent: '房租',
  expenseCatUtilities: '水電',
  expenseCatMarketing: '行銷',
  expenseCatRepair: '修繕',
  expenseCatFixedSalary: '固定支出',
  expenseCatOther: '雜支',

  // ── 帳號設定 ──
  accountSettingsTitle: '帳號設定',
  originalEmail: '原本信箱',
  newEmailLabel: '改為新信箱',
  newEmailPlaceholder: 'name@example.com',
  newPassword: '新密碼（留空表示不變更）',
  confirmNewPassword: '確認新密碼',
  toggleShowPassword: '顯示密碼',
  toggleHidePassword: '隱藏密碼',
  saveAccount: '儲存變更',
  savingAccount: '更新中…',
  errChangeRequired: '請至少變更信箱或密碼其中一項',
  errPasswordMismatch: '兩次輸入的新密碼不一致',
  errLoadAccountFailed: '無法載入帳號資料',
  errSaveAccountFailed: '儲存失敗，請稍後再試',
  msgEmailVerificationSent: '驗證信已寄出，請至新舊信箱查收連結以完成變更',
  msgEmailAndPasswordUpdated: '密碼已更新。驗證信已寄出，請至新舊信箱查收連結以完成變更',
  msgPasswordUpdated: '密碼已成功更新。',

  // ── 報表營運分析 ──
  reportToday: '今日',
  reportThisMonth: '本月',
  reportThisYear: '本年',
  reportCategoryRatio: '科目支出比例',
  reportClickExpandCategory: '點擊科目列可展開各筆明細',
  colCategory: '科目',
  colTotalAmount: '總金額',
  colPctOfTotalExpense: '佔總支出',
  entryCount: '{count} 筆',
  totalLabel: '合計',
  noExpenseData: '暫無支出資料',
  monthlyTrendTitle: '月度收支趨勢',
  monthlyTrendDesc: '展示全時段月度走勢，不受上方時間篩選影響。',
  noMonthlyData: '暫無月度資料',
  grossMarginPct: '毛利率 {pct}',
  totalPnL: '總損益',
  chartNoData: '暫無資料',
  errParamsSyncFailed: '參數同步失敗：{message}',
  expensePendingEmpty: '待核銷佇列為空',
  expensePendingEmptyDesc: '所有支出帳目皆已核帳完成',
  expensePendingQueueHint: '筆待核銷 · 確認核帳後自動移出佇列',
  colExpenseCategory: '支出科目',
  colMerchant: '供應商/店家',
  expensePageRange: '顯示第 {start}–{end} 筆，共 {total} 筆待核銷',
  firstPage: '第一頁',
  lastPage: '最後頁',
  expensePageOf: '第 {page} / {totalPages} 頁',
  chartExpenseCategoryShare: '支出類別佔比',
  chartSubCategoryDrill: '子科目下鑽分析',
  chartNoCategoryData: '此類別暫無支出資料',
  chartNoRangeData: '該區間暫無支出資料',
  drillShortCash: '現金',
  drillShortPayment: '貨款',
  drillShortRepair: '修繕',
  drillShortFixed: '固定',
} as const;

const en: Record<keyof typeof zh, string> = {
  brandName: 'SHIANGARDEN',
  appTitle: 'Financial Management System',
  loading: 'Loading…',
  langZh: '繁體中文',
  langEn: 'English',
  selectLanguage: 'Language',
  cancel: 'Cancel',
  confirm: 'Confirm',
  unitPercent: '%',
  unitCurrency: 'TWD',

  loginEmailLabel: 'Email',
  loginEmailPlaceholder: 'Enter your full email address',
  passwordLabel: 'Password',
  rememberMe: 'Remember me',
  signIn: 'Sign In',
  signingIn: 'Signing in…',
  errInvalidEmail: 'Please enter a valid email address.',
  errPasswordRequired: 'Please enter your password',
  errPasswordMin: 'Password must be at least 4 characters',
  errLoginFailed: 'Sign-in failed. Check your email and password.',

  navDashboard: 'Home',
  navRevenue: 'Revenue',
  navExpense: 'Expenses',
  navReport: 'Reports',
  navSettings: 'Settings',
  headingDashboard: 'Dashboard',
  headingRevenue: 'Revenue Management',
  headingExpense: 'Expense Logging',
  headingReport: 'Report Center',
  headingSettings: 'Account Settings',
  logout: 'Sign Out',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',

  periodDay: 'Today',
  periodWeek: 'This Week',
  periodMonth: 'This Month',
  periodCustom: 'Custom Range',
  totalRevenue: 'Total Revenue',
  totalExpense: 'Total Expenses',
  netProfit: 'Net Profit',
  goAddRevenue: 'Add Revenue',
  goAddRevenueLong: '+ Add Daily Revenue',
  quickAdd: 'Quick Add',
  todoTitle: 'To-Do List',
  todoPlaceholder: 'Add a task, press Enter…',
  todoAdd: 'Add',
  todoEmpty: 'No tasks for today',
  revenueAlert: 'Reminder: today\'s revenue has not been recorded!',
  dataRange: 'Date Range',
  startDate: 'Start Date',
  endDate: 'End Date',
  expenseStructure: 'Expense Breakdown',

  expenseLogging: 'Expense Logging',
  expenseLedger: 'Expense Ledger',
  expenseTabCash: 'Cash Expenses',
  expenseTabPt: 'Part-Time Payroll',
  expenseTabPayment: 'Vendor Payments',
  expenseTabRepair: 'Repairs',
  expenseTabFixed: 'Fixed Costs',
  quickAddExpense: 'Quick Expense Entry',
  dateLabel: 'Date',
  amountLabel: 'Amount',
  noteLabel: 'Note (optional)',
  confirmAdd: 'Confirm',
  confirmExpense: 'Confirm New Expense',
  confirmUpdateExpense: 'Confirm Update',
  confirmDeleteExpense: 'Confirm Delete',

  revenueDetails: 'Revenue Details',
  revenueAddTitle: 'Add Revenue',
  revenueEditTitle: 'Edit Revenue',
  revenueEditMode: 'Edit Mode',
  revenueFinancialDate: 'Date',
  revenueSwitchToday: 'Switch to today',
  revenueSwitchYesterday: 'Use previous day',
  revenuePreviousDay: '📅 Previous Day',
  revenueMealPeriod: 'Period',
  revenueOperator: 'Operator',
  revenueAmountPlaceholder: 'Enter whole number amount',
  revenueNotePlaceholder: 'Notes',
  revenueAddEntry: 'Add Revenue',
  revenueUpdateEntry: 'Update Entry',
  revenueCancelEdit: 'Cancel Edit',
  revenuePendingList: 'Pending Reconciliation',
  revenueTransactionLogs: 'Transaction Logs',
  revenueLockedCount: '{locked} of {total} locked',
  revenueConfirmTitle: 'Confirm Entry',
  revenueConfirmUpdateTitle: 'Confirm Update',
  revenueConfirmUpdate: 'Confirm Update',
  revenueSubmit: 'Submit',
  revenueConfirmDeleteTitle: 'Confirm Delete',
  revenueConfirmDelete: 'Confirm Delete',
  revenueConfirmCreatePrompt: 'Please confirm today\'s entry:',
  revenueConfirmUpdatePrompt: 'Please confirm the update:',
  revenueConfirmTotal: 'Total: {amount} {currency}',
  revenueConfirmOk: 'Is this correct?',
  revenueDeletePrompt: 'Delete this draft entry? This cannot be undone.',
  revenueEmptyPending: 'No pending entries',
  revenueEmptyPendingDesc: 'All entries reconciled. Queue is clear!',
  revenueOverflowWarning:
    'Pending queue exceeds limit (showing latest 15). {count} older entries hidden. Please reconcile promptly.',
  colFinancialDate: 'Date',
  colMealPeriod: 'Period',
  colAmount: 'Amount',
  colOperator: 'Operator',
  colNote: 'Note',
  colStatus: 'Status',
  colActions: 'Actions',
  actionEdit: 'Edit',
  actionDelete: 'Delete',
  revenueLockConfirm: 'Confirm & Lock',
  revenuePageSummary: 'Page {page} / {totalPages} · {count} pending',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  revenuePeriodLunch: 'Lunch',
  revenuePeriodDinner: 'Dinner',
  revenuePeriodAllDay: 'All Day',
  auditDraft: 'Draft',
  auditAudited: 'Audited',
  auditLocked: 'Locked',
  errOperatorRequired: 'Please enter the operator name.',
  errAmountRequired: 'Please enter a valid amount.',
  errAmountInvalid: 'Invalid amount.',
  errFinancialDateInvalid: 'Invalid financial date format.',
  errRecordNotFound: 'Entry not found.',
  errSaveFailed: 'Save failed.',
  errDeleteFailed: 'Delete failed.',
  errLockFailed: 'Lock failed.',
  errAmountNoDecimalOrNegative: 'Amount cannot contain decimals or negatives.',
  errAmountInvalidInteger: 'Please enter a valid whole number.',
  errAmountOutOfRange: 'Amount exceeds acceptable range.',

  reportAnalysis: 'Operational Analysis',
  reportShareholder: 'Shareholder Report',

  customMonthCombo: 'Custom Month Range',
  selectAll: 'Select All',
  clearAll: 'Clear',
  monthsSelected: '{count} month(s) selected',
  financialParams: 'Financial Parameters',
  lockParams: 'Lock Parameters',
  taxRateLabel: 'Income Tax Rate',
  employeeBonusRateLabel: 'Employee Bonus Rate',
  yearEndReserveLabel: 'Monthly Year-End Reserve',
  reserveRateLabel: 'Retained Earnings Rate',
  confirmChanges: 'Apply Changes',
  syncingParams: 'Syncing to cloud…',
  loadingParams: 'Loading cloud parameters…',
  shareholderReportTitle: 'SHIANGARDEN · Shareholder Financial Report',
  reportPeriod: 'Period: {range} ({count} month(s))',
  exportPnl: 'Export P&L',
  grossRevenue: 'Gross Revenue',
  operatingExpenses: 'Operating Expenses',
  expandDetails: 'Expand breakdown',
  collapseDetails: 'Collapse breakdown',
  yearEndBonusReserve: 'Year-End Bonus Reserve ({monthly}/mo × {months} mo)',
  netProfitBeforeTax: '= Net Profit Before Tax',
  incomeTaxRate: 'Income Tax ({rate}%)',
  employeeBonusRate: 'Employee Bonus (Net × {rate}%)',
  shareholderSurplus: '= Shareholder Surplus',
  reservedSurplusRate: 'Retained Earnings ({rate}% reserve)',
  finalDistributable: '★ Final Distributable Earnings',
  statsFooter: '{count} month(s) · After tax, bonus & reserves',
  emptyShareholder: 'Add revenue or expense records before viewing the shareholder report.',
  emptyMonths: 'Please select at least one month.',

  catIngredients: 'Food & Ingredients',
  catLabor: 'Labor & Payroll',
  catRent: 'Rent',
  catUtilities: 'Utilities',
  catMarketing: 'Marketing',
  catRepair: 'Repairs',
  catFixedSalary: 'Fixed Costs',
  catOther: 'Miscellaneous',

  expenseCatIngredients: 'Food & Ingredients',
  expenseCatLabor: 'Labor & Payroll',
  expenseCatRent: 'Rent',
  expenseCatUtilities: 'Utilities',
  expenseCatMarketing: 'Marketing',
  expenseCatRepair: 'Repairs',
  expenseCatFixedSalary: 'Fixed Costs',
  expenseCatOther: 'Miscellaneous',

  reportToday: 'Today',
  reportThisMonth: 'This Month',
  reportThisYear: 'This Year',
  reportCategoryRatio: 'Expense by Category',
  reportClickExpandCategory: 'Click a row to expand line items',
  colCategory: 'Category',
  colTotalAmount: 'Total Amount',
  colPctOfTotalExpense: '% of Expenses',
  entryCount: '{count} entries',
  totalLabel: 'Total',
  noExpenseData: 'No expense data',
  monthlyTrendTitle: 'Monthly Revenue & Expenses',
  monthlyTrendDesc: 'Full-period trend; not affected by the date filter above.',
  noMonthlyData: 'No monthly data',
  grossMarginPct: 'Gross Margin {pct}',
  totalPnL: 'Net P&L',
  chartNoData: 'No data',
  errParamsSyncFailed: 'Parameter sync failed: {message}',
  expensePendingEmpty: 'Reconciliation queue is empty',
  expensePendingEmptyDesc: 'All expense entries have been reconciled',
  expensePendingQueueHint: ' pending · removed after confirm & lock',
  colExpenseCategory: 'Category',
  colMerchant: 'Vendor',
  expensePageRange: 'Showing {start}–{end} of {total} pending',
  firstPage: 'First page',
  lastPage: 'Last page',
  expensePageOf: 'Page {page} / {totalPages}',
  chartExpenseCategoryShare: 'Expense Category Share',
  chartSubCategoryDrill: 'Sub-Category Drill-Down',
  chartNoCategoryData: 'No expenses in this category',
  chartNoRangeData: 'No expenses in this period',
  drillShortCash: 'Cash',
  drillShortPayment: 'Pay',
  drillShortRepair: 'Repair',
  drillShortFixed: 'Fixed',

  accountSettingsTitle: 'Account Settings',
  originalEmail: 'Current Email',
  newEmailLabel: 'New Email',
  newEmailPlaceholder: 'name@example.com',
  newPassword: 'New Password (leave blank to keep)',
  confirmNewPassword: 'Confirm New Password',
  toggleShowPassword: 'Show password',
  toggleHidePassword: 'Hide password',
  saveAccount: 'Save Changes',
  savingAccount: 'Saving…',
  errChangeRequired: 'Please change email or password.',
  errPasswordMismatch: 'Passwords do not match.',
  errLoadAccountFailed: 'Unable to load account data.',
  errSaveAccountFailed: 'Save failed. Please try again.',
  msgEmailVerificationSent: 'Verification emails sent. Check both your old and new inboxes to confirm the change.',
  msgEmailAndPasswordUpdated: 'Password updated. Verification emails sent—check both inboxes to confirm the email change.',
  msgPasswordUpdated: 'Password updated successfully.',
};

export const translations = { zh, en } as const;

export type TranslationKey = keyof typeof zh;

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return localStorage.getItem(LANG_STORAGE_KEY) === 'en' ? 'en' : 'zh';
}

export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const text = translations[lang][key];
  return vars ? interpolate(text, vars) : text;
}

const EXPENSE_CAT_KEYS: Record<ExpenseCategory, TranslationKey> = {
  [EXPENSE_CATEGORY.INGREDIENTS]: 'expenseCatIngredients',
  [EXPENSE_CATEGORY.LABOR]: 'expenseCatLabor',
  [EXPENSE_CATEGORY.RENT]: 'expenseCatRent',
  [EXPENSE_CATEGORY.UTILITIES]: 'expenseCatUtilities',
  [EXPENSE_CATEGORY.MARKETING]: 'expenseCatMarketing',
  [EXPENSE_CATEGORY.REPAIR]: 'expenseCatRepair',
  [EXPENSE_CATEGORY.FIXED_SALARY]: 'expenseCatFixedSalary',
  [EXPENSE_CATEGORY.OTHER]: 'expenseCatOther',
};

const BREAKDOWN_CAT_KEYS: Record<string, TranslationKey> = {
  ingredients: 'catIngredients',
  labor: 'catLabor',
  rent: 'catRent',
  utilities: 'catUtilities',
  marketing: 'catMarketing',
  repair: 'catRepair',
  fixed_salary: 'catFixedSalary',
  other: 'catOther',
};

/** 資料庫／報表可能出現的中文標籤 → 英文顯示（不影響寫入或比對） */
export const DATA_LABEL_EN: Readonly<Record<string, string>> = {
  '營業總收入': 'Gross Revenue',
  '營業收入': 'Gross Revenue',
  '營業總支出': 'Operating Expenses',
  '營業支出': 'Operating Expenses',
  '年終獎金儲備': 'Year-End Bonus Reserve',
  '年終獎金提撥': 'Year-End Bonus Reserve',
  '稅前淨利': 'Net Profit Before Tax',
  '＝ 稅前淨利': 'Net Profit Before Tax',
  '所得稅': 'Income Tax',
  '員工紅利': 'Employee Bonus',
  '股東盈餘': 'Shareholder Surplus',
  '＝ 股東盈餘': 'Shareholder Surplus',
  '預留盈餘': 'Retained Earnings',
  '最終可分配盈餘': 'Final Distributable Earnings',
  '★ 最終可分配盈餘': 'Final Distributable Earnings',
  '食材採購': 'Food & Ingredients',
  '人事成本': 'Labor & Payroll',
  '薪資': 'Labor & Payroll',
  '房租': 'Rent',
  '租金': 'Rent',
  '水電瓦斯': 'Utilities',
  '公用事業': 'Utilities',
  '水電': 'Utilities',
  '行銷推廣': 'Marketing',
  '行銷': 'Marketing',
  '修繕': 'Repairs',
  '固定支出': 'Fixed Costs',
  '固定薪資': 'Fixed Costs',
  '雜支': 'Miscellaneous',
  '食材': 'Food & Ingredients',
  'PT 薪資': 'Labor & Payroll',
  '支出': 'Expense',
  '草稿': 'Draft',
  '已審計': 'Audited',
  '已鎖定': 'Locked',
  '其他': 'Other',
  '合計': 'Total',
  '現金支出': 'Cash Expenses',
  'PT薪資': 'Labor & Payroll',
  '支付貨款': 'Vendor Payments',
  '修繕費用': 'Repairs',
  '現金': 'Cash',
  '貨款': 'Payment',
  '固定': 'Fixed',
};

export function translateDataLabel(lang: Lang, label: string): string {
  if (lang === 'zh') return label;
  const trimmed = label.trim();
  return DATA_LABEL_EN[trimmed] ?? trimmed;
}

export function formatMonthShortLabel(lang: Lang, ym: string): string {
  const m = parseInt(ym.split('-')[1], 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return ym;
  if (lang === 'en') {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  }
  return `${m}月`;
}

export function getBreakdownCategoryLabel(
  lang: Lang,
  key: string,
): string {
  const tk = BREAKDOWN_CAT_KEYS[key];
  if (tk) return translate(lang, tk);
  return translateDataLabel(lang, key);
}

export function getExpenseCategoryLabel(
  lang: Lang,
  category: ExpenseCategory,
): string {
  return translate(lang, EXPENSE_CAT_KEYS[category]);
}

/** 顯示 main_category 或任意資料庫中文標籤（僅 UI，不變更儲存值） */
export function getDisplayCategoryLabel(
  lang: Lang,
  rawLabel: string,
  category?: ExpenseCategory,
): string {
  if (category) return getExpenseCategoryLabel(lang, category);
  return translateDataLabel(lang, rawLabel);
}

const REVENUE_PERIOD_KEYS: Record<RevenuePeriod, TranslationKey> = {
  lunch: 'revenuePeriodLunch',
  dinner: 'revenuePeriodDinner',
  all_day: 'revenuePeriodAllDay',
};

const AUDIT_STATUS_KEYS: Record<AuditStatus, TranslationKey> = {
  draft: 'auditDraft',
  audited: 'auditAudited',
  locked: 'auditLocked',
};

const AMOUNT_ERROR_KEYS: Record<string, TranslationKey> = {
  '金額不可包含小數或負數': 'errAmountNoDecimalOrNegative',
  '請輸入有效的整數金額': 'errAmountInvalidInteger',
  '金額超出可接受範圍': 'errAmountOutOfRange',
};

export function getRevenuePeriodLabel(
  lang: Lang,
  period: RevenuePeriod,
): string {
  return translate(lang, REVENUE_PERIOD_KEYS[period]);
}

export function getAuditStatusLabel(
  lang: Lang,
  status: AuditStatus,
): string {
  return translate(lang, AUDIT_STATUS_KEYS[status]);
}

export function translateAmountValidationError(
  lang: Lang,
  error: string | null,
): string | null {
  if (!error) return null;
  const key = AMOUNT_ERROR_KEYS[error];
  return key ? translate(lang, key) : error;
}
