import { useSettingsStore } from '@/store/useSettingsStore';
import { Shield } from 'lucide-react';
import { SettingsCard, SettingToggle, SettingInput } from '../shared/SettingsUI';

export default function BackupTab() {
  const { autoBackupEnabled, backupPassword, setAutoBackupEnabled, setBackupPassword } = useSettingsStore();

  return (
    <div className="space-y-6">
      <SettingsCard 
        title="إعدادات النسخ الاحتياطي التلقائي" 
        description="حماية واستعادة بيانات الصيدلية تلقائياً وعند الإغلاق" 
        icon={Shield}
      >
        <div className="space-y-4">
          <SettingToggle
            label="تفعيل النسخ الاحتياطي التلقائي عند الإغلاق"
            description="حفظ نسخة احتياطية آمنة في التخزين المحلي والإنترنت عند إغلاق التطبيق"
            checked={autoBackupEnabled}
            onChange={(v) => setAutoBackupEnabled(v)}
            icon={Shield}
          />

          <SettingInput
            label="كلمة مرور التشفير للنسخة الاحتياطية"
            description="كلمة مرور سرية حصرية لتشفير النسخ الاحتياطية لمنع الوصول غير المصرح به"
            type="password"
            value={backupPassword}
            onChange={(val) => setBackupPassword(val)}
            placeholder="أدخل كلمة مرور قوية"
          />
        </div>
      </SettingsCard>
    </div>
  );
}
