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
  LogOut,
  LogIn,
  ShoppingCart,
  Users,
  ShieldAlert,
  Clock3,
  Plus,
  FileText,
  Menu,
  X,
  ChevronRight,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateSettings } from './services/firestoreService';
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
import StockHistoryModal from './components/StockHistoryModal';
import { generateMonthlyReport } from './lib/pdfGenerator';
import { exportToCSV } from './lib/csvExport';
import { Timestamp } from 'firebase/firestore';

// --- Utils ---
const formatDate = (date: any, timezone: string = 'UTC') => {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  } catch (e) {
    return d.toLocaleDateString();
  }
};

const formatDateTime = (date: any, timezone: string = 'UTC') => {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
};

const formatTime = (date: any, timezone: string = 'UTC') => {
  if (!date) return 'N/A';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch (e) {
    return d.toLocaleTimeString();
  }
};

type Tab = 'dashboard' | 'inventory' | 'events' | 'reports' | 'settings' | 'users' | 'logs';

// --- Sidebar ---
const Sidebar = ({ activeTab, setActiveTab, onDistribute, isAdmin, isOpen, onClose }: {
  activeTab: Tab,
  setActiveTab: (t: Tab) => void,
  onDistribute: () => void,
  isAdmin: boolean,
  isOpen: boolean,
  onClose: () => void
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isAdmin) {
    navItems.splice(4, 0, { id: 'users', label: 'Users', icon: Users });
    navItems.splice(5, 0, { id: 'logs', label: 'Activity', icon: Activity });
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
            className="fixed inset-0 bg-gray-900/50 z-[60] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col z-[70] transition-transform duration-300 lg:translate-x-0 shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-secondary-400 to-secondary-600 rounded-xl flex items-center justify-center shadow-lg shadow-secondary-500/25">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-xl text-white tracking-tight">LitTrack</div>
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Inventory System</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as Tab);
                  if (window.innerWidth < 1024) onClose();
                }}
                className={cn(
                  "w-full px-4 py-3 flex items-center gap-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-white/10 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isActive ? "bg-secondary-500 text-white" : "bg-gray-700/50 group-hover:bg-gray-700"
                )}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto text-secondary-400" />}
              </button>
            );
          })}
        </nav>

        {/* Quick action */}
        <div className="p-4 border-t border-gray-700/50">
          <button
            onClick={() => {
              onDistribute();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-secondary-500/25"
          >
            <ShoppingCart className="w-4 h-4" />
            New Distribution
          </button>
        </div>
      </aside>
    </>
  );
};

// --- Topbar ---
const Topbar = ({ searchQuery, setSearchQuery, onScan, onMenuClick }: {
  searchQuery: string,
  setSearchQuery: (s: string) => void,
  onScan: () => void,
  onMenuClick: () => void
}) => {
  const { user, logout, notifications } = useFirebase();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL_STOCK': return <AlertCircle className="w-4 h-4 text-danger-500" />;
      case 'LOW_STOCK': return <AlertTriangle className="w-4 h-4 text-warning-500" />;
      case 'EVENT': return <Calendar className="w-4 h-4 text-primary-500" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <header className="fixed top-0 right-0 h-16 left-0 lg:left-64 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 flex items-center justify-between px-4 lg:px-6 z-50">
      <div className="flex items-center gap-4 flex-1">
        <button onClick={onMenuClick} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative group w-64 hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-xl text-sm font-sans placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 lg:gap-2">
        <button
          onClick={onScan}
          className="p-2.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors rounded-xl flex items-center gap-2"
          title="Scan QR Code"
        >
          <Camera className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="p-2.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors rounded-xl relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white" />
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
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <span className="font-display font-semibold text-sm text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-danger-100 text-danger-600 text-xs font-semibold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <BellRing className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm text-gray-400">All caught up!</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={cn(
                            "p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer",
                            !n.read && "bg-primary-50/30"
                          )}
                          onClick={async () => {
                            const { markNotificationAsRead } = await import('./services/firestoreService');
                            await markNotificationAsRead(n.id);
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5 shrink-0">{getNotificationIcon(n.type)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900">{n.title}</p>
                              <p className="text-[13px] text-gray-500 leading-snug mt-0.5">{n.message}</p>
                              <p className="text-[11px] text-gray-400 mt-2">
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

        <button className="p-2.5 text-gray-500 hover:text-danger-600 hover:bg-danger-50 transition-colors rounded-xl" onClick={logout} title="Logout">
          <LogOut className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 ml-2 pl-3 lg:pl-4 border-l border-gray-200">
          <div className="text-right hidden lg:block">
            <div className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{user?.displayName || 'Admin'}</div>
          </div>
          <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-gray-100 shrink-0">
            <img
              src={user?.photoURL || "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150"}
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

// --- Stat Card ---
const StatCard = ({ title, value, subtitle, trend, icon: Icon, color, onClick }: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: any;
  color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) => {
  const colorClasses = {
    primary: 'from-primary-500 to-primary-600',
    secondary: 'from-secondary-500 to-secondary-600',
    accent: 'from-accent-500 to-accent-600',
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-500 to-warning-600',
    danger: 'from-danger-500 to-danger-600',
  };

  const bgClasses = {
    primary: 'bg-primary-50',
    secondary: 'bg-secondary-50',
    accent: 'bg-accent-50',
    success: 'bg-success-50',
    warning: 'bg-warning-50',
    danger: 'bg-danger-50',
  };

  const textClasses = {
    primary: 'text-primary-600',
    secondary: 'text-secondary-600',
    accent: 'text-accent-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    danger: 'text-danger-600',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-gray-200 p-6 relative overflow-hidden transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-display font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1.5">{subtitle}</p>
          )}
        </div>
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgClasses[color])}>
          <Icon className={cn("w-6 h-6", textClasses[color])} />
        </div>
      </div>
      {trend && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
          <div className={cn(
            "h-full transition-all duration-500",
            trend === 'up' && 'bg-gradient-to-r from-success-400 to-success-500 w-3/4',
            trend === 'down' && 'bg-gradient-to-r from-danger-400 to-danger-500 w-1/4',
            trend === 'neutral' && 'bg-gradient-to-r from-gray-300 to-gray-400 w-1/2'
          )} />
        </div>
      )}
    </div>
  );
};

// --- Dashboard View ---
const DashboardView = ({ inventory, events, onEdit, auditLogs, setActiveTab, isAdmin, settings }: {
  inventory: any[],
  events: any[],
  onEdit: (item: any) => void,
  auditLogs: any[],
  setActiveTab: (t: Tab) => void,
  isAdmin: boolean,
  settings: any
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const lowStockItems = inventory.filter(item => item.status === 'Low' || item.status === 'Out');
  const displayedItems = isExpanded ? lowStockItems : lowStockItems.slice(0, 4);
  const totalUnits = inventory.reduce((acc, item) => acc + (item.stockLevel || 0), 0);
  const distributedMTD = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back! Here's an overview of your inventory system.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Items"
          value={inventory.length}
          subtitle="In catalog"
          icon={Package}
          color="primary"
          onClick={() => setActiveTab('inventory')}
        />
        <StatCard
          title="Total Units"
          value={totalUnits.toLocaleString()}
          subtitle="In stock"
          icon={Database}
          color="secondary"
        />
        <StatCard
          title="Low Stock"
          value={lowStockItems.length}
          subtitle="Items need attention"
          icon={AlertTriangle}
          color="warning"
        />
        <StatCard
          title="Distributed"
          value={distributedMTD.toLocaleString()}
          subtitle="Total units"
          icon={Truck}
          color="accent"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className={cn("bg-white rounded-2xl border border-gray-200 overflow-hidden", isAdmin ? "lg:col-span-2" : "col-span-full")}>
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-warning-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-warning-600" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-gray-900">Low Stock Alerts</h2>
                <p className="text-xs text-gray-400">{lowStockItems.length} items need attention</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {displayedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onEdit(item)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-2 h-10 rounded-full",
                    item.status === 'Out' ? 'bg-danger-500' : 'bg-warning-500'
                  )} />
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-400 font-mono">{item.sku}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn(
                      "font-mono font-semibold",
                      item.status === 'Out' ? 'text-danger-600' : 'text-warning-600'
                    )}>{item.stockLevel}</p>
                    <p className="text-xs text-gray-400">units</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
                </div>
              </div>
            ))}
            {lowStockItems.length === 0 && (
              <div className="px-6 py-12 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-success-500" />
                <p className="text-gray-500">All items are well stocked!</p>
              </div>
            )}
          </div>
          {lowStockItems.length > 4 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {isExpanded ? 'Show less' : `View all ${lowStockItems.length} items`}
              </button>
            </div>
          )}
        </div>

        {/* Activity Feed */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-gray-900">Recent Activity</h2>
                  <p className="text-xs text-gray-400">System events</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <History className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{log.details}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatTime(log.timestamp, settings?.timezone)} • {log.action.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-gray-400 text-sm">No recent activity</p>
                </div>
              )}
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setActiveTab('logs')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                View all activity <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Inventory View ---
const InventoryView = ({ inventory, onAdd, onEdit, onShowHistory, onBulkImport, globalSearch, isAdmin }: {
  inventory: any[],
  onAdd: () => void,
  onEdit: (item: any) => void,
  onShowHistory: (item: any) => void,
  onBulkImport: () => void,
  globalSearch: string,
  isAdmin: boolean
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [filters, setFilters] = useState({
    category: 'All',
    language: 'All',
    status: 'All'
  });

  const categories = ['All', ...new Set(inventory.map(item => item.category).filter(Boolean))];
  const languages = ['All', ...new Set(inventory.map(item => item.language).filter(Boolean))];
  const statuses = ['All', 'Healthy', 'Low', 'Out', 'Alerts'];

  const filteredInventory = inventory.filter(item => {
    const query = (localSearch || globalSearch).toLowerCase();
    const matchesSearch = item.title?.toLowerCase().includes(query) || item.sku?.toLowerCase().includes(query);
    const matchesCategory = filters.category === 'All' || item.category === filters.category;
    const matchesLanguage = filters.language === 'All' || item.language === filters.language;
    const matchesStatus = filters.status === 'All' || item.status === filters.status ||
      (filters.status === 'Alerts' && (item.status === 'Low' || item.status === 'Out'));
    return matchesSearch && matchesCategory && matchesLanguage && matchesStatus;
  });

  const totalUnits = filteredInventory.reduce((acc, item) => acc + (item.stockLevel || 0), 0);
  const lowStockCount = filteredInventory.filter(item => item.status === 'Low' || item.status === 'Out').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Healthy':
        return <span className="badge badge-success">Healthy</span>;
      case 'Low':
        return <span className="badge badge-warning">Low</span>;
      case 'Out':
        return <span className="badge badge-danger">Out</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your literature catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button onClick={onBulkImport} className="btn btn-outline btn-sm">
              <Upload className="w-4 h-4" /> Bulk Import
            </button>
          )}
          <button onClick={() => exportToCSV(filteredInventory, 'inventory')} className="btn btn-outline btn-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          {isAdmin && (
            <button onClick={onAdd} className="btn btn-primary btn-sm">
              <PlusCircle className="w-4 h-4" /> Add Item
            </button>
          )}
          <button onClick={() => setShowFilters(!showFilters)} className={cn("btn btn-sm", showFilters ? "btn-primary" : "btn-outline")}>
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={localSearch}
                    onChange={e => setLocalSearch(e.target.value)}
                    placeholder="Filter items..."
                    className="input pl-10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</label>
                <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})} className="input">
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Language</label>
                <select value={filters.language} onChange={e => setFilters({...filters, language: e.target.value})} className="input">
                  {languages.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</label>
                <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="input">
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-secondary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="text-xl font-display font-bold text-gray-900">{totalUnits.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Low Stock Items</p>
              <p className="text-xl font-display font-bold text-gray-900">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">SKU Types</p>
              <p className="text-xl font-display font-bold text-gray-900">{filteredInventory.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Language</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => onEdit(item)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-medium text-primary-600">{item.sku}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    {item.subtitle && <p className="text-sm text-gray-400">{item.subtitle}</p>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.language}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono font-semibold">{item.stockLevel?.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); onShowHistory(item); }}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInventory.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No items found</p>
          </div>
        )}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredInventory.length}</span> of {inventory.length} items
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Events View ---
const EventsView = ({ events, onAdd, onEdit, onBulkImport, settings, isAdmin }: {
  events: any[],
  onAdd: () => void,
  onEdit: (event: any) => void,
  onBulkImport: () => void,
  settings: any,
  isAdmin: boolean
}) => {
  const totalDistributed = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);

  const nextEvent = events
    .filter(e => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return d >= new Date();
    })
    .sort((a, b) => {
      const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      const db = b.date?.toDate ? b.date.toDate() : new Date(b.date);
      return da.getTime() - db.getTime();
    })[0];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return <span className="badge badge-secondary">Scheduled</span>;
      case 'Stock Alert':
        return <span className="badge badge-warning">Stock Alert</span>;
      case 'Completed':
        return <span className="badge">Completed</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Events</h1>
          <p className="text-gray-500 text-sm mt-1">Manage distribution events</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button onClick={onBulkImport} className="btn btn-outline btn-sm">
              <Upload className="w-4 h-4" /> Bulk Import
            </button>
          )}
          <button onClick={() => exportToCSV(events, 'events')} className="btn btn-outline btn-sm">
            <Download className="w-4 h-4" /> Export
          </button>
          {isAdmin && (
            <button onClick={onAdd} className="btn btn-primary btn-sm">
              <PlusCircle className="w-4 h-4" /> New Event
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <Calendar className="w-10 h-10 opacity-20" />
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-primary-100 text-sm mt-4">Total Events</p>
          <p className="text-4xl font-display font-bold">{events.length}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          {nextEvent ? (
            <div onClick={() => onEdit(nextEvent)} className="cursor-pointer">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Next Event</p>
              <p className="font-display font-bold text-gray-900">{nextEvent.name}</p>
              <p className="text-sm text-gray-500 mt-1">{formatDateTime(nextEvent.date, settings?.timezone)}</p>
              <button className="mt-4 text-xs text-primary-600 font-medium hover:text-primary-700">
                View details →
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-between">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Next Event</p>
              <p className="font-display font-semibold text-gray-400">No upcoming events</p>
              {isAdmin && (
                <button onClick={onAdd} className="btn btn-secondary btn-sm mt-4">
                  <Plus className="w-4 h-4" /> Schedule Event
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <Truck className="w-10 h-10 text-gray-200" />
            <div className="w-10 h-10 rounded-xl bg-success-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-4">Total Distributed</p>
          <p className="text-3xl font-display font-bold text-gray-900">{totalDistributed.toLocaleString()}</p>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Materials</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => (
                <tr
                  key={event.id}
                  onClick={() => onEdit(event)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-1.5 h-10 rounded-full",
                        event.status === 'Scheduled' ? 'bg-secondary-500' :
                        event.status === 'Stock Alert' ? 'bg-warning-500' : 'bg-gray-300'
                      )} />
                      <div>
                        <p className="font-medium text-gray-900">{event.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{event.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{formatDate(event.date, settings?.timezone)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{event.location}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono font-semibold">{event.materialsDistributed?.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-center">{getStatusBadge(event.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {events.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No events found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Reports View ---
const ReportsView = ({ inventory, events, auditLogs, settings }: {
  inventory: any[],
  events: any[],
  auditLogs: any[],
  settings: any
}) => {
  const totalDistributions = events.reduce((acc, event) => acc + (event.materialsDistributed || 0), 0);

  const categoryCounts = inventory.reduce((acc: any, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(categoryCounts).map((cat, i) => ({
    name: cat,
    value: Math.round((categoryCounts[cat] / (inventory.length || 1)) * 100) || 0,
    color: i === 0 ? '#2f4a7a' : i === 1 ? '#14b8a6' : i === 2 ? '#f96b5b' : '#9ca3af'
  }));

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap: any = {};
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
      const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
      if (!monthlyMap[monthLabel]) return;

      if (event.categoryStats) {
        const s = event.categoryStats;
        monthlyMap[monthLabel].bibles += (s.bibles || 0);
        monthlyMap[monthLabel].tracts += (s.tracts || 0);
        monthlyMap[monthLabel].booklets += (s.booklets || 0);
      } else {
        monthlyMap[monthLabel].tracts += (event.materialsDistributed || 0);
      }
    } catch (e) {
      console.warn("Skipping malformed event date");
    }
  });

  const lineData = Object.values(monthlyMap);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Distribution analytics and insights</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(inventory, 'report')} className="btn btn-outline btn-sm">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => generateMonthlyReport(inventory, events, auditLogs, settings)} className="btn btn-primary btn-sm">
            <FileText className="w-4 h-4" /> PDF Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Distributions" value={totalDistributions.toLocaleString()} icon={TrendingUp} color="secondary" trend="up" />
        <StatCard title="Active Events" value={events.length} icon={Calendar} color="primary" trend="neutral" />
        <StatCard title="Unique SKUs" value={inventory.length} icon={Package} color="accent" trend="neutral" />
        <StatCard title="Stock Health" value="82%" icon={Activity} color="success" trend="up" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-display font-semibold text-gray-900 mb-6">Distribution Trends</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData}>
                <defs>
                  <linearGradient id="colorBibles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2f4a7a" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2f4a7a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="bibles" stroke="#2f4a7a" strokeWidth={2} fill="url(#colorBibles)" />
                <Line type="monotone" dataKey="tracts" stroke="#14b8a6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="booklets" stroke="#f96b5b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary-600" /><span className="text-xs text-gray-500">Bibles</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-secondary-500" /><span className="text-xs text-gray-500">Tracts</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-accent-500" /><span className="text-xs text-gray-500">Booklets</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-display font-semibold text-gray-900 mb-6">Category Breakdown</h2>
          <div className="flex justify-center">
            <div className="relative w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-display font-bold text-gray-900">100%</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 mt-6">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <span className="font-mono text-sm font-semibold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Settings View ---
const SettingsView = ({ settings, isAdmin }: { settings: any, isAdmin: boolean }) => {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    orgName: '',
    taxId: '',
    timezone: 'UTC',
    warningThreshold: 250,
    criticalThreshold: 75,
    categories: [] as string[]
  });

  const timezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];

  useEffect(() => {
    if (settings) {
      setFormData({
        orgName: settings.orgName || '',
        taxId: settings.taxId || '',
        timezone: settings.timezone || 'UTC',
        warningThreshold: settings.warningThreshold || 250,
        criticalThreshold: settings.criticalThreshold || 75,
        categories: settings.categories || ['Bibles', 'Tracts', 'Booklets']
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await updateSettings(formData);
    } catch (error) {
      console.error("Failed to save settings", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure your inventory system</p>
        </div>
        {isAdmin && (
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Organization */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="font-display font-semibold text-gray-900">Organization</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Organization Name</label>
              <input type="text" disabled={!isAdmin} value={formData.orgName} onChange={e => setFormData({...formData, orgName: e.target.value})} className="input" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Tax ID</label>
              <input type="text" disabled={!isAdmin} value={formData.taxId} onChange={e => setFormData({...formData, taxId: e.target.value})} className="input" />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-secondary-600" />
            </div>
            <h2 className="font-display font-semibold text-gray-900">Categories</h2>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {formData.categories.map((cat, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{cat}</span>
                  {isAdmin && (
                    <button onClick={() => setFormData({...formData, categories: formData.categories.filter((_, idx) => idx !== i)})} className="text-gray-400 hover:text-danger-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <input
                type="text"
                placeholder="Add category..."
                className="input"
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
            )}
          </div>
        </div>

        {/* System */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-accent-600" />
            </div>
            <h2 className="font-display font-semibold text-gray-900">System</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">Timezone</label>
              <select disabled={!isAdmin} value={formData.timezone} onChange={e => setFormData({...formData, timezone: e.target.value})} className="input">
                {timezones.map(tz => <option key={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="md:col-span-2 lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-warning-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-900">Stock Thresholds</h2>
              <p className="text-sm text-gray-400">Configure alert triggers</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-3">Low Stock Warning</label>
              <div className="flex items-center gap-3">
                <input type="number" value={formData.warningThreshold} onChange={e => setFormData({...formData, warningThreshold: parseInt(e.target.value) || 0})} className="input font-mono text-lg font-semibold w-28" />
                <span className="text-gray-500">units</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Items below this quantity show a "Low" status.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-3">Critical Stock Level</label>
              <div className="flex items-center gap-3">
                <input type="number" value={formData.criticalThreshold} onChange={e => setFormData({...formData, criticalThreshold: parseInt(e.target.value) || 0})} className="input font-mono text-lg font-semibold w-28" />
                <span className="text-gray-500">units</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Items below this quantity show "Out" status.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Users View ---
const UsersView = ({ users }: { users: any[] }) => {
  const { updateUserRole, currentUserProfile, authorizedEmails } = useFirebase();
  const isAdmin = currentUserProfile?.role === 'admin';
  const [newEmail, setNewEmail] = useState('');

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !isAdmin) return;
    try {
      const { authorizeEmail } = await import('./services/firestoreService');
      await authorizeEmail(newEmail.toLowerCase().trim());
      setNewEmail('');
    } catch (error) {
      console.error("Failed to authorize email", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Users</h1>
        <p className="text-gray-500 text-sm mt-1">Manage user access and roles</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-display font-semibold text-gray-900">System Users</h2>
            <span className="badge badge-primary">{users.length} users</span>
          </div>
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={user.photoURL || `https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=80`} alt={user.displayName} className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="font-medium text-gray-900">{user.displayName || 'User'}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </div>
                </div>
                <select
                  disabled={!isAdmin || user.id === currentUserProfile?.id}
                  value={user.role}
                  onChange={(e) => updateUserRole(user.id, e.target.value as 'admin' | 'user' | 'guest')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase border-0",
                    user.role === 'admin' ? 'bg-primary-100 text-primary-700' :
                    user.role === 'user' ? 'bg-secondary-100 text-secondary-700' :
                    'bg-gray-100 text-gray-600'
                  )}
                >
                  <option value="guest">Guest</option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-display font-semibold text-gray-900 mb-4">Authorize Email</h3>
            <form onSubmit={handleAuthorize} className="space-y-3">
              <input type="email" placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input" />
              <button type="submit" className="btn btn-primary w-full">Add to Allowlist</button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-display font-semibold text-gray-900 mb-4">Authorized Emails</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {authorizedEmails.sort().map(email => (
                <div key={email} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-mono text-gray-600">{email}</span>
                  <button onClick={() => import('./services/firestoreService').then(({ removeAuthorizedEmail }) => removeAuthorizedEmail(email))} className="text-gray-400 hover:text-danger-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Logs View ---
const LogsView = ({ logs, settings }: { logs: any[], settings: any }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details?.toLowerCase().includes(searchTerm.toLowerCase()) || log.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const actions = ['ALL', ...new Set(logs.map(l => l.action))];
  const getActionBadge = (action: string) => {
    if (action.includes('CREATED')) return <span className="badge badge-success">{action.replace('_', ' ')}</span>;
    if (action.includes('DELETED')) return <span className="badge badge-danger">{action.replace('_', ' ')}</span>;
    return <span className="badge">{action.replace('_', ' ')}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 tracking-tight">Activity Log</h1>
          <p className="text-gray-500 text-sm mt-1">System audit trail</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input pl-10 w-full sm:w-56" />
          </div>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="input w-auto">
            {actions.map(action => <option key={action} value={action}>{action === 'ALL' ? 'All Actions' : action.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-600">{formatTime(log.timestamp, settings?.timezone)}</span>
                    <p className="text-xs text-gray-400">{formatDate(log.timestamp, settings?.timezone)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{log.userName}</p>
                    <p className="text-xs text-gray-400">{log.userEmail}</p>
                  </td>
                  <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="px-6 py-12 text-center">
            <History className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No activity found</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Login View ---
const LoginView = () => {
  const { login } = useFirebase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary-500/25">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-gray-900 mt-6">LitTrack</h1>
            <p className="text-gray-500 text-sm mt-2">Literature Inventory Management</p>
          </div>

          <button onClick={login} className="btn btn-primary btn-lg w-full">
            <LogIn className="w-5 h-5" /> Sign in with Google
          </button>

          <p className="text-center text-xs text-gray-400 mt-8">
            Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
};

// --- Pending Access View ---
const PendingAccessView = ({ isAuthorized }: { isAuthorized: boolean }) => {
  const { logout, user } = useFirebase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-warning-400 to-warning-500" />

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-warning-100 rounded-2xl flex items-center justify-center mx-auto">
              {isAuthorized ? <Clock3 className="w-8 h-8 text-warning-600" /> : <ShieldAlert className="w-8 h-8 text-warning-600" />}
            </div>
          </div>

          <h1 className="font-display font-bold text-2xl text-gray-900 text-center mb-2">
            {isAuthorized ? 'Access Pending' : 'Access Denied'}
          </h1>
          <p className="text-gray-500 text-center">Hello, {user?.displayName}.</p>
          <p className="text-gray-400 text-sm text-center mt-3 leading-relaxed">
            {isAuthorized
              ? "Your account is awaiting administrator approval."
              : "Your email is not authorized for this system."}
          </p>

          <div className="mt-6 p-4 bg-warning-50 rounded-xl border border-warning-100 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" />
            <p className="text-xs text-warning-700 leading-relaxed">
              {isAuthorized
                ? "Please contact your administrator to approve your account."
                : "Access is restricted to invited personnel only."}
            </p>
          </div>

          <button onClick={logout} className="btn btn-outline btn-lg w-full mt-6">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  const isAdmin = currentUserProfile?.role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginView />;

  if (currentUserProfile?.role === 'guest' || !isAuthorized) return <PendingAccessView isAuthorized={isAuthorized} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onDistribute={() => setIsDistributionOpen(true)} isAdmin={isAdmin} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Topbar searchQuery={globalSearch} setSearchQuery={setGlobalSearch} onScan={() => setIsScannerOpen(true)} onMenuClick={() => setIsSidebarOpen(true)} />

      <main className="lg:ml-64 pt-20 lg:pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-auto transition-all duration-300">
        <div className="max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {activeTab === 'dashboard' && <DashboardView inventory={inventory} events={events} onEdit={(item) => { setSelectedItem(item); setIsModalOpen(true); }} auditLogs={auditLogs} setActiveTab={setActiveTab} isAdmin={isAdmin} settings={settings} />}
              {activeTab === 'inventory' && <InventoryView inventory={inventory} onAdd={() => { setSelectedItem(null); setIsModalOpen(true); }} onEdit={(item) => { setSelectedItem(item); setIsModalOpen(true); }} onShowHistory={(item) => { setSelectedHistoryItem(item); setIsHistoryOpen(true); }} onBulkImport={() => { setBulkImportInitialType('inventory'); setIsBulkImportOpen(true); }} globalSearch={globalSearch} isAdmin={isAdmin} />}
              {activeTab === 'reports' && <ReportsView inventory={inventory} events={events} auditLogs={auditLogs} settings={settings} />}
              {activeTab === 'events' && <EventsView events={events} onAdd={() => { setSelectedEvent(null); setIsEventModalOpen(true); }} onEdit={(event) => { setSelectedEvent(event); setIsEventModalOpen(true); }} onBulkImport={() => { setBulkImportInitialType('events'); setIsBulkImportOpen(true); }} settings={settings} isAdmin={isAdmin} />}
              {activeTab === 'users' && <UsersView users={users} />}
              {activeTab === 'logs' && <LogsView logs={auditLogs} settings={settings} />}
              {activeTab === 'settings' && <SettingsView settings={settings} isAdmin={isAdmin} />}
            </motion.div>
          </AnimatePresence>

          <InventoryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} item={selectedItem} settings={settings} isAdmin={isAdmin} />
          <EventModal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} event={selectedEvent} settings={settings} isAdmin={isAdmin} inventory={inventory} />
          <DistributionModal isOpen={isDistributionOpen} onClose={() => setIsDistributionOpen(false)} events={events} inventory={inventory} settings={settings} />
          <BulkImportModal isOpen={isBulkImportOpen} onClose={() => setIsBulkImportOpen(false)} initialType={bulkImportInitialType} isAdmin={isAdmin} />
          <QRScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={(text) => { const item = inventory.find(i => i.sku === text || i.id === text); if (item) { setSelectedItem(item); setIsModalOpen(true); } else { alert(`No item found: ${text}`); }}} />
          <StockHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} item={selectedHistoryItem} settings={settings} />

          <footer className="mt-12 flex items-center justify-between pt-8 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500">System operational</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">LitTrack Inventory System</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
