import { create } from 'zustand';
import { db } from '@/core/db';

interface SettingsState {
  currency: string;
  isSettingsOpen: boolean;
  autoBackupEnabled: boolean;
  backupPassword: string;
  setCurrency: (currency: string, label?: string) => Promise<void>;
  setSettingsOpen: (isOpen: boolean) => void;
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>;
  setBackupPassword: (password: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currency: 'AED',
  isSettingsOpen: false,
  autoBackupEnabled: false,
  backupPassword: '',
  setCurrency: async (currency, label) => {
    await db.db.settings.put({ key: 'currency', value: currency });
    if (label) {
        await db.db.settings.put({ key: 'currencyLabel', value: label });
    }
    set({ currency });
  },
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setAutoBackupEnabled: async (enabled) => {
    await db.db.settings.put({ key: 'autoBackupEnabled', value: enabled });
    set({ autoBackupEnabled: enabled });
  },
  setBackupPassword: async (password) => {
    await db.db.settings.put({ key: 'backupPassword', value: password });
    set({ backupPassword: password });
  },
}));
