import { useCallback, useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import MainDashboard from './components/MainDashboard';
import { useLanguage } from './context/LanguageContext';
import { supabase } from './lib/supabase';
import {
  clearRememberedSession,
  loadRememberedSession,
} from './lib/authSession';
import { loadExpenses, loadRevenues } from './services/storage';
import {
  fetchExpenseRecords,
  fetchRevenueRecords,
  migrateLocalLocksToCloud,
} from './services/financialRecords';
import { preloadRestaurantParameters } from './services/restaurantParameters';
import { fetchUserProfile } from './services/userProfile';
import { isShareholderGuestRole, normalizeAppRole, type AppRole } from './types/auth';
import type { ExpenseItem, RevenueItem } from './types';
import { isLockedAuditStatus } from './types';

export type NavTab = 'dashboard' | 'revenue' | 'expense' | 'report' | 'settings';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * 應用程式根元件。
 * 初始化時優先還原記住我憑證 → 自動進入主系統。
 */
export default function App() {
  const { t } = useLanguage();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [appRole, setAppRole] = useState<AppRole>('user');
  const [roleReady, setRoleReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [revenues, setRevenues] = useState<RevenueItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const isShareholderGuest = isShareholderGuestRole(appRole);

  const loadRevenuesFromCloud = useCallback(async (): Promise<boolean> => {
    const localLockedIds = loadRevenues()
      .filter((item) => isLockedAuditStatus(item.auditStatus))
      .map((item) => item.id);

    const result = await fetchRevenueRecords();
    if (!result.ok) {
      setSyncError(`營收同步失敗：${result.message}`);
      return false;
    }

    if (localLockedIds.length > 0) {
      await migrateLocalLocksToCloud(localLockedIds, result.data);
      const refreshed = await fetchRevenueRecords();
      if (refreshed.ok) {
        setRevenues(refreshed.data);
        setSyncWarning(
          refreshed.droppedCount > 0
            ? `有 ${refreshed.droppedCount} 筆營收紀錄格式不符已略過，若金額與雲端不符請聯繫管理員。`
            : null,
        );
      } else {
        setRevenues(result.data);
      }
    } else {
      setRevenues(result.data);
      setSyncWarning(
        result.droppedCount > 0
          ? `有 ${result.droppedCount} 筆營收紀錄格式不符已略過，若金額與雲端不符請聯繫管理員。`
          : null,
      );
    }

    return true;
  }, []);

  const loadExpensesFromCloud = useCallback(async (): Promise<boolean> => {
    const localLockedIds = loadExpenses()
      .filter((item) => isLockedAuditStatus(item.auditStatus))
      .map((item) => item.id);

    const result = await fetchExpenseRecords();
    if (!result.ok) {
      setSyncError(`支出同步失敗：${result.message}`);
      return false;
    }

    if (localLockedIds.length > 0) {
      await migrateLocalLocksToCloud(localLockedIds, result.data);
      const refreshed = await fetchExpenseRecords();
      if (refreshed.ok) {
        setExpenses(refreshed.data);
        if (refreshed.droppedCount > 0) {
          setSyncWarning(
            `有 ${refreshed.droppedCount} 筆支出紀錄格式不符已略過，若金額與雲端不符請聯繫管理員。`,
          );
        }
      } else {
        setExpenses(result.data);
      }
    } else {
      setExpenses(result.data);
      if (result.droppedCount > 0) {
        setSyncWarning(
          `有 ${result.droppedCount} 筆支出紀錄格式不符已略過，若金額與雲端不符請聯繫管理員。`,
        );
      }
    }

    return true;
  }, []);

  const refreshRevenues = useCallback(async () => {
    await loadRevenuesFromCloud();
  }, [loadRevenuesFromCloud]);

  const refreshExpenses = useCallback(async () => {
    await loadExpensesFromCloud();
  }, [loadExpensesFromCloud]);

  const refreshAllFinancialData = useCallback(async () => {
    const [revOk, expOk] = await Promise.all([
      loadRevenuesFromCloud(),
      loadExpensesFromCloud(),
    ]);
    if (revOk && expOk) {
      setSyncError(null);
    }
  }, [loadRevenuesFromCloud, loadExpensesFromCloud]);

  useEffect(() => {
    let mounted = true;
    let restoreDone = false;

    async function restoreSession() {
      if (localStorage.getItem('is_remember_me') === 'true') {
        const raw = localStorage.getItem('remember_me_session');
        if (raw) {
          try {
            const backupSession = JSON.parse(raw) as {
              access_token?: string;
              refresh_token?: string;
            };
            if (backupSession.access_token && backupSession.refresh_token) {
              const { data, error } = await supabase.auth.setSession({
                access_token: backupSession.access_token,
                refresh_token: backupSession.refresh_token,
              });
              if (!mounted) return;
              if (!error && data.session) {
                setAuthStatus('authenticated');
                restoreDone = true;
                return;
              }
            }
          } catch {
            // 備份 session 損壞，清除後改走一般流程
          }
          clearRememberedSession();
        }
      }

      const remembered = loadRememberedSession();
      if (remembered) {
        const { data, error } = await supabase.auth.setSession(remembered);
        if (!mounted) return;
        if (!error && data.session) {
          setAuthStatus('authenticated');
          restoreDone = true;
          return;
        }
        clearRememberedSession();
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      setAuthStatus(session ? 'authenticated' : 'unauthenticated');
      restoreDone = true;
    }

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted || !restoreDone) return;
        setAuthStatus(session ? 'authenticated' : 'unauthenticated');
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setAppRole('user');
      setRoleReady(authStatus === 'unauthenticated');
      return;
    }

    let mounted = true;
    setRoleReady(false);

    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!user) {
        setAppRole('user');
        setRoleReady(true);
        return;
      }

      const profile = await fetchUserProfile(user.id);
      if (!mounted) return;

      const role = normalizeAppRole(profile?.role);
      setAppRole(role);
      if (isShareholderGuestRole(role)) {
        setActiveTab('report');
      }
      setRoleReady(true);
    }

    void loadRole();
    return () => {
      mounted = false;
    };
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      void refreshAllFinancialData();
      preloadRestaurantParameters().catch((err) => {
        console.error('[App] 預載 restaurant_parameters 失敗：', err);
      });
    }
  }, [authStatus, refreshAllFinancialData]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshAllFinancialData();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authStatus, refreshAllFinancialData]);

  function handleLoginSuccess() {
    setAuthStatus('authenticated');
  }

  async function handleLogout() {
    clearRememberedSession();
    await supabase.auth.signOut();
    setAuthStatus('unauthenticated');
    setAppRole('user');
    setRoleReady(false);
    setActiveTab('dashboard');
    setIsMobileSidebarOpen(false);
  }

  function handleTabChange(tab: NavTab) {
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
  }

  function handleOpenSidebar() {
    setIsMobileSidebarOpen(true);
  }

  const handleCloseSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  if (authStatus === 'loading' || (authStatus === 'authenticated' && !roleReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canton-bg">
        <p className="text-sm text-canton-dark/50">{t('loading')}</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <MainDashboard
      revenues={revenues}
      expenses={expenses}
      syncError={syncError}
      syncWarning={syncWarning}
      onRetrySync={refreshAllFinancialData}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onLogout={handleLogout}
      onRevenuesChange={refreshRevenues}
      onExpensesChange={refreshExpenses}
      isMobileSidebarOpen={isMobileSidebarOpen}
      onOpenSidebar={handleOpenSidebar}
      onCloseSidebar={handleCloseSidebar}
      isShareholderGuest={isShareholderGuest}
    />
  );
}
