import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Calendar, 
  ShoppingCart, 
  History, 
  Settings, 
  Play,
  Layers
} from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  hallName: string;
  flaggedOrderCount: number;
  onStartCount: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  hallName,
  flaggedOrderCount,
  onStartCount,
  isOpen,
  onClose
}) => {
  const mainNavItems = [
    { id: 'overview' as ActiveTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'inventory' as ActiveTab, label: 'Inventory', icon: Package },
    { id: 'events' as ActiveTab, label: 'Events', icon: Calendar },
    { 
      id: 'order' as ActiveTab, 
      label: 'Order list', 
      icon: ShoppingCart, 
      badge: flaggedOrderCount > 0 ? String(flaggedOrderCount) : undefined 
    },
    { id: 'history' as ActiveTab, label: 'History', icon: History },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Navigation Rail */}
      <aside className={`
        fixed top-0 bottom-0 left-0 w-64 bg-[#f6f7f9] border-r border-[#dcdee3] flex flex-col z-50 transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Hall Header */}
        <div className="p-5 border-b border-[#dcdee3]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#1f5f8b] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[14px] font-bold tracking-tight text-[#191c20]">Literature inventory</div>
              <div className="text-[12px] text-[#6c6f77] mt-0.5">{hallName || 'Riverside hall'}</div>
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="py-2 flex flex-col flex-1 overflow-y-auto">
          <div className="space-y-0.5">
            {mainNavItems.map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onClose();
                  }}
                  className={`
                    w-full flex items-center justify-between px-5 py-2.5 text-[13px] transition-colors text-left
                    ${active 
                      ? 'bg-white font-bold text-[#1f5f8b] border-l-[3px] border-[#1f5f8b]' 
                      : 'font-normal text-[#44474e] hover:bg-[#eef0f3] hover:text-[#191c20] border-l-[3px] border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-[#1f5f8b]' : 'text-[#6c6f77]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="font-mono text-[11px] font-bold text-[#8a5a00] bg-[#fdf0d8] border border-[#f2d9a8] px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#eef0f3] px-0">
            <button
              onClick={() => {
                setActiveTab('settings');
                onClose();
              }}
              className={`
                w-full flex items-center justify-between px-5 py-2.5 text-[13px] transition-colors text-left
                ${activeTab === 'settings' 
                  ? 'bg-white font-bold text-[#1f5f8b] border-l-[3px] border-[#1f5f8b]' 
                  : 'font-normal text-[#44474e] hover:bg-[#eef0f3] hover:text-[#191c20] border-l-[3px] border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Settings className={`w-4 h-4 ${activeTab === 'settings' ? 'text-[#1f5f8b]' : 'text-[#6c6f77]'}`} />
                <span>Settings</span>
              </div>
            </button>
          </div>
        </div>

        {/* Action Pinned Footer */}
        <div className="p-4 border-t border-[#dcdee3] space-y-3 bg-[#f6f7f9]">
          <button
            onClick={() => {
              onStartCount();
              onClose();
            }}
            className="w-full py-2.5 px-3.5 bg-[#1f5f8b] hover:bg-[#17496c] text-white font-semibold text-[13px] rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start a count</span>
          </button>
          <p className="text-[11px] text-[#8b8e96] leading-relaxed text-center">
            Taking literature out reserves it. Stock only moves when the count is posted.
          </p>
        </div>
      </aside>
    </>
  );
};
