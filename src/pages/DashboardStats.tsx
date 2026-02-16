// src/pages/DashboardStats.tsx
import React from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { CircularProgress } from '@/components/dashboard/CircularProgress';
import { BarChart } from '@/components/dashboard/BarChart';
import {
  WorkingIllustration,
  GoalIllustration,
  MoneyIllustration,
  ChartUpIllustration,
  CalendarIllustration,
} from '@/components/dashboard/DashboardIllustrations';

export const DashboardStats: React.FC = () => {
  // Sample data
  const revenueData = [
    { name: 'Jan', value1: 4000, value2: 2400 },
    { name: 'Feb', value1: 3000, value2: 1398 },
    { name: 'Mar', value1: 2000, value2: 9800 },
    { name: 'Apr', value1: 2780, value2: 3908 },
    { name: 'May', value1: 1890, value2: 4800 },
    { name: 'Jun', value1: 2390, value2: 3800 },
    { name: 'Jul', value1: 3490, value2: 4300 },
    { name: 'Aug', value1: 4200, value2: 5100 },
  ];

  const earningsData = [
    { name: 'Mon', value: 3200 },
    { name: 'Tue', value: 4500 },
    { name: 'Wed', value: 3800 },
    { name: 'Thu', value: 5200 },
    { name: 'Fri', value: 4800 },
    { name: 'Sat', value: 3900 },
    { name: 'Sun', value: 4200 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Statistics</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your business performance
        </p>
      </div>

      {/* Asymmetric Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Welcome Card - Spans 8 columns on large screens */}
        <div className="lg:col-span-8">
          <StatCard
            title="Welcome back Natalia!"
            subtitle="Check dashboard"
            value="$62,489.50"
            previousValue="You have earned 25% more than last month which is great"
            illustration={<WorkingIllustration className="w-40 h-40" />}
            action={{
              label: 'Check',
              onClick: () => console.log('Check clicked'),
            }}
            className="h-full"
          />
        </div>

        {/* Product Goal - Spans 4 columns on large screens */}
        <div className="lg:col-span-4">
          <StatCard
            title="Product Goal"
            value="3267"
            variant="gradient"
            illustration={<GoalIllustration className="w-20 h-20" />}
            className="h-full"
          />
        </div>

        {/* Revenue Chart - Spans 8 columns */}
        <div className="lg:col-span-8">
          <RevenueChart
            title="Revenue Updates"
            data={revenueData}
            dataKey1="Moderate"
            dataKey2="Vegan dishes"
            variant="area"
          />
        </div>

        {/* Circular Progress - Spans 4 columns */}
        <div className="lg:col-span-4">
          <CircularProgress
            title="Yearly Updates"
            value={500458}
            label="$500,458"
            sublabel="Overview of Profit"
            color="#10B981"
          />
        </div>

        {/* Total Earnings Card - Spans 4 columns */}
        <div className="lg:col-span-4">
          <StatCard
            title="Total Earnings"
            value="$678,298"
            trend={{
              value: 9,
              isPositive: true,
            }}
            illustration={<MoneyIllustration />}
          />
        </div>

        {/* Weekly Earnings Bar Chart - Spans 5 columns */}
        <div className="lg:col-span-5">
          <BarChart
            title="Weekly Earnings"
            data={earningsData}
            color="#3b82f6"
          />
        </div>

        {/* Monthly Stats - Spans 3 columns */}
        <div className="lg:col-span-3">
          <StatCard
            title="Monthly Sales"
            value="24,567"
            trend={{
              value: 12,
              isPositive: true,
            }}
            illustration={<ChartUpIllustration />}
            variant="outlined"
          />
        </div>

        {/* Additional Stats Row */}
        <div className="lg:col-span-3">
          <StatCard
            title="Active Users"
            value="8,549"
            trend={{
              value: 5,
              isPositive: true,
            }}
            previousValue="vs last month"
          />
        </div>

        <div className="lg:col-span-3">
          <StatCard
            title="Pending Orders"
            value="156"
            trend={{
              value: 3,
              isPositive: false,
            }}
            previousValue="vs last week"
            illustration={<CalendarIllustration className="w-12 h-12" />}
          />
        </div>

        <div className="lg:col-span-3">
          <StatCard
            title="Conversion Rate"
            value="3.48%"
            trend={{
              value: 2,
              isPositive: true,
            }}
            previousValue="vs last month"
          />
        </div>

        <div className="lg:col-span-3">
          <StatCard
            title="Customer Satisfaction"
            value="98.5%"
            trend={{
              value: 1.5,
              isPositive: true,
            }}
            previousValue="Based on reviews"
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
