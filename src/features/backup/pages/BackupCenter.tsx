
import { useState } from 'react';
import { SettingsCard } from '../../settings/components/shared/SettingsUI';
import { Database, Cloud, ShieldCheck, Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { backupService } from '../services/BackupService';
import { useSettingsStore } from '@/store/useSettingsStore';
import { db } from '@/core/db';

export const BackupCenter = () => {
  const { backupPassword } = useSettingsStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleValidateBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!backupPassword || !backupPassword.trim()) {
      setErrorMessage("يرجى إدخال كلمة مرور النسخة الاحتياطية أولاً");
      e.target.value = '';
      return;
    }

    setIsValidating(true);
    try {
      const result = await backupService.validateBackup(file, backupPassword);
      if (result.valid) {
        setSuccessMessage(`فحص السلامة ناجح: النسخة صالحة ومتوافقة (${result.tables?.length || 0} جداول، إجمالي ${result.totalRecords || 0} سجل).`);
      } else {
        setErrorMessage(result.error || "فشل التحقق من صحة وسلامة النسخة الاحتياطية.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "فشل التحقق من صحة النسخة الاحتياطية");
    } finally {
      setIsValidating(false);
      e.target.value = '';
    }
  };

  const handleCreateLocalBackup = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!backupPassword || !backupPassword.trim()) {
      setErrorMessage("يرجى إدخال كلمة مرور النسخة الاحتياطية أولاً");
      return;
    }

    setIsCreating(true);
    try {
      const products = await db.products.toArray().catch(() => []);
      const invoices = await db.invoices.toArray().catch(() => []);
      const customers = await db.customers.toArray().catch(() => []);
      const suppliers = await db.suppliers.toArray().catch(() => []);
      const accounts = await db.accounts.toArray().catch(() => []);

      const data = {
        products,
        invoices,
        customers,
        suppliers,
        accounts,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      const result = await backupService.createLocalBackup(data, backupPassword, 'full');
      
      // Trigger download of the encrypted backup package
      if (result.blob) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.metadata.name;
        a.click();
        URL.revokeObjectURL(url);
      }

      setSuccessMessage(`تم إنشاء النسخة الاحتياطية بنجاح: ${result.metadata.name}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "فشل إنشاء النسخة الاحتياطية");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreLocalBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!backupPassword || !backupPassword.trim()) {
      setErrorMessage("يرجى إدخال كلمة مرور النسخة الاحتياطية أولاً");
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const result = await backupService.restoreBackup(file, backupPassword);
      setSuccessMessage(`تمت استعادة البيانات بنجاح (${result.restoredTables.length} جداول مستعادة).`);
    } catch (err: any) {
      setErrorMessage(err?.message || "فشلت استعادة النسخة الاحتياطية");
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-6 font-cairo" dir="rtl">
      <h1 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">مركز النسخ الاحتياطي والاستعادة</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsCard title="حالة النسخ الاحتياطي" icon={Database}>
          <p className="text-slate-600 dark:text-slate-300">الحالة: جاهز للنسخ والتشفير</p>
        </SettingsCard>
        
        <SettingsCard title="النسخ السحابي" icon={Cloud}>
          <p className="text-slate-600 dark:text-slate-300">الحالة: سحابة التخزين الموزعة</p>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm mt-3 cursor-pointer">اتصال بـ Firebase</button>
        </SettingsCard>
      </div>

      {errorMessage && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-xl text-sm border border-rose-200 dark:border-rose-800 font-cairo">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-sm border border-emerald-200 dark:border-emerald-800 font-cairo">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="mt-6">
        <SettingsCard title="إجراءات" icon={ShieldCheck}>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={handleCreateLocalBackup}
              disabled={isCreating || isRestoring}
              className="flex items-center gap-2 bg-[#1E4D4D] hover:bg-[#1E4D4D]/90 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span>{isCreating ? "جاري الإنشاء..." : "إنشاء نسخة محلية"}</span>
            </button>

            <label className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all ${isRestoring ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="file"
                accept=".pfb,.zip"
                className="hidden"
                disabled={isRestoring || isCreating}
                onChange={handleRestoreLocalBackup}
              />
              {isRestoring ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>{isRestoring ? "جاري الاستعادة..." : "استعادة من ملف (.pfb)"}</span>
            </label>

            <label className={`flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all ${isValidating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="file"
                accept=".pfb,.zip"
                className="hidden"
                disabled={isValidating || isRestoring || isCreating}
                onChange={handleValidateBackup}
              />
              {isValidating ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>{isValidating ? "جاري التحقق..." : "التحقق من السلامة"}</span>
            </label>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
};

