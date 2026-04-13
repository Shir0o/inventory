/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Filter,
  ArrowRight,
  History,
  Shield,
  BellRing,
  RefreshCw,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

// --- Types ---

type Tab = 'dashboard' | 'inventory' | 'events' | 'reports' | 'settings';

// --- Mock Data ---

const lineData = [
  { name: 'Jan', bibles: 250, tracts: 180 },
  { name: 'Feb', bibles: 220, tracts: 200 },
  { name: 'Mar', bibles: 240, tracts: 150 },
  { name: 'Apr', bibles: 180, tracts: 160 },
  { name: 'May', bibles: 200, tracts: 120 },
  { name: 'Jun', bibles: 120, tracts: 130 },
  { name: 'Jul', bibles: 140, tracts: 90 },
  { name: 'Aug', bibles: 100, tracts: 110 },
  { name: 'Sep', bibles: 110, tracts: 70 },
];

const pieData = [
  { name: 'Hardcover Bibles', value: 45, color: '#0A2540' },
  { name: 'Evangelistic Tracts', value: 30, color: '#00D4B6' },
  { name: 'Study Guides', value: 25, color: '#FF7369' },
];

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: Tab, setActiveTab: (t: Tab) => void }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-primary flex flex-col z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-secondary flex items-center justify-center rounded-sharp">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-mono font-bold text-lg tracking-tighter text-white">LIT-LEDGER</div>
            <div className="font-headline font-medium text-[10px] text-slate-400 tracking-widest uppercase opacity-60">v1.0.42-STABLE</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 mt-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
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

      <div className="p-6 mt-auto">
        <button className="w-full bg-secondary text-primary font-headline font-bold text-xs py-3 rounded-sharp flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <PlusCircle className="w-4 h-4" />
          QUICK ENTRY
        </button>
      </div>
    </aside>
  );
};

const Topbar = () => {
  return (
    <header className="fixed top-0 right-0 h-16 left-60 bg-surface border-b border-outline-variant flex items-center justify-between px-8 z-40">
      <div className="flex items-center gap-8 flex-1">
        <div className="relative group w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="SEARCH SYSTEM..." 
            className="w-full pl-10 pr-4 py-1.5 bg-surface-container border-none text-[12px] font-mono tracking-tight focus:ring-1 focus:ring-primary rounded-sharp"
          />
        </div>
        <div className="flex items-center gap-6">
          {['Bibles', 'Tracts', 'Study Guides'].map((link) => (
            <a key={link} href="#" className="text-slate-500 hover:text-primary font-headline font-bold text-[11px] uppercase tracking-[1px] transition-all">
              {link}
            </a>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-slate-500 hover:text-primary transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="p-2 text-slate-500 hover:text-primary transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-outline-variant">
          <div className="text-right hidden sm:block">
            <div className="text-[12px] font-bold text-primary">Admin User</div>
            <div className="text-[10px] text-slate-400">Inventory Lead</div>
          </div>
          <div className="h-8 w-8 bg-slate-200 rounded-sharp overflow-hidden border border-outline-variant">
            <img 
              src="https://picsum.photos/seed/admin/100/100" 
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

const DashboardView = () => (
  <div className="space-y-8">
    <div>
      <h1 className="font-headline font-extrabold text-3xl text-primary tracking-tight mb-1">Inventory Dashboard</h1>
      <p className="text-on-surface-variant font-medium text-sm">
        System status: <span className="text-secondary font-mono">OPERATIONAL</span> • Last sync: 08:42 AM
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
          <div className="font-mono text-4xl font-bold text-primary">12,842</div>
          <div className="flex items-center gap-1 text-[11px] text-secondary font-bold mt-1">
            <TrendingUp className="w-3 h-3" />
            +2.4% FROM LAST MONTH
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
          <div className="font-mono text-4xl font-bold text-tertiary">14</div>
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
          <div className="font-mono text-4xl font-bold text-primary">3,120</div>
          <div className="text-[11px] text-on-surface-variant font-bold mt-1 uppercase">
            Active distribution channels: 08
          </div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="ledger-card">
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">Action Required: Low Stock Items</h2>
            <span className="text-[11px] font-mono font-bold text-tertiary px-2 py-0.5 border border-tertiary/30 bg-tertiary/5">PRIORITY: HIGH</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container/50 text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3 font-headline text-[11px] font-bold uppercase tracking-wider">Item ID</th>
                  <th className="px-6 py-3 font-headline text-[11px] font-bold uppercase tracking-wider">Resource Name</th>
                  <th className="px-6 py-3 font-headline text-[11px] font-bold uppercase tracking-wider">Current</th>
                  <th className="px-6 py-3 font-headline text-[11px] font-bold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {[
                  { id: '#BT-0091', name: 'ESV Study Bible - Hardcover', current: '04', threshold: 25 },
                  { id: '#TR-5520', name: 'Step to Christ (Tract Series)', current: '112', threshold: 500 },
                  { id: '#SG-0211', name: 'Foundation of Faith Guide', current: '12', threshold: 50 },
                ].map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold">{item.id}</td>
                    <td className="px-6 py-4 text-sm font-medium">{item.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-tertiary font-bold">{item.current}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="bg-primary text-white px-3 py-1 text-[11px] font-bold rounded-sharp hover:bg-primary-container transition-all">REORDER</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-surface-container text-center">
            <button className="text-xs font-bold text-primary hover:underline">VIEW ALL 14 ALERTS</button>
          </div>
        </div>

        <div className="ledger-card h-[320px] relative">
          <div className="absolute top-0 left-0 w-full z-10 px-6 py-4 bg-gradient-to-b from-white/90 to-transparent">
            <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">Regional Distribution Hubs</h2>
          </div>
          <img 
            src="https://picsum.photos/seed/map/1200/600?grayscale&blur=2" 
            alt="Map" 
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-6 right-6">
            <div className="bg-primary text-white p-3 rounded-sharp flex items-center gap-3 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-[11px] font-mono font-bold">CENTRAL HUB: ACTIVE</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="ledger-card flex flex-col h-full">
          <div className="px-6 py-4 border-b border-outline-variant bg-surface-container">
            <h2 className="font-headline font-bold text-sm uppercase tracking-wider text-primary">System Log</h2>
          </div>
          <div className="p-6 flex-1">
            <div className="space-y-8 relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-outline-variant" />
              {[
                { time: '10:24 AM', type: 'INVENTORY IN', msg: '500 units of "The Great Controversy" received.', icon: Package, color: 'bg-primary-container text-white' },
                { time: '09:15 AM', type: 'THRESHOLD ALERT', msg: 'Stock level for #SG-0211 dropped below critical margin.', icon: AlertTriangle, color: 'bg-tertiary/10 text-tertiary' },
                { time: '08:00 AM', type: 'SHIPMENT OUT', msg: 'Batch #442 dispatched to North Regional Center.', icon: Truck, color: 'bg-secondary/10 text-primary' },
                { time: '07:45 AM', type: 'USER AUTH', msg: 'User "David Miller" logged into the system.', icon: Shield, color: 'bg-slate-100 text-slate-500' },
              ].map((item, i) => (
                <div key={i} className="relative pl-10">
                  <div className={cn("absolute left-0 top-0 w-6 h-6 flex items-center justify-center rounded-full z-10", item.color)}>
                    <item.icon className="w-3 h-3" />
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-mono mb-1">{item.time} • {item.type}</div>
                  <p className="text-sm font-medium text-primary leading-tight">{item.msg}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-container text-center">
            <button className="text-xs font-bold text-secondary flex items-center justify-center gap-2 w-full hover:text-primary transition-all">
              VIEW FULL AUDIT TRAIL
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const InventoryView = () => (
  <div className="space-y-8">
    <div className="flex justify-between items-end">
      <div>
        <span className="font-mono text-[11px] text-secondary bg-primary px-2 py-0.5 rounded-sharp mb-2 inline-block">INV-MTX-PRIME</span>
        <h2 className="text-[32px] font-headline font-bold text-primary tracking-tight leading-none">Inventory Matrix</h2>
        <p className="text-on-surface-variant text-sm mt-2">Real-time status tracking and asset management for global distribution.</p>
      </div>
      <div className="flex gap-2">
        <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant bg-surface text-[13px] font-medium text-on-surface hover:bg-surface-container transition-colors rounded-sharp">
          <Filter className="w-4 h-4" />
          Advanced Filters
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-[13px] font-bold active:scale-95 transition-all rounded-sharp">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
    </div>

    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-3 ledger-card p-5">
        <div className="indicator-secondary" />
        <p className="text-[11px] font-headline font-bold text-on-surface-variant uppercase tracking-wider">Total Units</p>
        <p className="text-3xl font-mono font-bold text-primary mt-1">14,202</p>
        <div className="flex items-center gap-1 mt-2 text-[11px] text-secondary">
          <TrendingUp className="w-3 h-3" />
          <span>+12% vs last month</span>
        </div>
      </div>
      <div className="col-span-12 md:col-span-3 ledger-card p-5">
        <div className="indicator-tertiary" />
        <p className="text-[11px] font-headline font-bold text-on-surface-variant uppercase tracking-wider">Low Stock Items</p>
        <p className="text-3xl font-mono font-bold text-primary mt-1">18</p>
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
              <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">Stock Level</th>
              <th className="px-6 py-4 font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {[
              { sku: 'B-ES-992', title: 'Study Bible (Hardcover)', sub: 'Reina Valera 1960', cat: 'Bibles', lang: 'Spanish', stock: '2,410', status: 'Healthy', color: 'bg-secondary' },
              { sku: 'T-EN-012', title: 'Steps to Freedom', sub: 'Evangelistic Tract Series', cat: 'Tracts', lang: 'English', stock: '124', status: 'Low', color: 'bg-tertiary' },
              { sku: 'S-FR-441', title: 'Doctrine of Hope', sub: 'Advanced Study Series', cat: 'Study Guides', lang: 'French', stock: '0', status: 'Out', color: 'bg-slate-300' },
              { sku: 'B-KO-721', title: 'Korean Outreach Bible', sub: 'Standard Edition', cat: 'Bibles', lang: 'Korean', stock: '892', status: 'Healthy', color: 'bg-secondary' },
              { sku: 'T-PT-505', title: 'Morning Prayer Cards', sub: 'Portuguese Edition', cat: 'Tracts', lang: 'Portuguese', stock: '5,100', status: 'Healthy', color: 'bg-secondary' },
            ].map((row) => (
              <tr key={row.sku} className="hover:bg-surface-container transition-colors">
                <td className="px-6 py-4 font-mono text-[12px] text-primary">{row.sku}</td>
                <td className="px-6 py-4">
                  <div className="font-bold text-[13px] text-primary">{row.title}</div>
                  <div className="text-[11px] text-on-surface-variant">{row.sub}</div>
                </td>
                <td className="px-6 py-4 text-[12px] text-on-surface">{row.cat}</td>
                <td className="px-6 py-4 text-[12px] text-on-surface">{row.lang}</td>
                <td className="px-6 py-4 font-mono text-[13px]">{row.stock}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", row.color)} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface">{row.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-primary">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center px-6 py-4 bg-surface-container border-t border-outline-variant">
        <div className="text-[11px] text-on-surface-variant font-medium">
          Showing <span className="font-bold text-primary">1-5</span> of <span className="font-bold text-primary">42</span> entries
        </div>
        <div className="flex gap-1">
          <button className="px-3 py-1 border border-outline-variant bg-surface text-[11px] font-bold text-on-surface-variant opacity-50 cursor-not-allowed rounded-sharp">Previous</button>
          <button className="px-3 py-1 border border-primary bg-primary text-white text-[11px] font-bold rounded-sharp">1</button>
          <button className="px-3 py-1 border border-outline-variant bg-surface text-[11px] font-bold text-on-surface-variant hover:border-primary transition-colors rounded-sharp">2</button>
          <button className="px-3 py-1 border border-outline-variant bg-surface text-[11px] font-bold text-on-surface-variant hover:border-primary transition-colors rounded-sharp">Next</button>
        </div>
      </div>
    </div>
  </div>
);

const ReportsView = () => (
  <div className="space-y-8">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        <h2 className="font-headline text-3xl font-bold tracking-tight text-primary">Distribution Reports</h2>
        <p className="text-on-surface-variant text-[14px] mt-1">Analyzing literature outflow and community impact metrics.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-surface border border-outline-variant p-1 rounded-sharp">
          <button className="px-3 py-1.5 text-[12px] font-headline font-bold uppercase tracking-wider text-primary border-r border-outline-variant">Last 30 Days</button>
          <button className="px-3 py-1.5 text-[12px] font-headline font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary">Q3 2023</button>
          <button className="px-2 py-1.5 text-on-surface-variant"><Calendar className="w-4 h-4" /></button>
        </div>
        <button className="bg-primary text-white px-4 py-2 rounded-sharp font-headline font-bold text-[12px] uppercase tracking-wider flex items-center gap-2 hover:bg-primary-container transition-all">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[
        { label: 'Total Distributions', val: '12,842', trend: '+14.2% vs prev. month', color: 'indicator-secondary', trendColor: 'text-secondary', icon: TrendingUp },
        { label: 'Active Regions', val: '08', trend: 'Stabilized distribution flow', color: 'indicator-tertiary', trendColor: 'text-on-surface-variant', icon: null },
        { label: 'Inventory Velocity', val: '82%', trend: '-2.4% below target', color: 'indicator-primary', trendColor: 'text-tertiary', icon: TrendingDown },
        { label: 'Unique Recipients', val: '4,192', trend: 'Projected +500 for Q4', color: 'bg-slate-400', trendColor: 'text-on-surface-variant', icon: null },
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
              <div className="w-3 h-3 bg-secondary rounded-full" />
              <span className="text-[11px] font-headline uppercase font-bold text-on-surface-variant">Bibles</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-tertiary rounded-full" />
              <span className="text-[11px] font-headline uppercase font-bold text-on-surface-variant">Tracts</span>
            </div>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={lineData}>
              <defs>
                <linearGradient id="colorBibles" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4B6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#00D4B6" stopOpacity={0}/>
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
              <Area type="monotone" dataKey="bibles" stroke="#00D4B6" strokeWidth={3} fillOpacity={1} fill="url(#colorBibles)" />
              <Line type="monotone" dataKey="tracts" stroke="#FF7369" strokeWidth={3} strokeDasharray="8 4" dot={false} />
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
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl text-primary font-bold">100%</span>
            <span className="text-[9px] font-headline font-bold text-on-surface-variant uppercase tracking-widest">Audited</span>
          </div>
        </div>
        <div className="w-full mt-10 space-y-3">
          {pieData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sharp" style={{ backgroundColor: item.color }} />
                <span className="text-on-surface">{item.name}</span>
              </div>
              <span className="font-mono font-bold">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const EventsView = () => (
  <div className="space-y-8">
    <div className="flex justify-between items-end">
      <div>
        <span className="font-headline font-bold text-[12px] uppercase tracking-[2px] text-on-surface-variant">Management Ledger</span>
        <h1 className="font-headline font-extrabold text-[32px] text-primary tracking-tight leading-none mt-1">Events Manager</h1>
      </div>
      <div className="flex gap-3">
        <button className="px-4 py-2 border border-outline-variant text-primary font-headline font-bold text-[13px] uppercase tracking-wider rounded-sharp hover:bg-surface-container transition-colors">
          Export CSV
        </button>
        <button className="px-4 py-2 bg-primary text-white font-headline font-bold text-[13px] uppercase tracking-wider rounded-sharp hover:bg-primary-container transition-colors shadow-sm">
          Create New Event
        </button>
      </div>
    </div>

    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 md:col-span-4 ledger-card p-6 h-40 flex flex-col justify-between">
        <div className="indicator-secondary" />
        <div>
          <span className="font-headline text-[11px] uppercase tracking-[1px] text-on-surface-variant font-bold">Total Active Events</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-[40px] text-primary font-bold leading-none">124</span>
            <span className="text-secondary font-bold text-[13px]">+12%</span>
          </div>
        </div>
        <div className="mt-6 h-[2px] bg-surface-container relative">
          <div className="absolute inset-0 bg-secondary w-3/4" />
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 ledger-card p-6 h-40 flex flex-col justify-between">
        <div className="indicator-primary" />
        <div>
          <span className="font-headline text-[11px] uppercase tracking-[1px] text-on-surface-variant font-bold">Items Distributed (MTD)</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-mono text-[40px] text-primary font-bold leading-none">8,432</span>
          </div>
          <p className="mt-2 text-[12px] text-slate-500 font-medium">Distribution tracking across 8 regions</p>
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
            {[
              { name: 'Regional Meeting - North Sector', id: 'EVT-2024-0082', date: 'Oct 12, 2024', loc: 'Grand Plaza Convention Center', items: '1,250', status: 'Scheduled', color: 'bg-secondary' },
              { name: 'Weekly Bible Study Series', id: 'EVT-2024-0091', date: 'Oct 14, 2024', loc: 'Community Center West', items: '420', status: 'Stock Alert', color: 'bg-tertiary' },
              { name: 'Youth Outreach Program', id: 'EVT-2024-0103', date: 'Oct 15, 2024', loc: 'Campus Auditorium', items: '2,100', status: 'Drafting', color: 'bg-slate-200' },
              { name: 'Theological Seminary Workshop', id: 'EVT-2024-0105', date: 'Oct 18, 2024', loc: 'Online Webinar Portal', items: '85', status: 'Scheduled', color: 'bg-secondary' },
            ].map((row) => (
              <tr key={row.id} className="hover:bg-surface-container transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-8 rounded-full", row.color)} />
                    <div>
                      <p className="font-headline font-bold text-primary text-[14px]">{row.name}</p>
                      <p className="text-[11px] font-mono text-on-surface-variant">{row.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-[13px] text-on-surface">{row.date}</td>
                <td className="px-6 py-4 text-[13px] text-on-surface">{row.loc}</td>
                <td className="px-6 py-4 text-right">
                  <span className="font-mono font-bold text-primary text-[13px]">{row.items} items</span>
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
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const SettingsView = () => (
  <div className="space-y-8">
    <div className="flex items-end justify-between">
      <div>
        <div className="font-mono text-[11px] text-on-surface-variant uppercase tracking-widest mb-1">Configuration Ledger</div>
        <h1 className="font-headline font-bold text-3xl text-primary tracking-tight">System Settings</h1>
      </div>
      <div className="flex gap-3">
        <button className="px-6 py-2 border-2 border-outline-variant text-on-surface font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-surface-container transition-colors rounded-sharp">Reset Defaults</button>
        <button className="px-6 py-2 bg-primary text-white font-headline font-bold text-[12px] uppercase tracking-wider hover:bg-primary-container transition-all rounded-sharp">Save Changes</button>
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
              defaultValue="Literature Ledger Global Operations"
              className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all"
            />
          </div>
          <div className="col-span-2 md:col-span-1 space-y-2">
            <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Tax Identification Number</label>
            <input 
              type="text" 
              defaultValue="TX-9920-441-B"
              className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-mono text-[14px] focus:ring-0 focus:border-primary transition-all"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Principal Business Address</label>
            <textarea 
              rows={3}
              defaultValue="722 Industrial Parkway, Suite 400&#10;New London, CT 06320&#10;United States"
              className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary transition-all resize-none"
            />
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
              <div className="font-mono text-[10px] text-on-surface-variant">UTC-05:00 Eastern Standard</div>
            </div>
            <div className="h-2 w-2 bg-secondary rounded-full animate-pulse" />
          </div>
          <div className="space-y-4">
            <label className="font-headline font-bold text-[11px] text-on-surface-variant uppercase tracking-widest block">Update Frequency</label>
            <select className="w-full border-0 border-b-2 border-surface-container bg-surface-container-low px-4 py-3 font-sans text-[14px] focus:ring-0 focus:border-primary appearance-none">
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
                <span className="font-mono text-2xl font-bold text-primary">250<span className="text-[14px] text-on-surface-variant ml-1 uppercase">units</span></span>
              </div>
              <div className="relative py-4">
                <div className="h-1 w-full bg-surface-container rounded-full" />
                <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-primary" style={{ width: '45%' }} />
                <div className="absolute top-1/2 -translate-y-1/2 left-[45%] h-5 w-1 bg-primary border-x-4 border-white" />
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">Triggers a yellow visual indicator on dashboard widgets and sends a non-urgent notification to logistics leads.</p>
            </div>
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="font-headline font-bold text-[12px] text-tertiary uppercase">Critical Threshold (Red)</label>
                <span className="font-mono text-2xl font-bold text-tertiary">75<span className="text-[14px] text-on-surface-variant ml-1 uppercase">units</span></span>
              </div>
              <div className="relative py-4">
                <div className="h-1 w-full bg-surface-container rounded-full" />
                <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-tertiary" style={{ width: '15%' }} />
                <div className="absolute top-1/2 -translate-y-1/2 left-[15%] h-5 w-1 bg-tertiary border-x-4 border-white" />
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">Forces immediate replenishment orders. Prevents checkout of items if stock falls below this floor without supervisor override.</p>
            </div>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Email Alerts', desc: 'Daily summary of low-stock items sent to procurement.', icon: BellRing, active: true },
            { label: 'Auto-Restock', desc: 'Automatically draft POs when items hit critical levels.', icon: Package, active: false },
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

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <Topbar />
      
      <main className="ml-60 pt-24 pb-12 px-12">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'inventory' && <InventoryView />}
              {activeTab === 'reports' && <ReportsView />}
              {activeTab === 'events' && <EventsView />}
              {activeTab === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>

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
