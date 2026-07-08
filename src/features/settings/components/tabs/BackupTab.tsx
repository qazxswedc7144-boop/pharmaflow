import { useSettingsStore } from '@/store/useSettingsStore';
import { Shield, Lock } from 'lucide-react';

export default function BackupTab() {
  const { autoBackupEnabled, backupPassword, setAutoBackupEnabled, setBackupPassword } = useSettingsStore();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-slate-800">إعدادات النسخ الاحتياطي التلقائي</h2>
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 font-bold text-slate-700">
            <Shield className="text-indigo-600" size={20} />
            تفعيل النسخ الاحتياطي التلقائي عند الإغلاق
          </label>
          <input 
            type="checkbox" 
            checked={autoBackupEnabled} 
            onChange={(e) => setAutoBackupEnabled(e.target.checked)}
            className="w-5 h-5 accent-indigo-600"
          />
        </div>
        
        <div className="space-y-2">
            <label className="flex items-center gap-3 font-bold text-slate-700">
                <Lock className="text-indigo-600" size={20} />
                كلمة مرور التشفير
            </label>
            <input 
                type="password" 
                value={backupPassword} 
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="أدخل كلمة مرور قوية"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
        </div>
      </div>
    </div>
  );
}
