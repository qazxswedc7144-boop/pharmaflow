import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsGroup, SettingsSectionItem } from '../../types/settingsNavigation.types';

interface SettingsGroupCardProps {
  group: SettingsGroup;
  items: SettingsSectionItem[];
  onSelectSection: (sectionId: string) => void;
  activeSectionId?: string;
  isCompact?: boolean;
}

export const SettingsGroupCard: React.FC<SettingsGroupCardProps> = ({
  group,
  items,
  onSelectSection,
  activeSectionId,
  isCompact = false
}) => {
  if (items.length === 0) return null;

  const GroupIcon = group.icon;

  return (
    <section className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xs p-4 sm:p-5 transition-all w-full">
      {/* Group Header */}
      <div className="flex items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-100 dark:border-slate-750">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${group.colorClass}`}>
            <GroupIcon size={16} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 font-cairo leading-none">
              {group.title}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo mt-1">
              {group.description}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-cairo shrink-0">
          {items.length} {items.length === 1 ? 'قسم' : 'أقسام'}
        </span>
      </div>

      {/* Group Cards Grid */}
      <div className={`grid gap-2.5 ${isCompact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {items.map((item) => {
          const ItemIcon = item.icon;
          const isActive = activeSectionId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`w-full text-right p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between gap-3 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E4D4D]/30
                ${
                  isActive
                    ? 'bg-[#1E4D4D]/5 dark:bg-emerald-950/20 border-[#1E4D4D] dark:border-emerald-500 shadow-xs'
                    : 'bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100/90 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }
              `}
              aria-label={`الدخول إلى قسم ${item.title}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105
                    ${
                      isActive
                        ? 'bg-[#1E4D4D] text-white'
                        : 'bg-white dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-600 group-hover:text-[#1E4D4D] dark:group-hover:text-emerald-400'
                    }
                  `}
                >
                  <ItemIcon size={19} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-850 dark:text-slate-100 font-cairo leading-tight truncate group-hover:text-[#1E4D4D] dark:group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-cairo mt-0.5 line-clamp-1 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Navigation Chevron Indicator in RTL (pointing left) */}
              <div className="shrink-0 w-7 h-7 rounded-lg bg-white/80 dark:bg-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-[#1E4D4D] dark:group-hover:text-emerald-400 group-hover:-translate-x-0.5 transition-all">
                <ChevronLeft size={16} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
