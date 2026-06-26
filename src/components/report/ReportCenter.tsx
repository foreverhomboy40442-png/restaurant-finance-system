/**
 * 報表中心 — 主容器
 */

import { useState } from 'react';
import type { ExpenseItem, RevenueItem } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../utils/lang';
import ManagementTab from './tabs/ManagementTab';
import ShareholderTab from './tabs/ShareholderTab';

interface ReportCenterProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
}

type ReportTab = 'analysis' | 'shareholder';

const REPORT_TAB_KEYS: Record<ReportTab, TranslationKey> = {
  analysis: 'reportAnalysis',
  shareholder: 'reportShareholder',
};

export default function ReportCenter({
  revenues,
  expenses,
}: ReportCenterProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ReportTab>('analysis');

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-sm border border-canton-dark/8 bg-white p-1 shadow-canton">
          {(Object.keys(REPORT_TAB_KEYS) as ReportTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-sm px-5 py-3 text-sm font-semibold transition-colors md:min-w-[160px] ${
                activeTab === tab
                  ? 'bg-canton-red text-white'
                  : 'text-canton-dark/60 hover:bg-canton-bg hover:text-canton-dark'
              }`}
            >
              {t(REPORT_TAB_KEYS[tab])}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'analysis' && (
        <ManagementTab revenues={revenues} expenses={expenses} />
      )}
      {activeTab === 'shareholder' && (
        <ShareholderTab revenues={revenues} expenses={expenses} />
      )}
    </div>
  );
}
