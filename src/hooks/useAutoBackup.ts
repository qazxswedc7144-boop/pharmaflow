import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { triggerBackup } from '@/utils/backup';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useSalesStore } from '@/store/useSalesStore';

export const useAutoBackup = () => {
    const { autoBackupEnabled, backupPassword } = useSettingsStore();
    const inventory = useInventoryStore();
    const sales = useSalesStore();

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (autoBackupEnabled && backupPassword) {
                const data = {
                    products: inventory.products,
                    sales: sales.sales,
                    timestamp: new Date().toISOString()
                };
                triggerBackup(data, backupPassword);
                // Note: Showing a confirm dialog might be blocked by modern browsers
                event.preventDefault();
                event.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [autoBackupEnabled, backupPassword, inventory, sales]);
};
