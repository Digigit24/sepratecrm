import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Icon3DProps {
  icon: LucideIcon;
  className?: string;
  colors?: [string, string];
}

const iconColors: Record<string, [string, string]> = {
  LayoutDashboard: ['#60a5fa', '#9333ea'], // blue to purple
  MessageCircle: ['#4ade80', '#10b981'], // green to emerald
  Building2: ['#fb923c', '#dc2626'], // orange to red
  Stethoscope: ['#22d3ee', '#3b82f6'], // cyan to blue
  IndianRupee: ['#facc15', '#f97316'], // yellow to orange
  Shield: ['#a855f7', '#ec4899'], // purple to pink
  Users: ['#2dd4bf', '#06b6d4'], // teal to cyan
  Calendar: ['#818cf8', '#a855f7'], // indigo to purple
  Activity: ['#f472b6', '#fb7185'], // pink to rose
  Kanban: ['#8b5cf6', '#a855f7'], // violet to purple
  FileText: ['#38bdf8', '#3b82f6'], // sky to blue
  Send: ['#34d399', '#10b981'], // emerald to green
  CheckSquare: ['#a3e635', '#22c55e'], // lime to green
  Award: ['#fbbf24', '#eab308'], // amber to yellow
  User: ['#60a5fa', '#6366f1'], // blue to indigo
  ClipboardPlus: ['#22d3ee', '#14b8a6'], // cyan to teal
  Microscope: ['#a855f7', '#6366f1'], // purple to indigo
  Package: ['#fb923c', '#f59e0b'], // orange to amber
  Receipt: ['#fb7185', '#f472b6'], // rose to pink
  Settings2: ['#94a3b8', '#4b5563'], // slate to gray
  UserCog: ['#8b5cf6', '#a855f7'], // violet to purple
  ShieldCheck: ['#4ade80', '#14b8a6'], // green to teal
  Bug: ['#ef4444', '#fb7185'], // red to rose
  CreditCard: ['#3b82f6', '#06b6d4'], // blue to cyan
  TrendingUp: ['#22c55e', '#10b981'], // green to emerald
  Workflow: ['#6366f1', '#3b82f6'], // indigo to blue
  QrCode: ['#a855f7', '#8b5cf6'], // purple to violet
  UserPlus: ['#14b8a6', '#06b6d4'], // teal to cyan
  UserCheck: ['#10b981', '#22c55e'], // emerald to green
  ClipboardList: ['#3b82f6', '#0ea5e9'], // blue to sky
  ChevronDown: ['#94a3b8', '#64748b'], // slate colors
  ChevronRight: ['#94a3b8', '#64748b'], // slate colors
  Menu: ['#94a3b8', '#64748b'], // slate colors
  X: ['#ef4444', '#dc2626'], // red colors
};

export function Icon3D({ icon: Icon, className = '', colors }: Icon3DProps) {
  const iconName = Icon.displayName || Icon.name || '';
  const [color1, color2] = colors || iconColors[iconName] || ['#60a5fa', '#9333ea'];
  const gradientId = `gradient-${iconName}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: color1, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: color2, stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>

      <Icon
        className={className}
        style={{
          stroke: `url(#${gradientId})`,
          fill: 'none',
          strokeWidth: 2,
        }}
      />
    </div>
  );
}
