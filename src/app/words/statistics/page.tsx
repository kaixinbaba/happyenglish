'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Hash,
  Brain,
} from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';

interface WordItem {
  id: string;
  word: string;
  translation: string | null;
  learnCount: number;
  firstLearnedAt: string;
  lastLearnedAt: string;
  summary: string | null;
  sentenceHint: string | null;
  storyId: string | null;
}

type LoadState = 'loading' | 'ready' | 'error';

export default function WordsStatisticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [words, setWords] = useState<WordItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const fetchWords = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch('/api/words?sort=learnCount&order=desc');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWords(data.words || []);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      fetchWords();
    }
  }, [authLoading, fetchWords]);

  const overview = useMemo(() => {
    if (words.length === 0) return null;
    const totalWords = words.length;
    const totalLearnCount = words.reduce((sum, w) => sum + w.learnCount, 0);
    const avgLearnCount = totalWords > 0 ? Math.round((totalLearnCount / totalWords) * 10) / 10 : 0;
    const maxLearnCount = Math.max(...words.map(w => w.learnCount));
    const highFreqCount = words.filter(w => w.learnCount >= 3).length;
    return { totalWords, avgLearnCount, maxLearnCount, highFreqCount };
  }, [words]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Loading state
  if (authLoading || loadState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {/* Header skeleton */}
          <div className="mb-6 flex items-center justify-between">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
          {/* Cards skeleton */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="p-4 pb-2">
                  <Skeleton className="h-4 w-16" />
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Table skeleton */}
          <Card>
            <CardContent className="p-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 border-b border-gray-100 px-4 py-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
          <Card className="text-center">
            <CardContent className="py-12">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
              <p className="mb-4 text-gray-500">数据加载失败</p>
              <Button variant="outline" size="sm" onClick={fetchWords} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Empty state
  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
          <Empty>
            <EmptyMedia>
              <BookOpen className="h-16 w-16 text-gray-300" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>还没有生词记录</EmptyTitle>
              <EmptyDescription>生成故事后，新学的单词会出现在这里</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/">
                <Button className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  去生成故事
                </Button>
              </Link>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    );
  }

  // Table columns
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
          <Link href="/words/review">
            <Button className="gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600">
              <Brain className="h-4 w-4" />
              开始复习
            </Button>
          </Link>
        </div>

        {/* Overview Cards - Task 4.3 */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-l-4 border-l-blue-400">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Hash className="h-3.5 w-3.5" />
                总单词数
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-blue-600">{overview?.totalWords}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-400">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                平均学习次数
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-emerald-600">{overview?.avgLearnCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-400">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" />
                最高学习次数
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-purple-600">{overview?.maxLearnCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-400">
            <CardHeader className="p-4 pb-1">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                需重点复习
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-2xl font-bold text-orange-600">{overview?.highFreqCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Word Table - Task 4.2 */}
        <Card>
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-base">单词统计</CardTitle>
            <CardDescription>学过的所有单词，按学习次数排列</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">单词</TableHead>
                    <TableHead className="w-[140px]">中文释义</TableHead>
                    <TableHead className="w-[80px] text-center">学习次数</TableHead>
                    <TableHead className="w-[110px]">首次学习</TableHead>
                    <TableHead className="w-[110px]">最近学习</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {words.map((w) => {
                    const isHigh = w.learnCount >= 5;
                    const isMedium = w.learnCount >= 3 && w.learnCount < 5;
                    return (
                      <TableRow
                        key={w.id}
                        className={
                          isHigh
                            ? 'bg-red-50 hover:bg-red-100'
                            : isMedium
                              ? 'bg-orange-50 hover:bg-orange-100'
                              : ''
                        }
                      >
                        <TableCell className="font-semibold">{w.word}</TableCell>
                        <TableCell className="text-gray-600">{w.translation || '-'}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              isHigh
                                ? 'font-bold text-red-600'
                                : isMedium
                                  ? 'font-bold text-orange-600'
                                  : ''
                            }
                          >
                            {w.learnCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{formatDate(w.firstLearnedAt)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{formatDate(w.lastLearnedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden">
              {words.map((w) => {
                const isHigh = w.learnCount >= 5;
                const isMedium = w.learnCount >= 3 && w.learnCount < 5;
                return (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between border-b border-gray-100 px-4 py-3 ${
                      isHigh ? 'bg-red-50' : isMedium ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{w.word}</p>
                      <p className="text-xs text-gray-500 truncate">{w.translation || '-'}</p>
                    </div>
                    <div className="ml-3 flex-shrink-0 text-right">
                      <p
                        className={`text-lg font-bold ${
                          isHigh ? 'text-red-600' : isMedium ? 'text-orange-600' : 'text-gray-700'
                        }`}
                      >
                        {w.learnCount}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {formatDate(w.lastLearnedAt).slice(5)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
