import React from 'react';
import { Menu, Layers, ShieldCheck, User } from 'lucide-react';
import { ActiveTab } from '../types';

interface TopNavProps {
  onOpenMobileNav: () => void;
  hallName: string;
  userEmail?: string;
  userRole?: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenMobileNav,
  hallName,
  userEmail,
  userRole = 'Admin'
}) => {
  return (
    <header className="lg:hidden h-14 bg-[#f6f7f9] border-b border-[#dcdee3] px-4 flex items-center justify-between flex-none z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="p-1.5 rounded-md hover:bg-[#eef0f3] text-[#44474e] cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#1f5f8b] flex items-center justify-center text-white text-xs font-bold shadow-xs">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-[14px] text-[#191c20]">
            {hallName || 'Literature Inventory'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-xs text-[#1f5f8b] bg-[#e9f1f7] border border-[#1f5f8b]/20">
          {userRole}
        </span>
      </div>
    </header>
  );
};
