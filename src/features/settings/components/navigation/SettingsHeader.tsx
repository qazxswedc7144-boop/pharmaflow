import React from 'react';
import { Settings, Search, Save, X, ArrowRight } from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';

interface SettingsHeaderProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onBackToDashboard?: () => void;
  onBackToCardList?: () => void;
  isMobileDrillDown?: boolean;
  activeSectionTitle?: string;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSave,
  isSaving,
  onBackToDashboard,
  onBackToCardList,
  isMobileDrillDown = false,
  activeSectionTitle
}) => {
  return (
    <header className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs p-3.5 sm:p-4 box-border w-full transition-all">
      {/* Desktop & Tablet Top Bar / Mobile Row 1 */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* Left Side (RTL Start): Back + Icon + Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {isMobileDrillDown ? (
            <button
              onClick={onBackToCardList}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 flex items-center justify-center cursor-pointer"
              aria-label="العودة لقائمة أقسام الإعدادات"
              title="العودة للقائمة الرئيسية"
            >
              <ArrowRight size={18} className="text-slate-700 dark:text-slate-200" />
            </button>
          ) : (
            onBackToDashboard && (
              <BackButton 
                onClick={onBackToDashboard}
                className="shrink-0"
              />
            )
          )}

          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#1E4D4D]/10 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-[#1E4D4D] dark:text-emerald-400 shrink-0 border border-[#1E4D4D]/15 dark:border-emerald-800/40">
            <Settings size={20} className="animate-spin-slow" />
          </div>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-850 dark:text-slate-100 font-cairo leading-tight truncate">
              {isMobileDrillDown && activeSectionTitle ? activeSectionTitle : 'مركز إعدادات النظام'}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-cairo hidden sm:block truncate">
              {isMobileDrillDown ? 'تعديل وحفظ خيارات وتفضيلات هذا القسم' : 'الإعدادات الإدارية والتنفيذية الحاكمة لتطبيق PharmaFlow'}
            </p>
          </div>
        </div>

        {/* Right Side (RTL End): Search on Desktop + Save Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop Search Bar */}
          <div className="relative hidden md:block w-52 lg:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
            <input
              type="text"
              placeholder="ابحث في الإعدادات..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#1E4D4D]/20 focus:border-[#1E4D4D] dark:text-white transition-all font-cairo"
              aria-label="البحث في إعدادات النظام"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                aria-label="مسح البحث"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Save Action Button */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white font-bold font-cairo text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95
              ${isSaving ? 'bg-emerald-700 cursor-not-allowed opacity-90' : 'bg-[#1E4D4D] hover:bg-[#153737] hover:shadow-md'}
            `}
            aria-label="حفظ جميع التغييرات في الإعدادات"
          >
            <Save size={15} className={isSaving ? 'animate-bounce' : ''} />
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Row 2: Full-width Search Bar */}
      <div className="mt-2.5 md:hidden w-full">
        <div className="relative w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
          <input
            type="text"
            placeholder="ابحث في أقسام وإعدادات النظام..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#1E4D4D]/20 focus:border-[#1E4D4D] dark:text-white transition-all font-cairo placeholder:text-slate-400"
            aria-label="البحث في إعدادات النظام"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              aria-label="مسح البحث"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
