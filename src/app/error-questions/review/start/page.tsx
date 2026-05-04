'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, LogOut, Book, History, Loader2, PlayCircle } from 'lucide-react';
import { useAuth, getUserDisplayName } from '@/contexts/AuthContext';

const questionTypeLabels: Record<string, string> = {
  'spelling': '单词拼写',
  'multiple-choice': '单项选择',
  'grammar': '语法填空',
  'translation': '翻译/连词成句',
  'reading': '阅读理解',
  'custom': '自定义题型',
};

interface Statistics {
  basic: {
    totalQuestions: number;
    masteredCount: number;
    toReviewCount: number;
    masteryRate: number;
  };
  topTags: Array<{ tag: string; count: number }>;
  typeDistribution: Array<{ type: string; count: number }>;
}

export default function ReviewStartPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedCount, setSelectedCount] = useState<string>('20');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // 加载统计数据
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/error-questions/review/statistics');
        if (response.ok) {
          const data = await response.json();
          setStatistics(data);
        }
      } catch (error) {
        console.error('Load statistics error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // 开始复习
  const handleStartReview = async () => {
    if (!user) return;

    setIsStarting(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', selectedCount);
      if (selectedType !== 'all') params.set('type', selectedType);
      if (selectedTag !== 'all') params.set('tag', selectedTag);

      const response = await fetch(`/api/error-questions/review/start?${params.toString()}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/error-questions/review?sessionId=${data.sessionId}`);
      } else {
        const errorData = await response.json();
        alert(errorData.error || '开始复习失败，请重试');
      }
    } catch (error) {
      console.error('Start review error:', error);
      alert('开始复习失败，请重试');
    } finally {
      setIsStarting(false);
    }
  };

  // 未登录显示登录提示
  if (!user && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              错题本
            </Link>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
          <div className="text-center py-20">
            <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
            <p className="text-gray-500 mb-6">登录后可使用错题本功能</p>
            <Button
              onClick={() => (window.location.href = '/api/auth/feishu')}
              className="bg-gradient-to-r from-blue-500 to-purple-500"
            >
              飞书登录
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/error-questions">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            开始复习
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/error-questions">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Book className="w-4 h-4" />
                    错题本
                  </Button>
                </Link>
                <Link href="/error-questions/review/history">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    复习历史
                  </Button>
                </Link>
                <div className="flex items-center gap-2">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.nickname}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                      {user.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-700 hidden sm:inline">{getUserDisplayName(user)}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            {statistics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card className="border-0 bg-white/80 shadow-md">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500 mb-1">总错题数</div>
                    <div className="text-3xl font-bold text-gray-800">{statistics.basic.totalQuestions}</div>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/80 shadow-md">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500 mb-1">已掌握</div>
                    <div className="text-3xl font-bold text-green-600">{statistics.basic.masteredCount}</div>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/80 shadow-md">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500 mb-1">待复习</div>
                    <div className="text-3xl font-bold text-red-500">{statistics.basic.toReviewCount}</div>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-white/80 shadow-md">
                  <CardContent className="p-4">
                    <div className="text-sm text-gray-500 mb-1">掌握率</div>
                    <div className="text-3xl font-bold text-blue-600">{statistics.basic.masteryRate}%</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Setup Form */}
            <Card className="border-0 bg-white/80 shadow-xl mb-8">
              <CardHeader>
                <CardTitle className="text-xl">设置复习选项</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Review Count */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">复习题目数量</label>
                  <Select value={selectedCount} onValueChange={setSelectedCount}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择复习数量" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 题</SelectItem>
                      <SelectItem value="20">20 题</SelectItem>
                      <SelectItem value="30">30 题</SelectItem>
                      <SelectItem value="50">50 题</SelectItem>
                      <SelectItem value="100">100 题</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">按题型筛选</label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部题型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部题型</SelectItem>
                      {statistics?.typeDistribution?.map(({ type }) => (
                        <SelectItem key={type} value={type}>
                          {questionTypeLabels[type] || type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by Tag */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">按知识点筛选</label>
                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger>
                      <SelectValue placeholder="全部知识点" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部知识点</SelectItem>
                      {statistics?.topTags?.map(({ tag }) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Button */}
                <Button
                  onClick={handleStartReview}
                  disabled={isStarting || statistics?.basic.toReviewCount === 0}
                  className="w-full h-14 text-lg font-medium bg-gradient-to-r from-blue-500 to-purple-500"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      准备中...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5 mr-2" />
                      开始复习
                    </>
                  )}
                </Button>

                {statistics?.basic.toReviewCount === 0 && (
                  <p className="text-center text-gray-500 text-sm">
                    恭喜！你现在没有需要复习的错题
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
