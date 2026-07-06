import { useAuthStore } from '../store/authStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { usePurchaseStore } from '../store/usePurchaseStore';
import { useSalesStore } from '../store/useSalesStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useUIStore } from '../store/useUIStore';
import { useAccountingStore } from '../store/accountingStore';

export const useAppStore = () => {
  const auth = useAuthStore();
  const inventory = useInventoryStore();
  const purchase = usePurchaseStore();
  const sales = useSalesStore();
  const customer = useCustomerStore();
  const supplier = useSupplierStore();
  const settings = useSettingsStore();
  const ui = useUIStore();
  const accounting = useAccountingStore();

  const refreshData = async () => {
    await Promise.all([
      inventory.loadInventory(),
      purchase.loadPurchases(),
      sales.loadSales(),
      accounting.loadAccounting(),
      customer.loadCustomers(),
      supplier.loadSuppliers(),
    ]);
  };

  return {
    ...auth,
    ...inventory,
    ...purchase,
    ...sales,
    ...customer,
    ...supplier,
    ...settings,
    ...ui,
    version: ui.version,
    ...accounting,
    refreshData
  };
};
