import { useState, Suspense, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, Building2, Users, ShoppingCart, Truck, 
  Package, RefreshCw, ShieldCheck, Code,
  Search, Save, CreditCard,
  Globe, Clock, Cpu
} from 'lucide-react';
import { BackButton } from '@/components/shared/BackButton';
import { LoadingSkeleton } from '../components/shared/SettingsUI';

// Lazy load tabs for performance
import { lazy } from 'react';
const GeneralTab = lazy(() => import('../components/tabs/GeneralTab'));
const PharmacyTab = lazy(() => import('../components/tabs/PharmacyTab'));
const UsersTab = lazy(() => import('../components/tabs/UsersTab'));
const SalesTab = lazy(() => import('../components/tabs/SalesTab'));
const PurchasesTab = lazy(() => import('../components/tabs/PurchasesTab'));
const InventoryTab = lazy(() => import('../components/tabs/InventoryTab'));
const SecurityTab = lazy(() => import('../components/tabs/SecurityTab'));
const SubscriptionTab = lazy(() => import('../components/tabs/SubscriptionTab'));
const DeveloperTab = lazy(() => import('../components/tabs/DeveloperTab'));
const BackupTab = lazy(() => import('../components/tabs/BackupTab'));

const SYSTEM_SETTINGS_GROUP = [
  { id: 'general', label: 'إعدادات النظام العامة', icon: Settings, component: GeneralTab },
  { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users, component: UsersTab },
  { id: 'pharmacy', label: 'الفروع والإعدادات الخاصة بها', icon: Building2, component: PharmacyTab },
  { id: 'currency', label: 'العملة والمنطقة الزمنية', icon: Globe, component: GeneralTab },
  { id: 'datetime', label: 'التاريخ والوقت', icon: Clock, component: GeneralTab },
  { id: 'performance', label: 'إعدادات الأداء والأجهزة', icon: Cpu, component: DeveloperTab },
];

const OPERATIONAL_SETTINGS_GROUP = [
  { id: 'backup', label: 'إعدادات النسخ الاحتياطي والمزامنة', icon: RefreshCw, component: BackupTab },
  { id: 'sales', label: 'إعدادات المبيعات', icon: ShoppingCart, component: SalesTab },
  { id: 'purchases', label: 'إعدادات المشتريات', icon: Truck, component: PurchasesTab },
  { id: 'inventory', label: 'إعدادات المخزون', icon: Package, component: InventoryTab },
  { id: 'subscription', label: 'الاشتراك والدعم', icon: CreditCard, component: SubscriptionTab },
  { id: 'security', label: 'سجل الأمان والتدقيق', icon: ShieldCheck, component: SecurityTab },
  { id: 'developer', label: 'أدوات المطور', icon: Code, component: DeveloperTab }
];

const TABS = [...SYSTEM_SETTINGS_GROUP, ...OPERATIONAL_SETTINGS_GROUP];

interface SettingsModuleProps {
  onNavigate?: (view: string, params?: any) => void;
  initialTab?: string;
}

export default function SettingsModule({ onNavigate, initialTab }: SettingsModuleProps) {
  const [activeTab, setActiveTab] = useState(initialTab || 'general');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const filteredTabs = useMemo(() => {
    if (!searchQuery) return TABS;
    return TABS.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const ActiveComponent = useMemo(() => {
    const tab = TABS.find(t => t.id === activeTab);
    return tab ? tab.component : GeneralTab;
  }, [activeTab]);

  const activeTabMeta = useMemo(() => {
    return TABS.find(t => t.id === activeTab) || TABS[0] || { id: 'general', label: 'إعدادات النظام العامة', icon: Settings, component: GeneralTab };
  }, [activeTab]);

  const handleManualSave = async () => {
    setIsSaving(true);
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
            className="fixed top-4 left-1/2 z-50 px-6 py-3 bg-[#1E4D4D] text-white rounded-xl shadow-2xl font-cairo text-sm font-bold flex items-center gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Container */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 box-border w-full">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div className="flex items-center gap-3">
            {onNavigate && (
              <BackButton onClick={() => onNavigate('dashboard')} />
            )}
            <div className="w-10 h-10 bg-[#1E4D4D]/10 rounded-xl flex items-center justify-center text-[#1E4D4D] dark:text-emerald-400 shrink-0">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 font-cairo leading-tight">مركز إعدادات النظام</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-cairo hidden sm:block">الإعدادات الإدارية والتنفيذية الحاكمة لتطبيق PharmaFlow</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="ابحث في الإعدادات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-[#1E4D4D]/20 focus:border-[#1E4D4D] dark:text-white transition-all font-cairo"
            />
          </div>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl text-white font-bold font-cairo text-xs flex items-center gap-1.5 transition-all shadow-xs shrink-0
              ${isSaving ? 'bg-emerald-700 cursor-not-allowed' : 'bg-[#1E4D4D] hover:bg-[#153737] hover:shadow-md'}
            `}
          >
            <Save size={16} className={isSaving ? 'animate-pulse' : ''} />
            <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Tabs */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 overflow-x-auto flex items-center gap-1.5 custom-scrollbar box-border w-full">
        {filteredTabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold font-cairo whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                isActive 
                  ? 'bg-[#1E4D4D] text-white shadow-xs' 
                  : 'bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <TabIcon size={15} className={isActive ? 'text-emerald-300' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
        {filteredTabs.length === 0 && (
          <div className="text-center p-2 text-slate-500 text-xs font-cairo w-full">
            لا توجد إعدادات مطابقة لـ "{searchQuery}"
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="w-full box-border">
        {/* Active Tab Banner Header */}
        {(() => {
          const ActiveIcon = activeTabMeta.icon;
          return (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-3 mb-4 box-border w-full">
              <div className="w-9 h-9 rounded-xl bg-[#1E4D4D]/10 text-[#1E4D4D] dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ActiveIcon size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 font-cairo">
                  {activeTabMeta.label}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo">
                  خيارات وتكوينات قسم {activeTabMeta.label}
                </p>
              </div>
            </div>
          );
        })()}

        <Suspense fallback={<LoadingSkeleton />}>
          <ActiveComponent activeTab={activeTab} />
        </Suspense>
      </div>
    </div>
  );
}
