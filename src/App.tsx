import { useCallback, useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import MainDashboard from './components/MainDashboard';
import { useLanguage } from './context/LanguageContext';
import { supabase } from './lib/supabase';
import {
  clearRememberedSession,
  loadRememberedSession,
} from './lib/authSession';
import { loadRevenues } from './services/storage';
import { fetchExpenseRecords } from './services/financialRecords';
import { preloadRestaurantParameters } from './services/restaurantParameters';
import type { ExpenseItem, RevenueItem } from './types';

export type NavTab = 'dashboard' | 'revenue' | 'expense' | 'report' | 'settings';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * 應用程式根元件。
 * 初始化時優先還原記住我憑證 → 自動進入主系統。
 */
export default function App() {
  const { t } = useLanguage();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [revenues, setRevenues] = useState<RevenueItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  const refreshRevenues = useCallback(() => {
    const items = loadRevenues();
    setRevenues(items);
  }, []);

  const refreshExpenses = useCallback(async () => {
    const items = await fetchExpenseRecords();
    setExpenses(items);
  }, []);

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
    if (authStatus === 'authenticated') {
      refreshRevenues();
      void refreshExpenses();
      preloadRestaurantParameters().catch((err) => {
        console.error('[App] 預載 restaurant_parameters 失敗：', err);
      });
    }
  }, [authStatus, refreshRevenues, refreshExpenses]);

  function handleLoginSuccess() {
    setAuthStatus('authenticated');
  }

  async function handleLogout() {
    clearRememberedSession();
    await supabase.auth.signOut();
    setAuthStatus('unauthenticated');
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

  if (authStatus === 'loading') {
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
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onLogout={handleLogout}
      onRevenuesChange={refreshRevenues}
      onExpensesChange={refreshExpenses}
      isMobileSidebarOpen={isMobileSidebarOpen}
      onOpenSidebar={handleOpenSidebar}
      onCloseSidebar={handleCloseSidebar}
    />
  );
}
