import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '@/core/db';
import defaultLogoImg from '@/assets/brand/logo.png'; 
import { HeartPulse, Menu } from 'lucide-react';
import NotificationCenter from '@/components/shared/NotificationCenter';
import { SidebarMenu } from './SidebarMenu';

const DynamicLogo = () => {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [companyName, setCompanyName] = useState("PharmaFlow");

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const config = await db.getSetting('invoice_config', null);
        if (config?.CompanyLogo) {
          setLogoSrc(config.CompanyLogo);
        } else {
          setLogoSrc(defaultLogoImg);
        }
        if (config?.CompanyName) {
          setCompanyName(config.CompanyName);
        }
      } catch (err) {
        setLogoSrc(defaultLogoImg);
      }
    };
    loadLogo();
  }, []);

  if (hasError || !logoSrc) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-800">
        <HeartPulse className="text-emerald-600 dark:text-emerald-400" size={24} />
        <div className="flex flex-col leading-tight">
          <span className="font-black text-emerald-800 dark:text-emerald-300 text-base tracking-tight">
            {companyName}
          </span>
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            إدارة الصيدليات الذكية
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <img 
        src={logoSrc} 
        alt={`${companyName} Logo`} 
        loading="lazy"
        className="h-9 md:h-11 w-auto object-contain transition-opacity duration-500"
        onError={() => {
          console.warn('[Header DynamicLogo] Failed to load logo image:', logoSrc);
          if (logoSrc === defaultLogoImg) {
            setHasError(true);
          } else {
            setLogoSrc(defaultLogoImg);
          }
        }}
      />
      <div className="hidden sm:flex flex-col items-start leading-tight">
        <span className="font-black text-slate-800 dark:text-slate-100 text-sm tracking-tight">
          {companyName}
        </span>
        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          إدارة الصيدليات الذكية
        </span>
      </div>
    </div>
  );
};

interface HeaderProps {
  pageTitle?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  onMenuClick?: () => void;
  onNavigate?: (view: string, params?: any) => void;
  currentView?: string;
  isHome?: boolean;
}

const Header = ({ pageTitle, showBackButton, onBackClick, onMenuClick, onNavigate, currentView, isHome }: HeaderProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Safely check location using react-router-dom useLocation if available in router context
  let routerLocation: { pathname: string; hash: string } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    routerLocation = useLocation();
  } catch (e) {
    // Graceful fallback if not inside Router context
  }

  const [windowLocation, setWindowLocation] = useState(() => ({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    hash: typeof window !== 'undefined' ? window.location.hash : ''
  }));

  useEffect(() => {
    const handleLocationChange = () => {
      setWindowLocation({
        pathname: window.location.pathname,
        hash: window.location.hash
      });
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const activePathname = routerLocation?.pathname || windowLocation.pathname;
  const activeHash = routerLocation?.hash || windowLocation.hash;

  // Show logo and brand identity exclusively on the home/dashboard page
  const isHomePage = Boolean(
    isHome || 
    currentView === 'dashboard' || 
    currentView === 'home' || 
    (!currentView && (
      activePathname === '/' || 
      activePathname === '/home' || 
      activePathname === '/dashboard'
    ) && (
      !activeHash || 
      activeHash === '#' || 
      activeHash === '#/' || 
      activeHash === '#/dashboard' || 
      activeHash === '#/home'
    ))
  );

  if (!isHomePage) {
    return null;
  }

  return (
    <header className="w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 pt-3.5 pb-3 flex items-center justify-between sticky top-0 z-50 shadow-sm min-h-[64px]" dir="rtl">
      
      <SidebarMenu isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onNavigate={onNavigate} />

      {/* الجهة اليمنى (بداية الصف في RTL): أيقونة الإعدادات وزر العودة متبوعاً بالعنوان */}
      <div className="flex items-center gap-2 md:gap-3 z-10">
        <button 
          onClick={() => {
            if (onMenuClick) {
              onMenuClick();
            } else {
              setIsSidebarOpen(true);
            }
          }}
          className="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all active:scale-95 cursor-pointer"
          title="القائمة"
        >
          <Menu size={20} />
        </button>

        {showBackButton && (
          <button 
            onClick={onBackClick}
            className="text-2xl text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-300 transform hover:scale-110 p-2 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center cursor-pointer"
            title="العودة"
          >
            <span className="leading-none">➟</span>
          </button>
        )}
        
        {/* عنوان الصفحة الحالي */}
        <h1 className="text-base font-bold text-gray-800 dark:text-gray-100 hidden md:block">
          {pageTitle || "PharmaFlow"}
        </h1>
      </div>

      {/* المنتصف تماماً: الشعار وحاوية الاسم (يظهر حصرياً في الصفحة الرئيسية) */}
      {isHomePage && (
        <div className="flex flex-col items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <DynamicLogo />
        </div>
      )}

      {/* الجهة اليسرى (نهاية الصف في RTL): التنبيهات فقط */}
      <div className="flex items-center gap-2 md:gap-3 z-10">
        <NotificationCenter />
      </div>
    </header>
  );
};

export default Header;
