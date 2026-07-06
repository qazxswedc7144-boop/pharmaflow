import { create } from 'zustand';
import { db } from '@/core/db';

interface SettingsState {
  currency: string;
  isSettingsOpen: boolean;
  setCurrency: (currency: string, label?: string) => Promise<void>;
  setSettingsOpen: (isOpen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currency: 'AED',
  isSettingsOpen: false,
  setCurrency: async (currency, label) => {
    await db.db.settings.put({ key: 'currency', value: currency });
    if (label) {
        await db.db.settings.put({ key: 'currencyLabel', value: label });
    }
    set({ currency });
  },
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
}));
