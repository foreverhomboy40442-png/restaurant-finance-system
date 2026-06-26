import { useLanguage } from '../../context/LanguageContext';
import type { Lang } from '../../utils/lang';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  function handleChange(value: string) {
    setLang(value as Lang);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor="lang-switcher" className="sr-only">
        {t('selectLanguage')}
      </label>
      <select
        id="lang-switcher"
        value={lang}
        onChange={(e) => handleChange(e.target.value)}
        className="cursor-pointer rounded-sm border border-canton-dark/15 bg-white px-3 py-1.5 text-sm text-canton-dark/80 shadow-sm transition-colors hover:border-canton-red/35 hover:text-canton-dark focus:border-canton-red/50 focus:outline-none focus:ring-1 focus:ring-canton-red/30"
        aria-label={t('selectLanguage')}
      >
        <option value="zh">{t('langZh')}</option>
        <option value="en">{t('langEn')}</option>
      </select>
    </div>
  );
}
