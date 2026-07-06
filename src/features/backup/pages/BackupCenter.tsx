
import { SettingsCard } from '../../settings/components/shared/SettingsUI';
import { Database, Cloud, ShieldCheck } from 'lucide-react';

export const BackupCenter = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">مركز النسخ الاحتياطي والاستعادة</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsCard title="حالة النسخ الاحتياطي" icon={Database}>
          <p>آخر نسخة: 2026-07-03</p>
          <p>الحالة: تم التشفير بنجاح</p>
        </SettingsCard>
        
        <SettingsCard title="النسخ السحابي" icon={Cloud}>
          <p>الحالة: غير متصل</p>
          <button className="bg-indigo-600 text-white p-2 rounded">اتصال بـ Firebase</button>
        </SettingsCard>
      </div>

      <div className="mt-6">
        <SettingsCard title="إجراءات" icon={ShieldCheck}>
          <button className="bg-green-600 text-white p-2 rounded mr-2">إنشاء نسخة محلية</button>
          <button className="bg-slate-600 text-white p-2 rounded">التحقق من السلامة</button>
        </SettingsCard>
      </div>
    </div>
  );
};
