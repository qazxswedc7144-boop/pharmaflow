import { useState, Suspense, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, Search, SlidersHorizontal } from 'lucide-react';
import { LoadingSkeleton } from '../components/shared/SettingsUI';
import { SETTINGS_GROUPS, SETTINGS_SECTIONS } from '../data/settingsSectionsMetadata';
import { SettingsSectionItem } from '../types/settingsNavigation.types';
import { SettingsHeader } from '../components/navigation/SettingsHeader';
import { SettingsGroupCard } from '../components/navigation/SettingsGroupCard';
import { SettingsSidebar } from '../components/navigation/SettingsSidebar';

interface SettingsModuleProps {
  onNavigate?: (view: string, params?: any) => void;
  initialTab?: string;
}

export default function SettingsModule({ onNavigate, initialTab }: SettingsModuleProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'general');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>(initialTab ? 'detail' : 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
      setMobileView('detail');
    }
  }, [initialTab]);

  // Filter sections based on search query matching title, description, or keywords
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SETTINGS_SECTIONS;

    return SETTINGS_SECTIONS.filter((section) => {
      const matchTitle = section.title.toLowerCase().includes(q);
      const matchDesc = section.description.toLowerCase().includes(q);
      const matchKeywords = section.keywords.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchKeywords;
    });
  }, [searchQuery]);

  const activeSectionMeta: SettingsSectionItem = useMemo(() => {
    const found = SETTINGS_SECTIONS.find((s) => s.id === activeTab);
    if (found) return found;
    const defaultSection = SETTINGS_SECTIONS[0];
    if (defaultSection) return defaultSection;
    throw new Error('No settings sections configured');
  }, [activeTab]);

  const ActiveComponent = activeSectionMeta.component;

  const handleSelectSection = (sectionId: string) => {
    setActiveTab(sectionId);
    setMobileView('detail');
  };

  const handleBackToCardList = () => {
    setMobileView('list');
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    // Dispatch system-wide sync wakeup
    window.dispatchEvent(new CustomEvent('SYNC_WAKEUP'));

    setTimeout(() => {
      setIsSaving(false);
      setToastMessage('تم حفظ الإعدادات بنجاح وإرسالها للمزامنة');
      setTimeout(() => setToastMessage(''), 3000);
    }, 800);
  };

  return (
    <div className="w-full max-w-full mx-auto box-border font-cairo space-y-4 relative" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-50 px-6 py-3 bg-[#1E4D4D] text-white rounded-xl shadow-2xl font-cairo text-sm font-bold flex items-center gap-2 border border-emerald-400/30"
          >
            <CheckCircle2 size={18} className="text-emerald-400 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header Container */}
      <SettingsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSave={handleManualSave}
        isSaving={isSaving}
        onBackToDashboard={onNavigate ? () => onNavigate('dashboard') : undefined}
        onBackToCardList={handleBackToCardList}
        isMobileDrillDown={mobileView === 'detail'}
        activeSectionTitle={activeSectionMeta.title}
      />

      {/* =======================================================================
          MOBILE VIEW (< lg breakpoint): 
          - Either shows the grouped cards list OR drills down into the selected tab
         ======================================================================= */}
      <div className="block lg:hidden">
        {mobileView === 'list' ? (
          <div className="space-y-4">
            {/* Search active indicator on mobile */}
            {searchQuery && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-bold">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-[#1E4D4D] dark:text-emerald-400" />
                  <span>نتائج البحث عن: "{searchQuery}"</span>
                </div>
                <span className="bg-[#1E4D4D]/10 text-[#1E4D4D] dark:text-emerald-300 px-2 py-0.5 rounded-full text-[11px]">
                  {filteredSections.length} نتيجة
                </span>
              </div>
            )}

            {/* Vertical Grouped Cards List */}
            {SETTINGS_GROUPS.map((group) => {
              const itemsInGroup = filteredSections.filter((s) => s.groupId === group.id);
              if (itemsInGroup.length === 0) return null;

              return (
                <SettingsGroupCard
                  key={group.id}
                  group={group}
                  items={itemsInGroup}
                  onSelectSection={handleSelectSection}
                  activeSectionId={activeTab}
                  isCompact={true}
                />
              );
            })}

            {filteredSections.length === 0 && (
              <div className="bg-white dark:bg-slate-850 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <SlidersHorizontal size={22} />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  لم يتم العثور على أي إعدادات مطابقة
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  يرجى التأكد من كتابة الكلمة بشكل صحيح مثل "عملة"، "نسخ"، "مستخدم"، "طباعة"
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Mobile Drill-Down Section Content View */
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Section Breadcrumb & Return Bar */}
            <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
              <button
                onClick={handleBackToCardList}
                className="flex items-center gap-2 text-xs font-bold text-[#1E4D4D] dark:text-emerald-400 hover:text-[#153737] transition-colors cursor-pointer"
                aria-label="العودة لقائمة أقسام الإعدادات"
              >
                <ArrowRight size={16} />
                <span>العودة لقائمة الإعدادات الرئيسية</span>
              </button>

              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {activeSectionMeta.title}
              </span>
            </div>

            {/* Active Tab Header Card */}
            {(() => {
              const ActiveIcon = activeSectionMeta.icon;
              return (
                <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E4D4D]/10 dark:bg-emerald-950/40 text-[#1E4D4D] dark:text-emerald-400 flex items-center justify-center shrink-0 border border-[#1E4D4D]/20">
                    <ActiveIcon size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-850 dark:text-slate-100 font-cairo">
                      {activeSectionMeta.title}
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo">
                      {activeSectionMeta.description}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Lazy Section Content */}
            <div className="w-full box-border">
              <Suspense fallback={<LoadingSkeleton />}>
                <ActiveComponent activeTab={activeTab} />
              </Suspense>
            </div>
          </motion.div>
        )}
      </div>

      {/* =======================================================================
          DESKTOP VIEW (lg: breakpoint and above):
          - Sidebar on right (in RTL) + Content on left
         ======================================================================= */}
      <div className="hidden lg:flex items-start gap-4 xl:gap-5 w-full">
        {/* Right Column: Vertical Grouped Sidebar Navigation */}
        <SettingsSidebar
          groups={SETTINGS_GROUPS}
          sections={filteredSections}
          activeSectionId={activeTab}
          onSelectSection={handleSelectSection}
          searchQuery={searchQuery}
        />

        {/* Left Column: Active Section Details Content */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Active Section Banner Header */}
          {(() => {
            const ActiveIcon = activeSectionMeta.icon;
            const parentGroup = SETTINGS_GROUPS.find((g) => g.id === activeSectionMeta.groupId);

            return (
              <div className="bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#1E4D4D]/10 dark:bg-emerald-950/40 text-[#1E4D4D] dark:text-emerald-400 flex items-center justify-center shrink-0 border border-[#1E4D4D]/20">
                    <ActiveIcon size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black text-slate-850 dark:text-slate-100 font-cairo truncate">
                        {activeSectionMeta.title}
                      </h2>
                      {parentGroup && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${parentGroup.colorClass}`}>
                          {parentGroup.title}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-cairo mt-0.5 truncate">
                      {activeSectionMeta.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Lazy Component Container */}
          <div className="w-full box-border">
            <Suspense fallback={<LoadingSkeleton />}>
              <ActiveComponent activeTab={activeTab} />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
