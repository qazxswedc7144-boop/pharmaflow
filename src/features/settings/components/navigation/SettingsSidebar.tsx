import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsGroup, SettingsSectionItem } from '../../types/settingsNavigation.types';

interface SettingsSidebarProps {
  groups: SettingsGroup[];
  sections: SettingsSectionItem[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
  searchQuery?: string;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  groups,
  sections,
  activeSectionId,
  onSelectSection,
  searchQuery
}) => {
  return (
    <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-xs space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
      {groups.map((group) => {
        const groupItems = sections.filter((s) => s.groupId === group.id);
        if (groupItems.length === 0) return null;

        const GroupIcon = group.icon;

        return (
          <div key={group.id} className="space-y-1.5">
            {/* Group Header Title */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-black text-slate-700 dark:text-slate-300 font-cairo uppercase tracking-wider">
              <GroupIcon size={14} className="text-[#1E4D4D] dark:text-emerald-400" />
              <span>{group.title}</span>
            </div>

            {/* Group Items Vertical List */}
            <div className="space-y-1">
              {groupItems.map((item) => {
                const ItemIcon = item.icon;
                const isActive = activeSectionId === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectSection(item.id)}
                    className={`w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold font-cairo transition-all flex items-center justify-between gap-2.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E4D4D]/20
                      ${
                        isActive
                          ? 'bg-[#1E4D4D] text-white shadow-xs'
                          : 'text-slate-650 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }
                    `}
                    aria-label={`الانتقال إلى إعدادات ${item.title}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                          ${
                            isActive
                              ? 'bg-white/20 text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }
                        `}
                      >
                        <ItemIcon size={14} />
                      </div>
                      <span className="truncate leading-tight">{item.title}</span>
                    </div>

                    <ChevronLeft
                      size={14}
                      className={`shrink-0 transition-transform ${
                        isActive ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {sections.length === 0 && (
        <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 font-cairo">
          لا توجد أقسام مطابقة لـ "{searchQuery}"
        </div>
      )}
    </aside>
  );
};
