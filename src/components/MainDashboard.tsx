import { useEffect } from 'react';
import type { ExpenseItem, RevenueItem } from '../types';
import type { NavTab } from '../App';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from './common/LanguageSwitcher';
import DashboardHome from './dashboard/DashboardHome';
import ExpenseManagement from './expense/ExpenseManagement';
import ReportCenter from './report/ReportCenter';
import RevenueManagement from './revenue/RevenueManagement';
import AccountSettings from './settings/AccountSettings';

interface MainDashboardProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
  syncError: string | null;
  syncWarning: string | null;
  onRetrySync: () => void | Promise<void>;
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  onRevenuesChange: () => void | Promise<void>;
  onExpensesChange: () => void | Promise<void>;
  isMobileSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onCloseSidebar: () => void;
}

import type { TranslationKey } from '../utils/lang';

const NAV_TAB_KEYS: Record<NavTab, TranslationKey> = {
  dashboard: 'navDashboard',
  revenue: 'navRevenue',
  expense: 'navExpense',
  report: 'navReport',
  settings: 'navSettings',
};

const HEADING_TAB_KEYS: Record<NavTab, TranslationKey> = {
  dashboard: 'headingDashboard',
  revenue: 'headingRevenue',
  expense: 'headingExpense',
  report: 'headingReport',
  settings: 'headingSettings',
};

const NAV_ORDER: NavTab[] = ['dashboard', 'revenue', 'expense', 'report', 'settings'];


function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

/**
 * 側邊欄內容（桌面版 & 手機版抽屜完全統一為深紅主題）
 */
interface SidebarContentProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  onClose?: () => void;
}

function SidebarContent({ activeTab, onTabChange, onLogout, onClose }: SidebarContentProps) {
  const { t } = useLanguage();

  return (
    <>
      {/* Logo 區塊 */}
      <div className="flex items-center gap-2.5 border-b border-white/15 px-5 py-5">
        <img src="/logo.png" alt={t('brandName')} className="h-9 w-9 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white">{t('brandName')}</p>
          <p className="text-xs text-white/60">{t('appTitle')}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={t('closeMenu')}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* 導覽列表 */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ORDER.map((id) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`relative flex w-full items-center px-6 py-4 text-left text-[15px] transition-colors ${
                active
                  ? 'bg-white/15 font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-white'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {t(NAV_TAB_KEYS[id])}
            </button>
          );
        })}
      </nav>

      {/* 登出 */}
      <div className="border-t border-white/15 px-5 py-4">
        <button
          type="button"
          onClick={onLogout}
          className="text-sm text-white/60 transition-colors hover:text-white"
        >
          {t('logout')}
        </button>
      </div>
    </>
  );
}

/**
 * 主系統畫面
 *
 * RWD 策略（純 CSS 雙軌，無 JS media query）：
 * ─ md+：左側 fixed 深紅 Sidebar（hidden md:flex）；主工作區 md:pl-64 讓位
 * ─ <md：Sidebar 完全不佔版面；漢堡按鈕叫出深紅抽屜 + 黑色 Backdrop 遮罩
 */
export default function MainDashboard({
  revenues,
  expenses,
  syncError,
  syncWarning,
  onRetrySync,
  activeTab,
  onTabChange,
  onLogout,
  onRevenuesChange,
  onExpensesChange,
  isMobileSidebarOpen,
  onOpenSidebar,
  onCloseSidebar,
}: MainDashboardProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-canton-bg">
      {/* ════════════════════════════════════════════════
          桌面版固定側邊欄：hidden（手機） → md:flex（桌面）
          ════════════════════════════════════════════════ */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 bg-canton-red">
        <SidebarContent
          activeTab={activeTab}
          onTabChange={onTabChange}
          onLogout={onLogout}
        />
      </aside>

      {/* ════════════════════════════════════════════════
          手機版抽屜：fixed left-0，md:hidden 桌面不顯示
          開關由 translate-x 控制，始終留在 DOM 中
          ════════════════════════════════════════════════ */}
      <aside
        id="mobile-sidebar"
        aria-hidden={!isMobileSidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-canton-red shadow-canton-md transition-transform duration-300 ease-in-out md:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          activeTab={activeTab}
          onTabChange={onTabChange}
          onLogout={onLogout}
          onClose={onCloseSidebar}
        />
      </aside>

      {/* ════════════════════════════════════════════════
          Backdrop 遮罩：抽屜開啟時覆蓋右側，點擊收回
          md:hidden 確保桌面版永不顯示
          ════════════════════════════════════════════════ */}
      {isMobileSidebarOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onCloseSidebar}
        />
      )}

      {/* ════════════════════════════════════════════════
          主工作區：md:pl-64 為固定側邊欄讓位
          ════════════════════════════════════════════════ */}
      <div className="flex min-h-screen flex-col md:pl-64">
        {/* 頂部 Header */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center border-b border-canton-dark/8 bg-white px-4 py-3 md:px-10 md:py-4">
          {/* ── 漢堡按鈕：僅手機顯示（md:hidden） ── */}
          <div className="flex items-center mr-4 md:hidden">
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex h-11 w-11 items-center justify-center rounded-sm text-canton-dark transition-colors hover:bg-canton-bg hover:text-canton-red active:bg-canton-red/5"
              aria-label={t('openMenu')}
              aria-expanded={isMobileSidebarOpen}
              aria-controls="mobile-sidebar"
            >
              <MenuIcon />
            </button>
          </div>

          {/* 頁面標題區 */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-canton-dark md:text-lg">
              {t(HEADING_TAB_KEYS[activeTab])}
            </p>
          </div>

          <LanguageSwitcher className="shrink-0" />
        </header>

        {/* 內容區 */}
        <main className="flex-1 px-4 py-5 sm:px-6 md:px-10 md:py-10">
          {syncError && (
            <div
              className="mb-4 flex flex-col gap-3 rounded-sm border border-canton-red/30 bg-canton-red/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
            >
              <p className="text-sm text-canton-red">
                {t('syncErrorBanner', { message: syncError })}
              </p>
              <button
                type="button"
                onClick={() => void onRetrySync()}
                className="shrink-0 rounded-sm border border-canton-red/40 px-3 py-1.5 text-xs font-medium text-canton-red hover:bg-canton-red/10"
              >
                {t('syncRetry')}
              </button>
            </div>
          )}

          {!syncError && syncWarning && (
            <div
              className="mb-4 rounded-sm border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="status"
            >
              {syncWarning}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardHome
              revenues={revenues}
              expenses={expenses}
              onNavigateToRevenue={() => onTabChange('revenue')}
            />
          )}

          {activeTab === 'revenue' && (
            <RevenueManagement
              revenues={revenues}
              onRevenuesChange={onRevenuesChange}
              defaultOperatorId="admin"
            />
          )}

          {activeTab === 'expense' && (
            <ExpenseManagement
              expenses={expenses}
              onExpensesChange={onExpensesChange}
              defaultOperatorId="admin"
            />
          )}

          {activeTab === 'report' && (
            <ReportCenter
              revenues={revenues}
              expenses={expenses}
            />
          )}

          {activeTab === 'settings' && <AccountSettings />}
        </main>
      </div>
    </div>
  );
}
