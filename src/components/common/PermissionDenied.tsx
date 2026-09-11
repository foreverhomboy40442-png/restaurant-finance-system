/**
 * 無權限訪問頁面提示
 */

import { useLanguage } from '../../context/LanguageContext';

export default function PermissionDenied() {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <p className="max-w-md text-base font-medium leading-relaxed text-canton-dark/80 md:text-lg">
        {t('permissionDenied')}
      </p>
    </div>
  );
}
