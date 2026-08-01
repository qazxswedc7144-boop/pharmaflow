
import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { eventBus } from '@/services/eventBus';
import { db } from '@/core/db';

import { CurrencyService } from '@/services/localization/CurrencyService';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useAppStore();
  const refreshData = store.refreshData;
  useEffect(() => { 
    const init = async () => {
      try {
        await db.init();
        await useSettingsStore.getState().loadSettings();
        await refreshData();
      } catch (e) {
        console.error("[AppContext] Initialization failed:", e);
      }
    };
    init();
  }, [refreshData]);
  return <>{children}</>;
};

export const useUI = () => {
  const store = useAppStore();
  const currency = store.currency || 'YER';
  return {
    currency,
    currencySymbol: CurrencyService.getCurrencySymbol(currency),
    formatCurrency: (amount: number | string | null | undefined, customCode?: string) =>
      CurrencyService.formatAmount(amount, customCode || currency),
    setCurrency: store.setCurrency,
    version: store.version,
    toasts: store.toasts,
    addToast: store.addToast,
    removeToast: store.removeToast,
    headerAction: store.headerAction,
    setHeaderAction: store.setHeaderAction,
    refreshGlobal: store.refreshData,
    isSyncing: store.isSyncing,
    setSyncing: store.setSyncing,
    isSettingsOpen: store.isSettingsOpen,
    setSettingsOpen: store.setSettingsOpen
  };
};

export const useInventory = () => {
  const store = useAppStore();
  return { 
    products: store.products, 
    categories: store.categories,
    updateStock: store.updateStockDirectly,
    addCategory: store.addCategory,
    refreshInventory: store.refreshData 
  };
};

export const useAccounting = () => {
  const store = useAppStore();
  return { 
    products: store.products,
    sales: store.sales,
    purchases: store.purchases,
    journalEntries: store.journalEntries,
    suppliers: store.suppliers,
    customers: store.customers,
    accounts: store.accounts,
    addInvoice: store.addInvoice,
    addCustomer: (c: Customer) => store.addPartner(c, 'C'),
    addSupplier: (s: Supplier) => store.addPartner(s, 'S'),
    refreshAccounting: store.refreshData 
  };
};

export const useInvoice = () => {
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  return { generatedHtml, setGeneratedHtml, isGenerating, setIsGenerating };
};

// Fix: Exported useEventBus hook to allow components to easily subscribe to internal events
export const useEventBus = (event: string, callback: (data: unknown) => void) => {
  useEffect(() => {
    return eventBus.subscribe(event, callback);
  }, [event, callback]);
};
