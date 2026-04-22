/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Calendar, 
  BarChart3, 
  Settings, 
  PlusCircle, 
  Search, 
  Bell, 
  HelpCircle, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Truck, 
  Database,
  MoreVertical,
  Download,
  Upload,
  Camera,
  Filter,
  ArrowRight,
  History,
  Shield,
  BellRing,
  RefreshCw,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LogIn,
  ShoppingCart,
  Users,
  ShieldAlert,
  Clock3,
  Plus,
  FileText,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { seedData, updateSettings } from './services/firestoreService';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from './lib/utils';
import { useFirebase } from './context/FirebaseContext';
import InventoryModal from './components/InventoryModal';
import EventModal from './components/EventModal';
import DistributionModal from './components/DistributionModal';
import BulkImportModal from './components/BulkImportModal';
import QRScannerModal from './components/QRScannerModal';
import AIInsightsView from './components/AIInsightsView';
import { generateMonthlyReport } from './lib/pdfGenerator';
import { exportToCSV } from './lib/csvExport';

// --- Types ---

type Tab = 'dashboard' | 'inventory' | 'events' | 'reports' | 'settings' | 'users' | 'logs' | 'ai_insights';

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab, onDistribute, isAdmin, isOpen, onClose }: { activeTab: Tab, setActiveTab: (t: Tab) => void, onDistribute: () => void, isAdmin: boolean, isOpen: boolean, onClose: () => void }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'ai_insights', label: 'AI Insights', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isAdmin) {
    navItems.splice(4, 0, { id: 'users', label: 'Users', icon: Users });
    navItems.splice(5, 0, { id: 'logs', label: 'Paper Trail', icon: History });
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[60] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed left-0 top-0 h-screen w-64 bg-primary flex flex-col z-[70] transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-secondary flex items-center justify-center rounded-sharp">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-mono font-bold text-lg tracking-tighter text-white uppercase leading-none">Invo</div>
              <div className="font-headline font-medium text-[8px] text-slate-400 tracking-widest uppercase opacity-60">System v1</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white hover:text-secondary transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 mt-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as Tab);
                if (window.innerWidth < 1024) onClose();
              }}
              className={cn(
                "w-full px-6 py-3 flex items-center gap-3 font-headline text-[13px] tracking-tight transition-all duration-150",
                activeTab === item.id 
                  ? "text-secondary border-l-4 border-secondary bg-primary-container font-bold" 
                  : "text-slate-300 hover:text-white hover:bg-primary-container"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "fill-secondary/10" : "")} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto space-y-3">
          <button 
            onClick={() => {
              onDistribute();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full bg-secondary text-primary font-headline font-bold text-xs py-3 rounded-sharp flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
          >
            <ShoppingCart className="w-4 h-4" />
            DISTRIBUTE
          </button>
        </div>
      </aside>
    </>
  );
};

const Topbar = ({ searchQuery, setSearchQuery, onScan, onMenuClick }: { searchQuery: string, setSearchQuery: (s: string) => void, onScan: () => void, onMenuClick: () => void }) => {
  const { user, logout, notifications } = useFirebase();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL_STOCK': return <AlertTriangle className="w-4 h-4 text-tertiary" />;
      case 'LOW_STOCK': return <AlertTriangle className="w-4 h-4 text-secondary" />;
      case 'EVENT': return <Calendar className="w-4 h-4 text-primary" />;
      default: return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <header className="fixed top-0 right-0 h-16 left-0 lg:left-64 bg-surface border-b border-outline-variant flex items-center justify-between px-4 lg:px-8 z-50">
      <div className="flex items-center gap-4 lg:gap-8 flex-1">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-primary hover:bg-surface-container rounded-sharp transition-colors">
          <Menu className="w-6 h-6" />
        </button>

        <div className="relative group w-48 lg:w-64 hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH..." 
            className="w-full pl-10 pr-4 py-1.5 bg-surface-container border-none text-[12px] font-mono tracking-tight focus:ring-1 focus:ring-primary rounded-sharp"
          />
        </div>

        <div className="hidden lg:flex items-center gap-6">
          {['Bibles', 'Tracts', 'Booklets'].map((link) => (
            <a key={link} href="#" className="text-slate-500 hover:text-primary font-headline font-bold text-[11px] uppercase tracking-[1px] transition-all whitespace-nowrap">
              {link}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <button 
          onClick={onScan}
          className="p-2 text-slate-500 hover:text-primary transition-colors flex items-center gap-2 group"
          title="Scan QR Code"
        >
          <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-mono uppercase tracking-widest hidden xl:block">Scan</span>
        </button>

        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2 text-slate-500 hover:text-primary transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-tertiary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-[calc(100vw-32px)] sm:w-80 bg-background ledger-card shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-outline-variant bg-surface-container flex justify-between items-center">
                    <span className="font-headline font-bold text-[11px] uppercase tracking-widest text-primary">Notifications</span>
                    {unreadCount > 0 && <span className="font-mono text-[9px] text-tertiary font-bold uppercase">{unreadCount} New Alerts</span>}
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center opacity-40">
                        <BellRing className="w-8 h-8 mx-auto mb-2" />
                        <p className="font-mono text-[10px] uppercase tracking-widest">All clear</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={cn(
                            "p-4 border-b border-outline-variant hover:bg-surface-container transition-colors cursor-pointer",
                            !n.read && "bg-primary/5"
                          )}
                          onClick={async () => {
                            const { markNotificationAsRead } = await import('./services/firestoreService');
                            await markNotificationAsRead(n.id);
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="mt-1 shrink-0">{getNotificationIcon(n.type)}</div>
                            <div>
                              <p className="font-headline font-bold text-[13px] text-primary">{n.title}</p>
                              <p className="text-[12px] text-on-surface-variant leading-tight mt-1">{n.message}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-2 uppercase tracking-tighter">
                                {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        
        <button className="p-2 text-slate-500 hover:text-primary transition-colors" onClick={logout} title="Logout">
          <LogOut className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 lg:gap-3 ml-1 lg:ml-2 pl-2 lg:pl-4 border-l border-outline-variant">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] font-bold text-primary truncate max-w-[120px]">{user?.displayName || 'Admin'}</div>
          </div>
          <div className="h-8 w-8 bg-slate-200 rounded-sharp overflow-hidden border border-outline-variant shrink-0">
            <img 
              src={user?.photoURL || "https://picsum.photos/seed/admin/100/100"} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

// --- Page Views ---

const DashboardView = ({ inventory, events, onEdit, auditLogs, setActiveTab, isAdmin }: { inventory: any[], events: any[], onEdit: (item: any) => void, auditLogs: any[], setActiveTab: (t: Tab) => void, isAdmin: boolean }) => {
  const lowStockItems = inventory.filter(item => item.status === 'Low' || item.status === 'Out');
  const totalUnits = inventory.reduce((acc, item) => acc + (item.stockLevel || 0), 0);
  const distributedMTD = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);

  const getLogIcon = (action: string) => {
    if (action.includes('STOCK') || action.includes('ITEM')) return Package;
    if (action.includes('EVENT') || action.includes('DISTRIBUTION')) return Calendar;
    if (action.includes('USER') || action.includes('ROLE') || action.includes('EMAIL')) return Shield;
    return History;
  };

  const getLogColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('AUTHORIZED')) return 'bg-secondary/10 text-secondary';
    if (action.includes('UPDATE')) return 'bg-primary-container text-white';
    if (action.includes('ALERT') || action.includes('THRESHOLD')) return 'bg-tertiary/10 text-tertiary';
    return 'bg-slate-100 text-slate-500';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline font-extrabold text-3xl text-primary tracking-tight mb-1">Inventory Dashboard</h1>
        <p className="text-on-surface-variant font-medium text-sm">
          System status: <span className="text-secondary font-mono">OPERATIONAL</span> • Last sync: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="ledger-card p-6 h-40 flex flex-col justify-between">
          <div className="indicator-primary" />
          <div className="flex justify-between items-start">
            <span className="font-headline text-[12px] font-bold uppercase tracking-[1px] text-on-surface-variant">Total Catalog Items</span>
            <Database className="w-5 h-5 text-primary/20" />
          </div>
          <div>
            <div className="font-mono text-4xl font-bold text-primary">{inventory.length}</div>
            <div className="flex items-center gap-1 text-[11px] text-secondary font-bold mt-1">
              <TrendingUp className="w-3 h-3" />
              SYSTEM ASSETS
            </div>
          </div>
        </div>

        <div className="ledger-card p-6 h-40 flex flex-col justify-between">
          <div className="indicator-tertiary" />
          <div className="flex justify-between items-start">
            <span className="font-headline text-[12px] font-bold uppercase tracking-[1px] text-on-surface-variant">Critical Stock Alerts</span>
            <AlertTriangle className="w-5 h-5 text-tertiary/20" />
          </div>
          <div>
            <div className="font-mono text-4xl font-bold text-tertiary">{lowStockItems.length}</div>
            <div className="flex items-center gap-1 text-[11px] text-tertiary font-bold mt-1">
              <AlertTriangle className="w-3 h-3" />
              REQUIRES IMMEDIATE REORDER
            </div>
          </div>
        </div>

        <div className="ledger-card p-6 h-40 flex flex-col justify-between">
          <div className="indicator-secondary" />
          <div className="flex justify-between items-start">
            <span className="font-headline text-[12px] font-bold uppercase tracking-[1px] text-on-surface-variant">Distributed MTD</span>
            <Truck className="w-5 h-5 text-secondary/20" />
          </div>
          <div>
            <div className="font-mono text-4xl font-bold text-primary">{distributedMTD.toLocaleString()}</div>
            <div className="text-[11px] text-on-surface-variant font-bold mt-1 uppercase">
              Active distribution channels: {events.length.toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={cn("space-y-6", isAdmin ? "lg:col-span-2" : "col-span-full")}>
          <div className="ledger-card">
            <div className="px-4 sm:px-6 py-4 border-b border-outline-variant flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-surface-container">
              <h2 className="font-headline font-bold text-xs sm:text-sm uppercase tracking-wider text-primary">Action Required: Low Stock</h2>
              <span className="text-[9px] sm:text-[11px] font-mono font-bold text-tertiary px-2 py-0.5 border border-tertiary/30 bg-tertiary/5 w-fit">PRIORITY: HIGH</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container/50 text-on-surface-variant">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 font-headline text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">SKU</th>
                    <th className="px-4 sm:px-6 py-3 font-headline text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Resource Name</th>
                    <th className="px-4 sm:px-6 py-3 font-headline text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Level</th>
                    <th className="px-4 sm:px-6 py-3 font-headline text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {lowStockItems.slice(0, 3).map((item) => (
                    <tr key={item.id} className="hover:bg-surface-container transition-colors">
                      <td className="px-4 sm:px-6 py-4 font-mono text-[10px] sm:text-xs font-bold">{item.sku}</td>
                      <td className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-medium">{item.title}</td>
                      <td className="px-4 sm:px-6 py-4 font-mono text-[10px] sm:text-xs text-tertiary font-bold">{item.stockLevel}</td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <button 
                          onClick={() => onEdit(item)}
                          className="bg-primary text-white px-2 py-1 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded-sharp hover:bg-primary-container transition-all"
                        >
                          EDIT
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lowStockItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 sm:px-6 py-8 text-center text-on-surface-variant text-[10px] sm:text-xs font-mono uppercase tracking-widest">Clear status</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {lowStockItems.length > 3 && (
              <div className="px-6 py-3 bg-surface-container text-center">
                <button className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">View All Alerts</button>
              </div>
            )}
          </div>

        <div className="ledger-card h-[200px] sm:h-[320px] relative">
          <div className="absolute top-0 left-0 w-full z-10 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-white/90 to-transparent">
            <h2 className="font-headline font-bold text-xs sm:text-sm uppercase tracking-wider text-primary">Regional Hubs</h2>
          </div>
          <img 
            src="https://picsum.photos/seed/map/1200/600?grayscale&blur=2" 
            alt="Map" 
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
            <div className="bg-primary text-white p-2 sm:p-3 rounded-sharp flex items-center gap-2 sm:gap-3 shadow-lg">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-[9px] sm:text-[11px] font-mono font-bold uppercase">Central: Online</span>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-6">
          <div className="ledger-card flex flex-col h-full">
            <div className="px-6 py-4 border-b border-outline-variant bg-surface-container">
              <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">System Log</h2>
            </div>
            <div className="p-6 flex-1">
              <div className="space-y-8 relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-outline-variant" />
                {auditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 opacity-40">
                    <History className="w-8 h-8 mb-2" />
                    <p className="font-mono text-[10px] uppercase tracking-widest">No activity</p>
                  </div>
                ) : (
                  auditLogs.slice(0, 5).map((log, i) => {
                    const Icon = getLogIcon(log.action);
                    const timeStr = log.timestamp?.toDate 
                      ? log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    return (
                      <div key={log.id || i} className="relative pl-10">
                        <div className={cn("absolute left-0 top-0 w-6 h-6 flex items-center justify-center rounded-full z-10", getLogColor(log.action))}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="text-[11px] text-on-surface-variant font-mono mb-1">{timeStr} • {log.action.replace('_', ' ')}</div>
                        <p className="text-sm font-medium text-primary leading-tight line-clamp-2">{log.details}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container text-center">
              <button 
                onClick={() => setActiveTab('logs')}
                className="text-xs font-bold text-secondary flex items-center justify-center gap-2 w-full hover:text-primary transition-all"
              >
                VIEW FULL AUDIT TRAIL
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};

const InventoryView = ({ inventory, onAdd, onEdit, onBulkImport, globalSearch }: { inventory: any[], onAdd: () => void, onEdit: (item: any) => void, onBulkImport: () => void, globalSearch: string }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [filters, setFilters] = useState({
    category: 'All',
    language: 'All',
    status: 'All'
  });

  const categories = ['All', ...new Set(inventory.map(item => item.category))];
  const languages = ['All', ...new Set(inventory.map(item => item.language))];
  const statuses = ['All', 'Healthy', 'Low', 'Out'];

  const filteredInventory = inventory.filter(item => {
    const query = (localSearch || globalSearch).toLowerCase();
    const matchesSearch = 
      item.title?.toLowerCase().includes(query) || 
      item.sku?.toLowerCase().includes(query);
    const matchesCategory = filters.category === 'All' || item.category === filters.category;
    const matchesLanguage = filters.language === 'All' || item.language === filters.language;
    const matchesStatus = filters.status === 'All' || item.status === filters.status;
    
    return matchesSearch && matchesCategory && matchesLanguage && matchesStatus;
  });

  const totalUnits = filteredInventory.reduce((acc, item) => acc + (item.stockLevel || 0), 0);
  const lowStockCount = filteredInventory.filter(item => item.status === 'Low' || item.status === 'Out').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="font-mono text-[11px] text-secondary bg-primary px-2 py-0.5 rounded-sharp mb-2 inline-block">INV-MTX-PRIME</span>
          <h2 className="text-[24px] sm:text-[32px] font-headline font-bold text-primary tracking-tight leading-loose sm:leading-none">Literature Matrix</h2>
          <p className="text-on-surface-variant text-sm mt-1 sm:mt-2">Tracking outreach literature and resources.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={onBulkImport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-outline-variant bg-surface text-[12px] font-medium text-on-surface hover:bg-surface-container transition-colors rounded-sharp"
          >
            <Upload className="w-4 h-4" />
            <span className="sm:inline">Bulk</span>
          </button>
          <button 
            onClick={() => exportToCSV(filteredInventory, 'lit_ledger_inventory')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-outline-variant bg-surface text-[12px] font-medium text-on-surface hover:bg-surface-container transition-colors rounded-sharp"
          >
            <Download className="w-4 h-4" />
            <span className="sm:inline">Export</span>
          </button>
          <button 
            onClick={onAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white text-[12px] font-bold active:scale-95 transition-all rounded-sharp shadow-lg whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            Add Resource
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border text-[12px] font-medium transition-all rounded-sharp",
              showFilters 
                ? "bg-primary text-white border-primary" 
                : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container"
            )}
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Filters'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="ledger-card p-6 bg-surface-container-low grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Local Search Override</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    placeholder="Filter by name..."
                    className="w-full pl-10 pr-4 py-2 bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Category</label>
                <select 
                  value={filters.category}
                  onChange={e => setFilters({...filters, category: e.target.value})}
                  className="w-full px-4 py-2 bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm appearance-none"
                >
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Language</label>
                <select 
                  value={filters.language}
                  onChange={e => setFilters({...filters, language: e.target.value})}
                  className="w-full px-4 py-2 bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm appearance-none"
                >
                  {languages.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Status</label>
                <select 
                  value={filters.status}
                  onChange={e => setFilters({...filters, status: e.target.value})}
                  className="w-full px-4 py-2 bg-surface border-0 border-b-2 border-outline-variant focus:border-primary focus:ring-0 text-sm appearance-none"
                >
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3 ledger-card p-5">
          <div className="indicator-secondary" />
          <p className="text-[11px] font-headline font-bold text-on-surface-variant uppercase tracking-wider">Filtered Units</p>
          <p className="text-3xl font-mono font-bold text-primary mt-1">{totalUnits.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-secondary">
            <TrendingUp className="w-3 h-3" />
            <span>MATCHED TOTAL</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 ledger-card p-5">
          <div className="indicator-tertiary" />
          <p className="text-[11px] font-headline font-bold text-on-surface-variant uppercase tracking-wider">Low Stock (Filtered)</p>
          <p className="text-3xl font-mono font-bold text-primary mt-1">{lowStockCount}</p>
          <div className="flex items-center gap-1 mt-2 text-[11px] text-tertiary">
            <AlertTriangle className="w-3 h-3" />
            <span>Requires Attention</span>
          </div>
        </div>
        <div className="col-span-12 md:col-span-6 bg-primary p-5 rounded-sharp relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-[11px] font-headline font-bold text-slate-400 uppercase tracking-wider">Active Distributions</p>
            <p className="text-3xl font-mono font-bold text-white mt-1">942 <span className="text-sm font-normal text-slate-400">vols</span></p>
            <div className="w-full bg-slate-700 h-[2px] mt-4">
              <div className="bg-secondary h-full w-[65%]" />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">65% of monthly target reached</p>
          </div>
          <Truck className="absolute right-[-20px] top-[-20px] w-32 h-32 text-white opacity-10 rotate-12" />
        </div>
      </div>

      <div className="ledger-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">SKU</th>
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">Title</th>
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">Language</th>
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest text-right">Unit Price</th>
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest text-right">Stock Level</th>
                <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredInventory.map((row) => (
                <tr key={row.id || row.sku} className="hover:bg-surface-container transition-colors">
                  <td className="px-6 py-4 font-mono text-[12px] text-primary">{row.sku}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-[13px] text-primary">{row.title}</div>
                    <div className="text-[11px] text-on-surface-variant">{row.subtitle}</div>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-on-surface">{row.category}</td>
                  <td className="px-6 py-4 text-[12px] text-on-surface">{row.language}</td>
                  <td className="px-6 py-4 font-mono text-[13px] text-right">${row.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</td>
                  <td className="px-6 py-4 font-mono text-[13px] text-right">{row.stockLevel?.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full", 
                        row.status === 'Healthy' ? "bg-secondary" : 
                        row.status === 'Low' ? "bg-tertiary" : "bg-slate-300"
                      )} />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface">{row.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onEdit(row)}
                      className="text-slate-400 hover:text-primary transition-colors p-2 hover:bg-surface-container rounded-sharp"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-xs font-mono uppercase tracking-widest">No matching items found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      <div className="flex justify-between items-center px-6 py-4 bg-surface-container border-t border-outline-variant">
        <div className="text-[11px] text-on-surface-variant font-medium">
          Showing <span className="font-bold text-primary">{filteredInventory.length}</span> of <span className="font-bold text-primary">{inventory.length}</span> entries
        </div>
        <div className="flex gap-1">
          <button className="px-3 py-1 border border-outline-variant bg-surface text-[11px] font-bold text-on-surface-variant opacity-50 cursor-not-allowed rounded-sharp">Previous</button>
          <button className="px-3 py-1 border border-primary bg-primary text-white text-[11px] font-bold rounded-sharp">1</button>
          <button className="px-3 py-1 border border-outline-variant bg-surface text-[11px] font-bold text-on-surface-variant hover:border-primary transition-colors rounded-sharp">Next</button>
        </div>
      </div>
    </div>
  </div>
  );
};

const UsersView = ({ users }: { users: any[] }) => {
  const { updateUserRole, currentUserProfile, authorizedEmails } = useFirebase();
  const isAdmin = currentUserProfile?.role === 'admin';
  const [newEmail, setNewEmail] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user' | 'guest') => {
    if (!isAdmin) return;
    try {
      await updateUserRole(userId, newRole);
    } catch (error) {
      console.error("Failed to update role", error);
    }
  };

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !isAdmin) return;
    setIsAuthorizing(true);
    try {
      const { authorizeEmail } = await import('./services/firestoreService');
      await authorizeEmail(newEmail.toLowerCase().trim());
      setNewEmail('');
    } catch (error) {
      console.error("Failed to authorize email", error);
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleRemoveAuth = async (email: string) => {
    if (!isAdmin) return;
    try {
      const { removeAuthorizedEmail } = await import('./services/firestoreService');
      await removeAuthorizedEmail(email);
    } catch (error) {
      console.error("Failed to remove authorized email", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="font-headline font-bold text-[12px] uppercase tracking-[2px] text-on-surface-variant">Access Control</span>
          <h1 className="font-headline font-extrabold text-2xl sm:text-[32px] text-primary tracking-tight leading-none mt-1 uppercase">User Management</h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="ledger-card">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1px] text-primary">System Users</h2>
              <div className="px-3 py-1 bg-primary/10 text-primary font-mono text-[10px] font-bold rounded-sharp uppercase">
                {users.length} Active Profiles
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container border-b border-outline-variant">
                    <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">User</th>
                    <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Email</th>
                    <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold text-center">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {users.map((u) => (
                    <tr key={u.id} className={cn("hover:bg-surface-container transition-colors", u.role === 'guest' && "bg-secondary/5")}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img 
                              src={u.photoURL || `https://picsum.photos/seed/${u.id}/100/100`} 
                              alt={u.displayName} 
                              className="w-8 h-8 rounded-full border border-outline-variant"
                              referrerPolicy="no-referrer"
                            />
                            {u.role === 'guest' && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-white animate-pulse" />
                            )}
                          </div>
                          <div>
                            <span className="font-headline font-bold text-primary text-[14px] block">{u.displayName || 'Anonymous'}</span>
                            {u.role === 'guest' && <span className="text-[9px] font-mono text-secondary font-bold uppercase tracking-widest">Pending Approval</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[13px] text-on-surface">{u.email}</td>
                      <td className="px-6 py-4 text-center">
                        <select
                          disabled={!isAdmin || u.id === currentUserProfile?.id}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'user' | 'guest')}
                          className={cn(
                            "px-3 py-1 rounded-sharp text-[10px] font-bold uppercase tracking-wider border-0 focus:ring-1 focus:ring-primary appearance-none text-center cursor-pointer disabled:cursor-not-allowed",
                            u.role === 'admin' ? "bg-primary text-white" : 
                            u.role === 'guest' ? "bg-secondary text-primary" :
                            "bg-surface-container text-on-surface-variant"
                          )}
                        >
                          <option value="guest">Guest</option>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="ledger-card p-6">
            <div className="indicator-secondary" />
            <h3 className="font-headline font-bold text-[14px] uppercase tracking-[1.5px] text-primary mb-6">Authorize New Email</h3>
            <form onSubmit={handleAuthorize} className="space-y-4">
              <div className="space-y-2">
                <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Email Address</label>
                <input 
                  type="email" 
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={isAuthorizing || !newEmail}
                className="w-full bg-primary text-white py-3 rounded-sharp font-headline font-bold text-[12px] uppercase tracking-widest hover:bg-primary-container transition-all disabled:opacity-50"
              >
                {isAuthorizing ? 'Authorizing...' : 'Add to Allowlist'}
              </button>
            </form>
            <p className="mt-4 text-[10px] text-on-surface-variant leading-relaxed italic">
              * Only authorized emails can create a profile. Random sign-ins will be blocked.
            </p>
          </div>

          <div className="ledger-card p-6">
            <h3 className="font-headline font-bold text-[14px] uppercase tracking-[1.5px] text-on-surface-variant mb-6">Authorized Emails</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {authorizedEmails.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-outline-variant rounded-sharp">
                  <p className="text-[11px] font-mono text-slate-400 uppercase">No emails authorized</p>
                </div>
              ) : (
                authorizedEmails.sort().map(email => (
                  <div key={email} className="flex items-center justify-between p-3 bg-surface-container rounded-sharp border border-outline-variant group">
                    <span className="font-mono text-[12px] text-on-surface truncate mr-2">{email}</span>
                    <button 
                      onClick={() => handleRemoveAuth(email)}
                      className="text-slate-400 hover:text-tertiary transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LogsView = ({ logs }: { logs: any[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const actions = ['ALL', ...new Set(logs.map(l => l.action))];

  const getActionColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('AUTHORIZED')) return 'text-secondary bg-secondary/10';
    if (action.includes('DELETED') || action.includes('DEAUTHORIZED')) return 'text-tertiary bg-tertiary/10';
    if (action.includes('STOCK') || action.includes('DISTRIBUTION')) return 'text-primary bg-primary/10';
    return 'text-on-surface-variant bg-surface-container';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('STOCK') || action.includes('DISTRIBUTION')) return <Package className="w-3 h-3" />;
    if (action.includes('EVENT')) return <Calendar className="w-3 h-3" />;
    if (action.includes('USER') || action.includes('ROLE') || action.includes('EMAIL')) return <Users className="w-3 h-3" />;
    return <History className="w-3 h-3" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <span className="font-headline font-bold text-[12px] uppercase tracking-[2px] text-on-surface-variant">Audit Trail</span>
          <h1 className="font-headline font-extrabold text-2xl sm:text-[32px] text-primary tracking-tight leading-none mt-1 uppercase">System Logs</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface-container border border-outline-variant text-xs font-mono rounded-sharp focus:ring-1 focus:ring-primary w-64"
            />
          </div>
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 bg-surface-container border border-outline-variant text-[10px] font-headline font-bold uppercase tracking-wider rounded-sharp focus:ring-1 focus:ring-primary appearance-none pr-10 relative"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%230A2540\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '12px' }}
          >
            {actions.map(action => (
              <option key={action} value={action}>{action.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ledger-card">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1px] text-primary">Activity Stream</h2>
          <span className="font-mono text-[10px] text-slate-400 uppercase">Showing {filteredLogs.length} matching events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Timestamp</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">User</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Action</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <History className="w-8 h-8" />
                      <p className="font-mono text-[11px] uppercase tracking-widest">No activity matches your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono text-[12px] text-on-surface font-bold">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-[10px] font-bold text-primary">
                          {log.userName?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-headline font-bold text-[13px] text-primary">{log.userName}</span>
                          <span className="font-mono text-[10px] text-on-surface-variant">{log.userEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn("inline-flex items-center gap-2 px-2 py-1 rounded-sharp font-mono text-[10px] font-bold uppercase tracking-wider", getActionColor(log.action))}>
                        {getActionIcon(log.action)}
                        {log.action.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[13px] text-on-surface leading-relaxed max-w-md">
                        {log.details}
                      </p>
                      {log.metadata && (
                        <div className="mt-2 hidden group-hover:block">
                          <pre className="text-[9px] font-mono bg-surface-container-low p-2 rounded-sharp border border-outline-variant overflow-x-auto max-w-xs">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ReportsView = ({ inventory, events, auditLogs, settings }: { inventory: any[], events: any[], auditLogs: any[], settings: any }) => {
  const totalDistributions = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);
  
  const categoryCounts = inventory.reduce((acc: any, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const dynamicPieData = Object.keys(categoryCounts).map((cat, i) => ({
    name: cat,
    value: Math.round((categoryCounts[cat] / (inventory.length || 1)) * 100) || 0,
    color: i === 0 ? '#0A2540' : i === 1 ? '#00D4B6' : i === 2 ? '#FF7369' : `hsl(${i * 60}, 70%, 50%)`
  }));

  // Dynamic Line Data calculation
  const skuToCategory = inventory.reduce((acc: any, item) => {
    acc[item.sku] = item.category;
    return acc;
  }, {});

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap: any = {};
  
  // Initialize current year's months
  months.forEach(m => {
    monthlyMap[m] = { 
      name: m, 
      bibles: 0, bibles_en: 0, bibles_es: 0,
      tracts: 0, tracts_en: 0, tracts_es: 0,
      booklets: 0, booklets_en: 0, booklets_es: 0
    };
  });

  events.forEach(event => {
    try {
      const date = event.date?.toDate ? event.date.toDate() : new Date(event.date);
      if (isNaN(date.getTime())) return;
      
      const monthLabel = months[date.getMonth()];
      
      if (event.materials && Array.isArray(event.materials)) {
        event.materials.forEach((m: any) => {
          const category = (skuToCategory[m.sku] || '').toLowerCase();
          const language = (skuToLanguage[m.sku] || '').toLowerCase();
          const qty = m.quantity || 0;

          if (category.includes('bible')) {
            monthlyMap[monthLabel].bibles += qty;
            if (language.includes('spanish')) monthlyMap[monthLabel].bibles_es += qty;
            else if (language.includes('english')) monthlyMap[monthLabel].bibles_en += qty;
          } else if (category.includes('tract')) {
            monthlyMap[monthLabel].tracts += qty;
            if (language.includes('spanish')) monthlyMap[monthLabel].tracts_es += qty;
            else if (language.includes('english')) monthlyMap[monthLabel].tracts_en += qty;
          } else if (category.includes('booklet')) {
            monthlyMap[monthLabel].booklets += qty;
            if (language.includes('spanish')) monthlyMap[monthLabel].booklets_es += qty;
            else if (language.includes('english')) monthlyMap[monthLabel].booklets_en += qty;
          } else {
            // Default fallback
            monthlyMap[monthLabel].tracts += qty;
          }
        });
      } else if (event.categoryStats) {
        // Handle categorized stats (e.g. from bulk import or manual distribution)
        const s = event.categoryStats;
        monthlyMap[monthLabel].bibles += (s.bibles || 0);
        monthlyMap[monthLabel].bibles_en += (s.bibles_en || 0);
        monthlyMap[monthLabel].bibles_es += (s.bibles_es || 0);
        
        monthlyMap[monthLabel].tracts += (s.tracts || 0);
        monthlyMap[monthLabel].tracts_en += (s.tracts_en || 0);
        monthlyMap[monthLabel].tracts_es += (s.tracts_es || 0);
        
        monthlyMap[monthLabel].booklets += (s.booklets || 0);
        monthlyMap[monthLabel].booklets_en += (s.booklets_en || 0);
        monthlyMap[monthLabel].booklets_es += (s.booklets_es || 0);
      } else {
        // Fallback for legacy events
        monthlyMap[monthLabel].tracts += (event.materialsDistributed || 0);
      }
    } catch (e) {
      console.warn("Skipping malformed event date in reports", e);
    }
  });

  const dynamicLineData = Object.values(monthlyMap);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-primary">Distribution Reports</h2>
          <p className="text-on-surface-variant text-sm mt-1">Analyzing literature outflow and metrics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-surface border border-outline-variant p-1 rounded-sharp">
            <button className="px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider text-primary border-r border-outline-variant">30D</button>
            <button className="px-2 py-1 text-[11px] font-headline font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary border-r border-outline-variant">Q4</button>
            <button className="px-2 py-1 text-on-surface-variant"><Calendar className="w-3 h-3" /></button>
          </div>
          <button 
            onClick={() => exportToCSV(inventory, 'lit_ledger_full_report')}
            className="border border-outline-variant text-primary px-3 py-1.5 rounded-sharp font-headline font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 hover:bg-surface-container transition-all"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button 
            onClick={() => generateMonthlyReport(inventory, events, auditLogs, settings)}
            className="bg-primary text-white px-3 py-1.5 rounded-sharp font-headline font-bold text-[11px] uppercase tracking-wider flex items-center gap-2 hover:bg-primary-container transition-all shadow-md"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Distributions', val: totalDistributions.toLocaleString(), trend: 'LIFETIME VOLUME', color: 'indicator-secondary', trendColor: 'text-secondary', icon: TrendingUp },
          { label: 'Active Events', val: events.length.toString().padStart(2, '0'), trend: 'Stabilized distribution flow', color: 'indicator-tertiary', trendColor: 'text-on-surface-variant', icon: null },
          { label: 'Inventory Velocity', val: '82%', trend: '-2.4% below target', color: 'indicator-primary', trendColor: 'text-tertiary', icon: TrendingDown },
          { label: 'Unique Resources', val: inventory.length.toString(), trend: 'Catalog diversity', color: 'bg-slate-400', trendColor: 'text-on-surface-variant', icon: null },
        ].map((stat, i) => (
          <div key={i} className="ledger-card p-6">
            <div className={cn("absolute top-0 left-0 h-full w-1", stat.color)} />
            <p className="text-[11px] font-headline font-bold text-on-surface-variant uppercase tracking-[1px] mb-2">{stat.label}</p>
            <div className="font-mono text-3xl text-primary">{stat.val}</div>
            <div className={cn("mt-4 flex items-center gap-2 text-[12px]", stat.trendColor)}>
              {stat.icon && <stat.icon className="w-4 h-4" />}
              <span>{stat.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 ledger-card p-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-headline text-[14px] font-bold uppercase tracking-wider text-primary">Volume Trends Over Time</h3>
              <p className="text-on-surface-variant text-[12px]">Daily distribution counts aggregated monthly</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-[11px] font-headline uppercase font-bold text-on-surface-variant">Bibles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-secondary rounded-full" />
                <span className="text-[11px] font-headline uppercase font-bold text-on-surface-variant">Tracts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-tertiary rounded-full" />
                <span className="text-[11px] font-headline uppercase font-bold text-on-surface-variant">Booklets</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicLineData}>
                <defs>
                  <linearGradient id="colorBibles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A2540" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0A2540" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6EBEE" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#8898AA', fontWeight: 'bold' }}
                />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="bibles" stroke="#0A2540" strokeWidth={3} fillOpacity={1} fill="url(#colorBibles)" />
                <Line type="monotone" dataKey="tracts" stroke="#00D4B6" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="booklets" stroke="#FF7369" strokeWidth={3} strokeDasharray="8 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ledger-card p-8 flex flex-col items-center">
          <h3 className="font-headline text-[14px] font-bold uppercase tracking-wider text-primary self-start mb-1">Category Breakdown</h3>
          <p className="text-on-surface-variant text-[12px] self-start mb-8">Stock allocation by type</p>
          <div className="relative w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dynamicPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dynamicPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl text-primary font-bold">{inventory.length > 0 ? '100%' : '0%'}</span>
              <span className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Audited</span>
            </div>
          </div>
          <div className="w-full mt-10 space-y-3">
            {dynamicPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sharp" style={{ backgroundColor: item.color }} />
                  <span className="text-on-surface">{item.name}</span>
                </div>
                <span className="font-mono font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
          
          <div className="w-full mt-8 pt-8 border-t border-outline-variant space-y-4">
            <h4 className="font-headline text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Language Matrix</h4>
            <div className="space-y-4">
              {[
                { label: 'Bibles', en: dynamicLineData.reduce((acc, curr) => acc + (curr.bibles_en || 0), 0), es: dynamicLineData.reduce((acc, curr) => acc + (curr.bibles_es || 0), 0) },
                { label: 'Tracts', en: dynamicLineData.reduce((acc, curr) => acc + (curr.tracts_en || 0), 0), es: dynamicLineData.reduce((acc, curr) => acc + (curr.tracts_es || 0), 0) },
                { label: 'Booklets', en: dynamicLineData.reduce((acc, curr) => acc + (curr.booklets_en || 0), 0), es: dynamicLineData.reduce((acc, curr) => acc + (curr.booklets_es || 0), 0) },
              ].map(cat => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold uppercase text-primary">
                    <span>{cat.label}</span>
                    <span className="font-mono">{cat.en + cat.es}</span>
                  </div>
                  <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-container">
                    <div className="bg-primary h-full transition-all" style={{ width: `${(cat.en / (cat.en + cat.es || 1)) * 100}%` }} />
                    <div className="bg-secondary h-full transition-all" style={{ width: `${(cat.es / (cat.en + cat.es || 1)) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono font-bold uppercase text-on-surface-variant">
                    <span>EN: {cat.en}</span>
                    <span>ES: {cat.es}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EventsView = ({ events, onAdd, onEdit, onBulkImport }: { events: any[], onAdd: () => void, onEdit: (event: any) => void, onBulkImport: () => void }) => {
  const totalDistributed = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <span className="font-headline font-bold text-[12px] uppercase tracking-[2px] text-on-surface-variant">Management Ledger</span>
          <h1 className="font-headline font-extrabold text-2xl sm:text-[32px] text-primary tracking-tight leading-none mt-1 uppercase">Events Manager</h1>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button 
            onClick={onBulkImport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 border border-outline-variant bg-surface text-[12px] font-medium text-on-surface hover:bg-surface-container transition-colors rounded-sharp"
          >
            <Upload className="w-4 h-4" />
            <span className="sm:inline">Bulk</span>
          </button>
          <button 
            onClick={() => exportToCSV(events, 'lit_ledger_events')}
            className="flex-1 sm:flex-none px-4 py-2 border border-outline-variant text-primary font-headline font-bold text-[11px] uppercase tracking-wider rounded-sharp hover:bg-surface-container transition-colors"
          >
            Export
          </button>
          <button 
            onClick={onAdd}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white font-headline font-bold text-[11px] uppercase tracking-wider rounded-sharp hover:bg-primary-container transition-colors shadow-sm whitespace-nowrap"
          >
            New Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 ledger-card p-6 h-40 flex flex-col justify-between">
          <div className="indicator-secondary" />
          <div>
            <span className="font-headline text-[11px] uppercase tracking-[1px] text-on-surface-variant font-bold">Total Active Events</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-mono text-[40px] text-primary font-bold leading-none">{events.length}</span>
              <span className="text-secondary font-bold text-[13px]">SYSTEM TOTAL</span>
            </div>
          </div>
          <div className="mt-6 h-[2px] bg-surface-container relative">
            <div className="absolute inset-0 bg-secondary w-3/4" />
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 ledger-card p-6 h-40 flex flex-col justify-between">
          <div className="indicator-primary" />
          <div>
            <span className="font-headline text-[11px] uppercase tracking-[1px] text-on-surface-variant font-bold">Items Distributed (LIFETIME)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-mono text-[40px] text-primary font-bold leading-none">{totalDistributed.toLocaleString()}</span>
            </div>
            <p className="mt-2 text-[12px] text-slate-500 font-medium">Distribution tracking across all regions</p>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-primary text-white p-6 rounded-sharp relative overflow-hidden">
          <div className="relative z-10">
            <span className="font-headline text-[11px] uppercase tracking-[1px] text-secondary font-bold">Next Regional Sync</span>
            <h3 className="font-headline font-bold text-[18px] mt-2">Western Conference Hall</h3>
            <p className="font-mono text-[13px] mt-1 text-slate-300">OCT 14, 2024 • 09:00 AM</p>
            <div className="mt-4 flex -space-x-2">
              {[1, 2, 3].map(i => (
                <img 
                  key={i}
                  src={`https://picsum.photos/seed/user${i}/100/100`} 
                  alt="User" 
                  className="w-8 h-8 rounded-full border-2 border-primary"
                  referrerPolicy="no-referrer"
                />
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-primary bg-primary-container flex items-center justify-center text-[10px] font-bold">+4</div>
            </div>
          </div>
          <RefreshCw className="absolute right-[-20px] bottom-[-20px] w-32 h-32 text-white opacity-10" />
        </div>
      </div>

      <div className="ledger-card">
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
          <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1px] text-primary">Distribution Ledger</h2>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-surface-container rounded-sharp transition-colors text-on-surface-variant">
              <Filter className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-surface-container rounded-sharp transition-colors text-on-surface-variant">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Event Name</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Date</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold">Location</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold text-right">Materials</th>
                <th className="px-6 py-4 font-headline text-[11px] uppercase tracking-[1.5px] text-on-surface-variant font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {events.map((row) => (
                <tr 
                  key={row.id} 
                  onClick={() => onEdit(row)}
                  className="hover:bg-surface-container transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-1.5 h-8 rounded-full", 
                        row.status === 'Scheduled' ? "bg-secondary" : 
                        row.status === 'Stock Alert' ? "bg-tertiary" : "bg-slate-200"
                      )} />
                      <div>
                        <p className="font-headline font-bold text-primary text-[14px]">{row.name}</p>
                        <p className="text-[11px] font-mono text-on-surface-variant">{row.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[13px] text-on-surface">
                    {row.date?.toDate ? row.date.toDate().toLocaleDateString() : row.date}
                  </td>
                  <td className="px-6 py-4 text-[13px] text-on-surface">{row.location}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-bold text-primary text-[13px]">{row.materialsDistributed?.toLocaleString()} items</span>
                      {row.categoryStats && (
                        <div className="flex flex-wrap justify-end gap-x-2 gap-y-1 mt-1 max-w-[150px]">
                          {row.categoryStats.bibles_en > 0 && (
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase bg-secondary/10 px-1 rounded-sharp">B-EN: {row.categoryStats.bibles_en}</span>
                          )}
                          {row.categoryStats.bibles_es > 0 && (
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase bg-secondary/10 px-1 rounded-sharp">B-ES: {row.categoryStats.bibles_es}</span>
                          )}
                          {(row.categoryStats.bibles > 0 && !(row.categoryStats.bibles_en > 0 || row.categoryStats.bibles_es > 0)) && (
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-secondary/10 px-1 rounded-sharp">B: {row.categoryStats.bibles}</span>
                          )}
                          
                          {row.categoryStats.tracts_en > 0 && (
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase bg-primary/10 px-1 rounded-sharp">T-EN: {row.categoryStats.tracts_en}</span>
                          )}
                          {row.categoryStats.tracts_es > 0 && (
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase bg-primary/10 px-1 rounded-sharp">T-ES: {row.categoryStats.tracts_es}</span>
                          )}
                          {(row.categoryStats.tracts > 0 && !(row.categoryStats.tracts_en > 0 || row.categoryStats.tracts_es > 0)) && (
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-primary/10 px-1 rounded-sharp">T: {row.categoryStats.tracts}</span>
                          )}

                          {row.categoryStats.booklets_en > 0 && (
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase bg-tertiary/10 px-1 rounded-sharp">BK-EN: {row.categoryStats.booklets_en}</span>
                          )}
                          {row.categoryStats.booklets_es > 0 && (
                            <span className="text-[8px] font-bold text-on-surface-variant uppercase bg-tertiary/10 px-1 rounded-sharp">BK-ES: {row.categoryStats.booklets_es}</span>
                          )}
                          {(row.categoryStats.booklets > 0 && !(row.categoryStats.booklets_en > 0 || row.categoryStats.booklets_es > 0)) && (
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase bg-tertiary/10 px-1 rounded-sharp">BK: {row.categoryStats.booklets}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-sharp text-[10px] font-bold uppercase tracking-wider",
                      row.status === 'Scheduled' ? "bg-secondary/10 text-secondary" : 
                      row.status === 'Stock Alert' ? "bg-tertiary/10 text-tertiary" : "bg-surface-container text-on-surface-variant"
                    )}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-on-surface-variant text-xs font-mono uppercase tracking-widest">No events found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ settings }: { settings: any }) => {
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    orgName: '',
    taxId: '',
    address: '',
    timezone: '',
    updateFrequency: '',
    warningThreshold: 250,
    criticalThreshold: 75,
    categories: [] as string[]
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        orgName: settings.orgName || '',
        taxId: settings.taxId || '',
        address: settings.address || '',
        timezone: settings.timezone || '',
        updateFrequency: settings.updateFrequency || 'Real-time (Atomic)',
        warningThreshold: settings.warningThreshold || 250,
        criticalThreshold: settings.criticalThreshold || 75,
        categories: settings.categories || ['Bibles', 'Tracts', 'Booklets']
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(formData);
      alert("Settings updated successfully!");
    } catch (error) {
      console.error("Failed to update settings", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm("This will populate your database with sample data. Continue?")) return;
    setSeeding(true);
    try {
      await seedData();
      alert("Database seeded successfully!");
    } catch (error) {
      console.error("Seeding failed", error);
      alert("Seeding failed. Check console for details.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-[11px] text-on-surface-variant uppercase tracking-widest mb-1">Configuration Ledger</div>
          <h1 className="font-headline font-bold text-3xl text-primary tracking-tight">System Settings</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSeed}
            disabled={seeding}
            className="px-6 py-2 border-2 border-tertiary text-tertiary font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-tertiary/5 transition-colors rounded-sharp disabled:opacity-50"
          >
            {seeding ? 'Seeding...' : 'Seed Initial Data'}
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp shadow-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

    <div className="grid grid-cols-12 gap-8">
      <section className="col-span-12 lg:col-span-8 ledger-card p-8">
        <div className="indicator-primary" />
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1.5px]">Organization Identity</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 md:col-span-1 space-y-2">
              <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Legal Organization Name</label>
              <input 
                type="text" 
                value={formData.orgName}
                onChange={e => setFormData({...formData, orgName: e.target.value})}
                className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
              />
            </div>
            <div className="col-span-2 md:col-span-1 space-y-2">
              <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Tax Identification Number</label>
              <input 
                type="text" 
                value={formData.taxId}
                onChange={e => setFormData({...formData, taxId: e.target.value})}
                className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Principal Business Address</label>
              <textarea 
                rows={3}
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all resize-none"
              />
            </div>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-4 ledger-card p-8">
        <div className="indicator-tertiary" />
        <div className="flex items-center gap-3 mb-8">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1.5px]">Taxonomies</h2>
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Material Categories</label>
            <div className="flex flex-wrap gap-2">
              {formData.categories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-sharp">
                  <span className="font-headline font-bold text-[11px] uppercase tracking-wider">{cat}</span>
                  <button 
                    onClick={() => setFormData({...formData, categories: formData.categories.filter((_, idx) => idx !== i)})}
                    className="hover:text-tertiary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input 
                type="text" 
                placeholder="New classification..."
                className="flex-1 border-0 border-b-2 border-surface-container bg-surface-container-low px-3 py-2 font-headline font-medium text-[12px] focus:ring-0 focus:border-primary transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val && !formData.categories.includes(val)) {
                      setFormData({...formData, categories: [...formData.categories, val]});
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <button 
                className="p-2 bg-surface-container hover:bg-surface-container-high text-primary transition-colors rounded-sharp"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  const val = input.value.trim();
                  if (val && !formData.categories.includes(val)) {
                    setFormData({...formData, categories: [...formData.categories, val]});
                    input.value = '';
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="col-span-12 lg:col-span-4 ledger-card p-8">
        <div className="indicator-secondary" />
        <div className="flex items-center gap-3 mb-8">
          <RefreshCw className="w-5 h-5 text-secondary" />
          <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1.5px]">Regional Sync</h2>
        </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-surface-container border border-outline-variant rounded-sharp">
              <div>
                <div className="font-headline font-bold text-[12px] text-primary">Timezone Alignment</div>
                <input 
                  type="text"
                  value={formData.timezone}
                  onChange={e => setFormData({...formData, timezone: e.target.value})}
                  className="bg-transparent border-0 p-0 font-mono text-[10px] text-on-surface-variant focus:ring-0 w-full"
                />
              </div>
              <div className="h-2 w-2 bg-secondary rounded-full animate-pulse" />
            </div>
            <div className="space-y-4">
              <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Update Frequency</label>
              <select 
                value={formData.updateFrequency}
                onChange={e => setFormData({...formData, updateFrequency: e.target.value})}
                className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary appearance-none"
              >
                <option>Real-time (Atomic)</option>
                <option>Every 15 Minutes</option>
                <option>Hourly Batch</option>
                <option>Daily Reconciliation</option>
              </select>
            </div>
          <div className="pt-4 border-t border-outline-variant">
            <div className="flex justify-between items-center mb-2">
              <span className="font-headline font-bold text-[11px] uppercase tracking-widest text-on-surface-variant">Last Sync Status</span>
              <span className="font-mono text-[11px] text-secondary font-bold">SUCCESSFUL</span>
            </div>
            <div className="font-mono text-[10px] text-slate-400">UUID: 8829-XJ-0012-PZ</div>
          </div>
        </div>
      </section>

      <section className="col-span-12 ledger-card p-8">
        <div className="indicator-tertiary" />
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-tertiary" />
            <h2 className="font-headline font-bold text-[14px] uppercase tracking-[1.5px]">Stock Thresholds & Intelligence</h2>
          </div>
          <div className="px-4 py-1 bg-tertiary/10 text-tertiary font-mono text-[10px] font-bold rounded-sharp">ALGORITHMIC SCALING ACTIVE</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="font-headline font-bold text-[12px] text-primary uppercase">Warning Level (Amber)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      value={formData.warningThreshold}
                      onChange={e => setFormData({...formData, warningThreshold: parseInt(e.target.value) || 0})}
                      className="w-20 bg-transparent border-0 border-b border-primary font-mono text-2xl font-bold text-primary text-right focus:ring-0"
                    />
                    <span className="text-[14px] text-on-surface-variant uppercase">units</span>
                  </div>
                </div>
                <div className="relative py-4">
                  <div className="h-1 w-full bg-surface-container rounded-full" />
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-primary" style={{ width: `${Math.min(100, (formData.warningThreshold / 500) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">Triggers a yellow visual indicator on dashboard widgets and sends a non-urgent notification to logistics leads.</p>
              </div>
            </div>
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="font-headline font-bold text-[12px] text-tertiary uppercase">Critical Threshold (Red)</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      value={formData.criticalThreshold}
                      onChange={e => setFormData({...formData, criticalThreshold: parseInt(e.target.value) || 0})}
                      className="w-20 bg-transparent border-0 border-b border-tertiary font-mono text-2xl font-bold text-tertiary text-right focus:ring-0"
                    />
                    <span className="text-[14px] text-on-surface-variant uppercase">units</span>
                  </div>
                </div>
                <div className="relative py-4">
                  <div className="h-1 w-full bg-surface-container rounded-full" />
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-tertiary" style={{ width: `${Math.min(100, (formData.criticalThreshold / 500) * 100)}%` }} />
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">Forces immediate replenishment orders. Prevents distribution of items if stock falls below this floor without supervisor override.</p>
              </div>
            </div>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Email Alerts', desc: 'Daily summary of low-stock items sent to procurement.', icon: BellRing, active: true },
            { label: 'Auto-Replenish', desc: 'Automatically draft POs when items hit critical levels.', icon: Package, active: false },
            { label: 'Safety Buffer', desc: 'Add 5% extra margin to all calculated thresholds.', icon: Shield, active: true },
          ].map((item, i) => (
            <div key={i} className="p-6 bg-surface-container flex gap-4 items-start border border-outline-variant rounded-sharp">
              <item.icon className="w-5 h-5 text-primary" />
              <div>
                <div className="font-headline font-bold text-[12px] uppercase tracking-wide mb-1">{item.label}</div>
                <div className="text-[11px] text-on-surface-variant">{item.desc}</div>
                <div className="mt-4 flex items-center gap-2">
                  <div className={cn("w-8 h-4 relative rounded-full transition-colors", item.active ? "bg-primary" : "bg-slate-300")}>
                    <div className={cn("absolute top-1 w-2 h-2 bg-white rounded-full transition-all", item.active ? "right-1" : "left-1")} />
                  </div>
                  <span className={cn("font-mono text-[9px] uppercase font-bold", item.active ? "text-primary" : "text-slate-400")}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
  );
};

// --- Login View ---

const LoginView = () => {
  const { login } = useFirebase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="ledger-card p-6 sm:p-12 max-w-md w-full text-center relative overflow-hidden">
        <div className="indicator-primary" />
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary flex items-center justify-center rounded-sharp shadow-xl">
            <Database className="w-6 h-6 sm:w-8 sm:h-8 text-secondary" />
          </div>
        </div>
        <h1 className="font-headline font-extrabold text-2xl sm:text-4xl text-primary tracking-tighter mb-2">INVENTORY SYSTEM</h1>
        <p className="text-on-surface-variant font-medium text-xs sm:text-sm mb-8 sm:mb-10 uppercase tracking-widest leading-relaxed">Internal Outreach Literature Management</p>
        
        <button 
          onClick={login}
          className="w-full bg-primary text-white py-3 sm:py-4 rounded-sharp font-headline font-bold text-xs sm:text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-primary-container transition-all active:scale-95 shadow-lg"
        >
          <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
          AUTHENTICATE WITH GOOGLE
        </button>
        
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-outline-variant">
          <p className="text-[9px] sm:text-[10px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed">Authorized Personnel Only • Secure Data Hub</p>
        </div>
      </div>
    </div>
  );
};

// --- Pending Access View ---

const PendingAccessView = ({ isAuthorized }: { isAuthorized: boolean }) => {
  const { logout, user } = useFirebase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="ledger-card p-12 max-w-md w-full text-center relative overflow-hidden">
        <div className="indicator-secondary" />
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-secondary/20 flex items-center justify-center rounded-sharp border-2 border-secondary">
            {isAuthorized ? <Clock3 className="w-8 h-8 text-secondary" /> : <ShieldAlert className="w-8 h-8 text-secondary" />}
          </div>
        </div>
        <h1 className="font-headline font-extrabold text-3xl text-primary tracking-tighter mb-4 uppercase">
          {isAuthorized ? 'Access Pending' : 'Access Denied'}
        </h1>
        <p className="text-on-surface-variant font-medium text-sm mb-2">Hello, <span className="text-primary font-bold">{user?.displayName}</span>.</p>
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed">
          {isAuthorized 
            ? "Your account has been successfully created, but it is currently restricted. Please contact a system administrator to approve your access."
            : "Your email is not on the authorized list for this system. Access is restricted to invited personnel only."}
        </p>
        
        <div className="space-y-4">
          <div className="p-4 bg-surface-container rounded-sharp border border-outline-variant flex items-center gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-secondary shrink-0" />
            <p className="text-[11px] font-mono text-on-surface-variant leading-tight uppercase tracking-wider">
              {isAuthorized 
                ? "Security Protocol: Data access is disabled until role verification is complete."
                : "Security Protocol: Unauthorized login attempt logged. Please sign out."}
            </p>
          </div>

          <button 
            onClick={logout}
            className="w-full border-2 border-outline-variant text-on-surface-variant py-4 rounded-sharp font-headline font-bold text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-surface-container transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            SIGN OUT
          </button>
        </div>
        
        <div className="mt-12 pt-8 border-t border-outline-variant">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">System ID: {user?.uid.slice(0, 8)}</p>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { user, currentUserProfile, loading, inventory, events, users, settings, isAuthorized, auditLogs } = useFirebase();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkImportInitialType, setBulkImportInitialType] = useState<'inventory' | 'events'>('inventory');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isAdmin = currentUserProfile?.role === 'admin';

  const handleAdd = () => {
    setSelectedItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event: any) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleScanSuccess = (decodedText: string) => {
    // Try to find the item by SKU
    const item = inventory.find(i => i.sku === decodedText || i.id === decodedText);
    if (item) {
      setSelectedItem(item);
      setIsModalOpen(true);
    } else {
      alert(`No item found with SKU/ID: ${decodedText}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="font-mono text-xs text-primary font-bold tracking-widest">INITIALIZING LEDGER...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (currentUserProfile?.role === 'guest' || !isAuthorized) {
    return <PendingAccessView isAuthorized={isAuthorized} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onDistribute={() => setIsDistributionOpen(true)} isAdmin={isAdmin} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Topbar searchQuery={globalSearch} setSearchQuery={setGlobalSearch} onScan={() => setIsScannerOpen(true)} onMenuClick={() => setIsSidebarOpen(true)} />
      
      <main className="lg:ml-64 pt-20 lg:pt-24 pb-12 px-4 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <DashboardView inventory={inventory} events={events} onEdit={handleEdit} auditLogs={auditLogs} setActiveTab={setActiveTab} isAdmin={isAdmin} />}
            {activeTab === 'inventory' && (
              <InventoryView 
                inventory={inventory} 
                onAdd={handleAdd} 
                onEdit={handleEdit} 
                onBulkImport={() => {
                  setBulkImportInitialType('inventory');
                  setIsBulkImportOpen(true);
                }}
                globalSearch={globalSearch} 
              />
            )}
              {activeTab === 'reports' && <ReportsView inventory={inventory} events={events} auditLogs={auditLogs} settings={settings} />}
              {activeTab === 'events' && (
                <EventsView 
                  events={events} 
                  onAdd={handleAddEvent} 
                  onEdit={handleEditEvent} 
                  onBulkImport={() => {
                    setBulkImportInitialType('events');
                    setIsBulkImportOpen(true);
                  }} 
                />
              )}
              {activeTab === 'users' && <UsersView users={users} />}
              {activeTab === 'logs' && <LogsView logs={auditLogs} />}
              {activeTab === 'ai_insights' && <AIInsightsView inventory={inventory} events={events} auditLogs={auditLogs} />}
              {activeTab === 'settings' && <SettingsView settings={settings} />}
            </motion.div>
          </AnimatePresence>

          <InventoryModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            item={selectedItem} 
            settings={settings}
          />

          <EventModal 
            isOpen={isEventModalOpen} 
            onClose={() => setIsEventModalOpen(false)} 
            event={selectedEvent} 
          />

          <DistributionModal 
            isOpen={isDistributionOpen} 
            onClose={() => setIsDistributionOpen(false)} 
            events={events} 
            inventory={inventory} 
            settings={settings}
          />

          <BulkImportModal 
            isOpen={isBulkImportOpen}
            onClose={() => setIsBulkImportOpen(false)}
            initialType={bulkImportInitialType}
          />

          <QRScannerModal 
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanSuccess={handleScanSuccess}
          />

          <footer className="mt-12 flex items-center justify-between pt-8 border-t border-outline-variant">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-secondary rounded-full" />
                <span className="font-mono text-[10px] text-on-surface-variant uppercase font-bold">All Systems Operational</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400">Node: NY-DATA-04</div>
            </div>
            <div className="flex gap-6">
              <a href="#" className="font-headline font-bold text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">Privacy Protocol</a>
              <a href="#" className="font-headline font-bold text-[10px] uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">Terms of Ledger</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
