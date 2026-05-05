'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Book, History, LineChart, Loader2, LogOut, PieChart, RefreshCw } from 'lucide-react';
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

async function fetchStatistics() {
  const response = await fetch('/api/error-questions/review/statistics');
  if (!response.ok) {
    throw new Error('Failed to load statistics');
  }

  return response.json() as Promise<Statistics>;
}

const sectionCards = [
  {
    title: '错题概览',
    description: '总量、掌握率和待复习状态',
    icon: BarChart3,
  },
  {
    title: '错题分布',
    description: '题型、标签和近 7 天趋势',
    icon: PieChart,
  },
  {
    title: '复习历史',
    description: '复习次数、正确率和掌握度变化',
    icon: LineChart,
  },
];

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-0 bg-white/80 shadow-md">
            <CardContent className="p-4">
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
              <Skeleton className="h-40 w-full" />
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
  const hasData = totalQuestions > 0 || totalReviewRecords > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/error-questions">
            <Button variant="ghost" size="sm" className="p-2" aria-label="返回错题本">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <Link href="/error-questions" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            错题统计
          </Link>
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
              汇总错题分布、复习趋势和掌握度变化，为后续图表模块提供页面框架。
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-0 bg-white/80 shadow-md">
                <CardContent className="p-4">
                  <div className="mb-1 text-sm text-gray-500">总错题数</div>
                  <div className="text-3xl font-bold text-gray-800">{statistics.basic.totalQuestions}</div>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/80 shadow-md">
                <CardContent className="p-4">
                  <div className="mb-1 text-sm text-gray-500">已掌握</div>
                  <div className="text-3xl font-bold text-green-600">{statistics.basic.masteredCount}</div>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/80 shadow-md">
                <CardContent className="p-4">
                  <div className="mb-1 text-sm text-gray-500">待复习</div>
                  <div className="text-3xl font-bold text-red-500">{statistics.basic.toReviewCount}</div>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white/80 shadow-md">
                <CardContent className="p-4">
                  <div className="mb-1 text-sm text-gray-500">累计正确率</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {statistics.reviewSummary?.cumulativeCorrectRate ?? 0}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {sectionCards.map(({ title, description, icon: Icon }) => (
                <Card key={title} className="border-0 bg-white/80 shadow-md">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-base text-gray-800">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-blue-100 bg-blue-50/40 text-sm text-gray-500">
                      后续任务将在此处补充具体统计组件
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
