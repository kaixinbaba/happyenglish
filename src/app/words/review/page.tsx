'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';

interface ReviewWord {
  id: string;
  word: string;
  translation: string | null;
  summary: string | null;
  sentenceHint: string | null;
  learnCount: number;
  story: {
    id: string;
    imageUrl: string | null;
  } | null;
}

type LoadState = 'loading' | 'ready' | 'error';

export default function WordsReviewPage() {
  const { isLoading: authLoading } = useAuth();
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  // Review stats
  const [remembered, setRemembered] = useState(0);
  const [forgotten, setForgotten] = useState(0);

  const fetchWords = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch('/api/words/review');
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

  const currentWord = words[currentIndex] || null;
  const progress = words.length > 0 ? ((currentIndex) / words.length) * 100 : 0;
  const accuracy = remembered + forgotten > 0
    ? Math.round((remembered / (remembered + forgotten)) * 100)
    : 0;

  const handleResult = (result: 'remembered' | 'forgotten') => {
    if (result === 'remembered') {
      setRemembered(prev => prev + 1);
    } else {
      setForgotten(prev => prev + 1);
    }

    if (currentIndex + 1 >= words.length) {
      setReviewDone(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
      setShowHint(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setShowHint(false);
    setReviewDone(false);
    setRemembered(0);
    setForgotten(0);
  };

  // Loading state
  if (authLoading || loadState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="mb-6">
            <Skeleton className="h-9 w-24" />
          </div>
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-36 w-36 rounded-2xl" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-2 w-full max-w-xs" />
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
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
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/words/statistics">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回统计
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
        <div className="mx-auto max-w-lg px-4 py-6">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/words/statistics">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                返回统计
              </Button>
            </Link>
          </div>
          <Empty>
            <EmptyMedia>
              <BookOpen className="h-16 w-16 text-gray-300" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>还没有可复习的单词</EmptyTitle>
              <EmptyDescription>生成带故事的生词后，可以在这里复习</EmptyDescription>
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

  // Review complete
  if (reviewDone) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
        <div className="mx-auto max-w-lg px-4 py-6">
          <Card className="text-center">
            <CardContent className="py-10">
              <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
              <CardTitle className="mb-2 text-xl">复习完成</CardTitle>
              <CardDescription className="mb-6">
                本轮复习已结束，来看看你的表现
              </CardDescription>

              {/* Stats grid */}
              <div className="mb-8 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-500" />
                  <p className="text-2xl font-bold text-emerald-600">{remembered}</p>
                  <p className="text-xs text-gray-500">记得</p>
                </div>
                <div className="rounded-xl bg-red-50 p-4">
                  <XCircle className="mx-auto mb-1 h-5 w-5 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{forgotten}</p>
                  <p className="text-xs text-gray-500">没记住</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-4">
                  <TrendingUp className="mx-auto mb-1 h-5 w-5 text-blue-500" />
                  <p className="text-2xl font-bold text-blue-600">{accuracy}%</p>
                  <p className="text-xs text-gray-500">正确率</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3">
                <Button onClick={handleRestart} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  再来一轮
                </Button>
                <Link href="/words/statistics">
                  <Button variant="outline" className="w-full gap-2">
                    <TrendingUp className="h-4 w-4" />
                    查看统计
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main flashcard view
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-blue-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Top nav */}
        <div className="mb-4 flex items-center justify-between">
          <Link href="/words/statistics">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              查看统计
            </Button>
          </Link>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {words.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Flashcard */}
        <Card className="mb-4 overflow-hidden">
          <CardContent className="p-6">
            {/* Word display */}
            <div className="mb-6 text-center">
              <p className="text-4xl font-bold text-gray-800 sm:text-5xl">{currentWord.word}</p>
              <p className="mt-1 text-sm text-gray-400">已学习 {currentWord.learnCount} 次</p>
            </div>

            {/* Translation reveal */}
            {showAnswer ? (
              <div className="mb-6 animate-in fade-in rounded-xl bg-blue-50 p-4 text-center">
                <p className="text-lg text-blue-700">{currentWord.translation || '暂无翻译'}</p>
              </div>
            ) : (
              <div className="mb-6 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowAnswer(true)}
                  className="gap-2"
                >
                  <Eye className="h-5 w-5" />
                  显示答案
                </Button>
              </div>
            )}

            {/* Hint section */}
            <div className="space-y-3">
              {showHint ? (
                <div className="animate-in fade-in space-y-3">
                  {/* Story image */}
                  {currentWord.story?.imageUrl && (
                    <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl">
                      <Image
                        src={currentWord.story.imageUrl}
                        alt={`${currentWord.word} story illustration`}
                        width={400}
                        height={300}
                        className="w-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  {/* Summary */}
                  {currentWord.summary && (
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="mb-1 text-xs font-medium text-amber-700">语境释义</p>
                      <p className="text-sm text-amber-900">{currentWord.summary}</p>
                    </div>
                  )}
                  {/* Sentence hint */}
                  {currentWord.sentenceHint && (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="mb-1 text-xs font-medium text-green-700">故事原句</p>
                      <p className="text-sm text-green-900 italic">
                        {highlightWord(currentWord.sentenceHint, currentWord.word)}
                      </p>
                    </div>
                  )}
                  {!currentWord.summary && !currentWord.sentenceHint && !currentWord.story?.imageUrl && (
                    <p className="text-center text-sm text-gray-400">暂无更多提示</p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHint(true)}
                    className="gap-1.5"
                  >
                    <Lightbulb className="h-4 w-4" />
                    查看提示
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Result buttons */}
        {showAnswer && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleResult('forgotten')}
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <EyeOff className="h-5 w-5" />
              没记住
            </Button>
            <Button
              size="lg"
              onClick={() => handleResult('remembered')}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600"
            >
              <CheckCircle2 className="h-5 w-5" />
              记得了
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Bold the target word within the sentence for visual emphasis */
function highlightWord(sentence: string, word: string): React.ReactNode {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b(${escaped})\\b`, 'i');
  const match = sentence.match(regex);
  if (!match || match.index === undefined) return sentence;

  const before = sentence.slice(0, match.index);
  const wordText = sentence.slice(match.index, match.index + match[0].length);
  const after = sentence.slice(match.index + match[0].length);

  return (
    <>
      {before}
      <strong className="font-bold text-green-800 underline decoration-green-400 underline-offset-2">
        {wordText}
      </strong>
      {after}
    </>
  );
}
