import React from 'react';
import { Menu, Layers, LogIn, LogOut, Database, Loader2 } from 'lucide-react';

interface TopNavProps {
  onOpenMobileNav: () => void;
  hallName: string;
  user?: any | null;
  userRole?: string;
  onLogin?: () => void;
  onLogout?: () => void;
  isLoggingIn?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenMobileNav,
  hallName,
  user,
  userRole = 'Admin',
  onLogin,
  onLogout,
  isLoggingIn = false
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
          <span className="font-bold text-[14px] text-[#191c20] truncate">
            {hallName || 'CISA Inventory'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-xs text-[#1f5f8b] bg-[#e9f1f7] border border-[#1f5f8b]/20">
              {userRole}
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1 text-[#6c6f77] hover:text-[#b3261e]"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className={`
              text-[11px] font-semibold text-[#1f5f8b] px-2.5 py-1 rounded border border-[#1f5f8b]/20 flex items-center gap-1.5 transition-all
              ${isLoggingIn 
                ? 'bg-[#d8e7f3] opacity-90 cursor-wait' 
                : 'bg-[#e9f1f7] hover:bg-[#d8e7f3] active:scale-95 cursor-pointer'
              }
            `}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-[#1f5f8b]" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <LogIn className="w-3 h-3" />
                <span>Sign In</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
