
import { create } from 'zustand';
import { CashFlow, AccountingEntry, Account } from '@/types';
import { AccountingRepository } from '@/database/repositories/AccountingRepository';
import { InvoiceRepository } from '@/database/repositories/invoice.repository';

interface AccountingState {
  cashFlow: CashFlow[];
  journalEntries: AccountingEntry[];
  accounts: Account[];
  loadAccounting: () => Promise<void>;
  addInvoice: (invoice: any, type?: 'SALE' | 'PURCHASE') => Promise<any>;
  addPartner: (partner: any, type: 'C' | 'S') => Promise<any>;
}

export const useAccountingStore = create<AccountingState>((set) => ({
  cashFlow: [],
  journalEntries: [],
  accounts: [],
  loadAccounting: async () => {
    const [journalEntries, cashFlow, accounts] = await Promise.all([
      AccountingRepository.getEntries(),
      AccountingRepository.getCashFlow(),
      AccountingRepository.getAccounts()
    ]);
    set({ journalEntries, cashFlow, accounts });
  },
  addInvoice: async (invoice, type) => {
    return (type || invoice.type) === 'SALE' ? await InvoiceRepository.saveSale(invoice.payload || invoice) : await InvoiceRepository.savePurchase(invoice.payload || invoice);
  },
  addPartner: async (partner, _type) => {
    // Basic placeholder implementation
    return partner;
  }
}));
