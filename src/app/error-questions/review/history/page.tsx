'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  LogOut,
  History,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ReviewSession {
  id: string;
  userId: string;
  totalQuestions: number;
  completedQuestions: number;
  correctCount: number;
  wrongCount: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function ReviewHistoryPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 加载复习历史
  const loadHistory = async (currentPage = 1) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: '20',
      });

      const response = await fetch(`/api/error-questions/review/history?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Load review history error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(page);
  }, [user, page]);

  // 格式日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'cancelled': return '已取消';
      default: return status;
    }
  };

  // 获取状态颜色
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">已完成</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">进行中</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-800">已取消</Badge>;
      default:
        return <Badge>{status}</Badge>;
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
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
            <p className="text-gray-500 mb-6">登录后可查看复习历史</p>
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
          <div className="text-lg font-bold text-gray-800">复习历史</div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500">
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Loading */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">暂无复习历史</h2>
            <p className="text-gray-500 mb-6">开始你的第一次复习吧</p>
            <Link href="/error-questions/review/start">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                开始复习
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Session List */}
            <div className="space-y-4">
              {sessions.map(session => {
                const accuracy = session.totalQuestions > 0
                  ? Math.round((session.correctCount / session.completedQuestions) * 100)
                  : 0;

                return (
                  <Card key={session.id} className="border-0 bg-white/80 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {formatDate(session.startedAt)}
                            </span>
                            {getStatusBadge(session.status)}
                          </div>

                          <div className="mb-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">
                                进度 {session.completedQuestions}/{session.totalQuestions}
                              </span>
                              <span className="text-gray-600">
                                正确率 {session.completedQuestions > 0 ? accuracy : 0}%
                              </span>
                            </div>
                            <Progress
                              value={(session.completedQuestions / session.totalQuestions) * 100}
                              className="h-2"
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-green-600">{session.correctCount}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-red-600">{session.wrongCount}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {session.status === 'in_progress' && (
                            <Link href={`/error-questions/review?sessionId=${session.id}`}>
                              <Button variant="outline">
                                继续复习
                              </Button>
                            </Link>
                          )}
                          <Link href={`/error-questions/review/${session.id}`}>
                            <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                              查看详情
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 mt-8 pt-4 border-t">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  上一页
                </Button>
                <div className="text-sm text-gray-500">
                  第 {page} / {pagination.totalPages} 页，共 {pagination.total} 条
                </div>
                <Button
                  variant="outline"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
