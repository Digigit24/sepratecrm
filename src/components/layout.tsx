//  components/layout.tsx
import React, { useState } from 'react';
import Sidebar from './ui/sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen">
      <Sidebar 
        collapsed={isSidebarCollapsed} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      <main className="flex-1 overflow-auto bg-gray-100">
        {children}
      </main>
    </div>
  );
};