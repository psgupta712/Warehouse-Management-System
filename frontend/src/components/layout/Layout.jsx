import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Search } from 'lucide-react';

const routeTitles = {
  '/': 'Dashboard',
  '/warehouses': 'Warehouses',
  '/products': 'Products',
  '/inventory': 'Inventory',
  '/suppliers': 'Suppliers',
  '/shipments': 'Shipments',
  '/reports': 'Reports',
};

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = routeTitles[location.pathname] || 'WareFlow';

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-14 bg-slate-950/80 backdrop-blur border-b border-slate-800 flex items-center gap-4 px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-base font-semibold text-white font-['Space_Grotesk']">{title}</h1>
          <div className="flex-1" />
          <div className="text-xs text-slate-500 hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
