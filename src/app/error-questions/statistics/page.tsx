'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Book,
  CheckCircle2,
  History,
  LineChart as LineChartIcon,
  Loader2,
  LogOut,
  Percent,
  PieChart as PieChartIcon,
  RefreshCw,
  Repeat2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth, getUserDisplayName } from '@/contexts/AuthContext';

interface Statistics {
  basic: {
    totalQuestions: number;
    masteredCount: number;
    toReviewCount: number;
    masteryRate: number;
  };
  typeDistribution: Array<{ type: string; count: number }>;
  topTags: Array<{ tag: string; count: number }>;
  last7DaysTrend: Array<{ date: string; count: number }>;
  reviewSummary?: {
    totalReviewRecords: number;
    totalCorrect: number;
    totalWrong: number;
    cumulativeCorrectRate: number;
  };
  last30DaysReviewTrend?: Array<{
    date: string;
    reviewCount: number;
    correctRate: number;
  }>;
  masteryDistribution?: Array<{
    range: string;
    label: string;
    count: number;
  }>;
  reviewSessionStats?: {
    totalSessions: number;
    completedSessions: number;
    averageQuestionsPerSession: number;
    averageCorrectRate: number;
  };
}

type LoadState = 'loading' | 'ready' | 'error';

const questionTypeMap: Record<string, string> = {
  'spelling': '单词拼写',
  'word-choice': '词义选择',
  'multiple-choice': '多项选择',
  'grammar': '语法填空',
  'translation': '翻译/连词',
  'reading': '阅读理解',
  'custom': '其他',
};

const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
];

function TypeDistributionPieChart({ data }: { data: Array<{ type: string; count: number }> }) {
  const chartData = data.map(item => ({
    name: questionTypeMap[item.type] || item.type,
    value: item.count,
  })).sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-gray-400">
        暂无题型分布数据
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopTagsBarChart({ data }: { data: Array<{ tag: string; count: number }> }) {
  const chartData = [...data].sort((a, b) => b.count - a.count).slice(0, 10);

  if (chartData.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-gray-400">
        暂无标签分布数据
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis
            dataKey="tag"
            type="category"
            width={80}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            barSize={20}
            label={{ position: 'right', fill: '#6b7280', fontSize: 10 }}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Last7DaysTrendLineChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-gray-400">
        暂无趋势数据
      </div>
    );
  }

  // 只取最后 7 天，并确保日期格式简洁（MM-DD）
  const chartData = data.slice(-7).map(item => ({
    ...item,
    formattedDate: item.date.split('-').slice(1).join('-'),
  }));

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
            itemStyle={{ fontSize: '12px', color: '#3b82f6' }}
            formatter={(value) => [`${value} 个`, '新增错题']}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Last30DaysReviewTrendChart({ data }: { data: Array<{ date: string; reviewCount: number; correctRate: number }> }) {
  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-gray-400">
        暂无复习趋势数据
      </div>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    formattedDate: item.date.split('-').slice(1).join('-'),
  }));

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
            itemStyle={{ fontSize: '12px' }}
            formatter={(value, name) => {
              if (name === '正确率') return [`${value}%`, name];
              return [value, name];
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
          />
          <Bar yAxisId="left" dataKey="reviewCount" name="复习次数" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Line yAxisId="right" type="monotone" dataKey="correctRate" name="正确率" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MasteryDistributionBarChart({ data }: { data: Array<{ range: string; label: string; count: number }> }) {
  if (!data || data.length === 0 || data.every(d => d.count === 0)) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-gray-400">
        暂无掌握度分布数据
      </div>
    );
  }

  // 颜色映射：从红色（0-20）到绿色（80-100）
  const getRangeColor = (range: string) => {
    switch (range) {
      case '0-20': return '#ef4444';   // red-500
      case '20-40': return '#f97316';  // orange-500
      case '40-60': return '#f59e0b';  // amber-500
      case '60-80': return '#84cc16';  // lime-500
      case '80-100': return '#10b981'; // emerald-500
      default: return '#3b82f6';
    }
  };

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value) => [`${value} 题`, '错题数量']}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getRangeColor(entry.range)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ReviewSessionCorrectRateTrendChart({ data }: { data: Array<{ date: string; correctRate: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-gray-400">
        暂无正确率变化数据
      </div>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    formattedDate: item.date.split('-').slice(1).join('-'),
  }));

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
            itemStyle={{ fontSize: '12px', color: '#8b5cf6' }}
            formatter={(value) => [`${value}%`, '平均正确率']}
          />
          <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1.5}>
            <span className="text-xs text-green-500 opacity-70">80% 目标线</span>
          </ReferenceLine>
          <Line
            type="monotone"
            dataKey="correctRate"
            stroke="#8b5cf6"
            strokeWidth={3}
            dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={1000}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

async function fetchStatistics() {
  const response = await fetch('/api/error-questions/review/statistics');
  if (!response.ok) {
    throw new Error('Failed to load statistics');
  }

  return response.json() as Promise<Statistics>;
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="border-0 bg-white/80 shadow-md">
            <CardContent className="p-4">
              <div className="mb-4 flex items-start justify-between">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="mb-3 h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="border-0 bg-white/80 shadow-md">
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-60 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            错题统计
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <div className="py-20 text-center">
          <Book className="mx-auto mb-4 size-16 text-gray-300" />
          <h2 className="mb-2 text-xl font-semibold text-gray-700">请先登录</h2>
          <p className="mb-6 text-gray-500">登录后可查看错题统计</p>
          <Button
            onClick={() => (window.location.href = '/api/auth/feishu')}
            className="bg-gradient-to-r from-blue-500 to-purple-500"
          >
            飞书登录
          </Button>
        </div>
      </main>
    </div>
  );
}

export default function ErrorQuestionStatisticsPage() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const loadStatistics = useCallback(async () => {
    if (!user) return;

    try {
      const data = await fetchStatistics();
      setStatistics(data);
      setLoadState('ready');
    } catch (error) {
      console.error('Load error question statistics error:', error);
      setLoadState('error');
    }
  }, [user]);

  const handleRetry = useCallback(() => {
    setLoadState('loading');
    loadStatistics();
  }, [loadStatistics]);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    fetchStatistics()
      .then((data) => {
        if (ignore) return;
        setStatistics(data);
        setLoadState('ready');
      })
      .catch((error) => {
        if (ignore) return;
        console.error('Load error question statistics error:', error);
        setLoadState('error');
      });

    return () => {
      ignore = true;
    };
  }, [user]);

  if (!isAuthLoading && !user) {
    return <LoginPrompt />;
  }

  const totalQuestions = statistics?.basic.totalQuestions ?? 0;
  const totalReviewRecords = statistics?.reviewSummary?.totalReviewRecords ?? 0;
  const toReviewCount = statistics?.basic.toReviewCount ?? 0;
  const masteryRate = statistics?.basic.masteryRate ?? 0;
  const cumulativeCorrectRate = statistics?.reviewSummary?.cumulativeCorrectRate ?? 0;
  const hasData = totalQuestions > 0 || totalReviewRecords > 0;
  
  const overviewCards = statistics ? [
    {
      title: '总错题数',
      value: statistics.basic.totalQuestions,
      helper: '已收录错题',
      badge: '全部',
      icon: Book,
      className: 'text-gray-800',
      iconClassName: 'bg-slate-50 text-slate-600',
    },
    {
      title: '已掌握',
      value: statistics.basic.masteredCount,
      helper: `掌握率 ${masteryRate}%`,
      badge: `${masteryRate}%`,
      icon: CheckCircle2,
      className: 'text-green-600',
      iconClassName: 'bg-green-50 text-green-600',
    },
    {
      title: '待复习',
      value: statistics.basic.toReviewCount,
      helper: totalQuestions > 0 ? `${Math.round((toReviewCount / totalQuestions) * 100)}% 仍需巩固` : '暂无待复习',
      badge: '复习',
      icon: AlertCircle,
      className: 'text-red-500',
      iconClassName: 'bg-red-50 text-red-500',
    },
    {
      title: '总复习次数',
      value: totalReviewRecords,
      helper: `${statistics.reviewSummary?.totalCorrect ?? 0} 次答对`,
      badge: '累计',
      icon: Repeat2,
      className: 'text-amber-600',
      iconClassName: 'bg-amber-50 text-amber-600',
    },
    {
      title: '累计正确率',
      value: `${cumulativeCorrectRate}%`,
      helper: `${statistics.reviewSummary?.totalWrong ?? 0} 次答错`,
      badge: '正确率',
      icon: Percent,
      className: 'text-blue-600',
      iconClassName: 'bg-blue-50 text-blue-600',
    },
  ] : [];

  const reviewCards = statistics?.reviewSummary ? [
    {
      title: '总复习次数',
      value: totalReviewRecords,
      helper: `共 ${statistics.reviewSessionStats?.totalSessions ?? 0} 个复习会话`,
      badge: '复习',
      icon: Repeat2,
      className: 'text-amber-600',
      iconClassName: 'bg-amber-50 text-amber-600',
    },
    {
      title: '累计正确题数',
      value: statistics.reviewSummary.totalCorrect,
      helper: '历史所有复习记录',
      badge: '答对',
      icon: CheckCircle2,
      className: 'text-green-600',
      iconClassName: 'bg-green-50 text-green-600',
    },
    {
      title: '累计错误题数',
      value: statistics.reviewSummary.totalWrong,
      helper: '历史所有复习记录',
      badge: '答错',
      icon: AlertCircle,
      className: 'text-red-500',
      iconClassName: 'bg-red-50 text-red-500',
    },
    {
      title: '平均复习题数',
      value: statistics.reviewSessionStats?.averageQuestionsPerSession ?? 0,
      helper: '每次会话平均复习数',
      badge: '题/次',
      icon: Book,
      className: 'text-blue-600',
      iconClassName: 'bg-blue-50 text-blue-600',
    },
    {
      title: '平均正确率',
      value: `${statistics.reviewSessionStats?.averageCorrectRate ?? 0}%`,
      helper: '所有会话正确率均值',
      badge: '平均率',
      icon: Percent,
      className: 'text-purple-600',
      iconClassName: 'bg-purple-50 text-purple-600',
    },
  ] : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href="/error-questions">
              <Button variant="ghost" size="sm" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors group" aria-label="返回错题本">
                <ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1" />
                <span className="hidden sm:inline-block ml-1">返回错题本</span>
              </Button>
            </Link>
            <div className="hidden h-5 w-px bg-gray-200 sm:block" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              错题统计
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <Link href="/error-questions/review/history">
                  <Button variant="ghost" size="sm" className="hidden items-center gap-2 sm:flex">
                    <History className="size-4" />
                    复习历史
                  </Button>
                </Link>
                <div className="hidden items-center gap-2 sm:flex">
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.nickname}
                      width={32}
                      height={32}
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-sm font-medium text-white">
                      {user.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden text-sm font-medium text-gray-700 md:inline">
                    {getUserDisplayName(user)}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="p-2 text-gray-500" aria-label="退出登录">
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <Loader2 className="size-4 animate-spin text-gray-400" />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/70 px-3 py-1 text-sm text-blue-700">
              <BarChart3 className="size-4" />
              学习反馈面板
            </div>
            <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">错题统计</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              汇总错题分布、复习趋势和掌握度变化，为您提供直观的学习反馈。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRetry}
            disabled={!user || loadState === 'loading'}
            className="border-blue-200 bg-white/80 text-blue-600 hover:bg-blue-50"
          >
            {loadState === 'loading' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            刷新
          </Button>
        </div>

        {(isAuthLoading || loadState === 'loading') && <LoadingState />}

        {!isAuthLoading && loadState === 'error' && (
          <Empty className="border border-red-100 bg-white/80 shadow-md">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-red-50 text-red-500">
                <BarChart3 />
              </EmptyMedia>
              <EmptyTitle>统计数据加载失败</EmptyTitle>
              <EmptyDescription>请稍后重试，或返回错题本继续复习。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={handleRetry} className="bg-gradient-to-r from-blue-500 to-purple-500">
                重新加载
              </Button>
            </EmptyContent>
          </Empty>
        )}

        {!isAuthLoading && loadState === 'ready' && !hasData && (
          <Empty className="border border-blue-100 bg-white/80 shadow-md">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-blue-50 text-blue-500">
                <Book />
              </EmptyMedia>
              <EmptyTitle>暂无统计数据</EmptyTitle>
              <EmptyDescription>录入错题或完成复习后，这里会展示错题分布和复习趋势。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/error-questions/add">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                  录入错题
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        )}

        {!isAuthLoading && loadState === 'ready' && hasData && statistics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {overviewCards.map(({ title, value, helper, badge, icon: Icon, className, iconClassName }) => (
                <Card key={title} className="border-0 bg-white/80 shadow-md transition-shadow hover:shadow-lg">
                  <CardContent className="p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className={`flex size-9 items-center justify-center rounded-lg ${iconClassName}`}>
                        <Icon className="size-5" />
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500 shadow-sm">
                        {badge}
                      </span>
                    </div>
                    <div className="mb-1 text-sm text-gray-500">{title}</div>
                    <div className={`text-3xl font-bold ${className}`}>{value}</div>
                    <div className="mt-2 text-xs text-gray-400">{helper}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="border-0 bg-white/80 shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <PieChartIcon className="size-5" />
                  </div>
                  <CardTitle className="text-base text-gray-800">题型分布</CardTitle>
                  <CardDescription>各题型错题数量占比</CardDescription>
                </CardHeader>
                <CardContent>
                  <TypeDistributionPieChart data={statistics.typeDistribution} />
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/80 shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <BarChart3 className="size-5" />
                  </div>
                  <CardTitle className="text-base text-gray-800">标签分布</CardTitle>
                  <CardDescription>TOP 10 高频知识点标签</CardDescription>
                </CardHeader>
                <CardContent>
                  <TopTagsBarChart data={statistics.topTags} />
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/80 shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <LineChartIcon className="size-5" />
                  </div>
                  <CardTitle className="text-base text-gray-800">错题趋势</CardTitle>
                  <CardDescription>近 7 天新增错题趋势</CardDescription>
                </CardHeader>
                <CardContent>
                  <Last7DaysTrendLineChart data={statistics.last7DaysTrend} />
                </CardContent>
              </Card>
            </div>

            {/* 复习历史统计 */}
            {reviewCards.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <History className="size-5 text-gray-500" />
                  <h2 className="text-xl font-bold text-gray-800">复习概览统计</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {reviewCards.map(({ title, value, helper, badge, icon: Icon, className, iconClassName }) => (
                    <Card key={title} className="border-0 bg-white/80 shadow-md transition-shadow hover:shadow-lg">
                      <CardContent className="p-4">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className={`flex size-9 items-center justify-center rounded-lg ${iconClassName}`}>
                            <Icon className="size-5" />
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-500 shadow-sm">
                            {badge}
                          </span>
                        </div>
                        <div className="mb-1 text-sm text-gray-500">{title}</div>
                        <div className={`text-3xl font-bold ${className}`}>{value}</div>
                        <div className="mt-2 text-xs text-gray-400">{helper}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {statistics.last30DaysReviewTrend && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card className="border-0 bg-white/80 shadow-md lg:col-span-2">
                      <CardHeader>
                        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                          <LineChartIcon className="size-5" />
                        </div>
                        <CardTitle className="text-base text-gray-800">复习趋势</CardTitle>
                        <CardDescription>近 30 天复习次数与正确率</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Last30DaysReviewTrendChart data={statistics.last30DaysReviewTrend} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {statistics.masteryDistribution && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card className="border-0 bg-white/80 shadow-md lg:col-span-2">
                      <CardHeader>
                        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                          <BarChart3 className="size-5" />
                        </div>
                        <CardTitle className="text-base text-gray-800">掌握度分布</CardTitle>
                        <CardDescription>按掌握程度区间的错题数量分布</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <MasteryDistributionBarChart data={statistics.masteryDistribution} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {statistics.last30DaysReviewTrend && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Card className="border-0 bg-white/80 shadow-md lg:col-span-2">
                      <CardHeader>
                        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                          <LineChartIcon className="size-5" />
                        </div>
                        <CardTitle className="text-base text-gray-800">平均正确率变化趋势</CardTitle>
                        <CardDescription>近 30 天复习会话平均正确率变化</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ReviewSessionCorrectRateTrendChart data={statistics.last30DaysReviewTrend} />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
