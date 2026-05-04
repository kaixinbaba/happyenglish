'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  LogOut,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const questionTypeLabels: Record<string, string> = {
  'spelling': '单词拼写',
  'multiple-choice': '单项选择',
  'grammar': '语法填空',
  'translation': '翻译/连词成句',
  'reading': '阅读理解',
  'custom': '自定义题型',
};

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

interface ReviewRecord {
  id: string;
  sessionId: string;
  questionId: string;
  userId: string;
  result: 'correct' | 'wrong';
  previousMasteryLevel: number;
  newMasteryLevel: number;
  orderIndex: number;
  createdAt: string;
  question: any;
}

export default function ReviewDetailPage() {
  const { user, logout } = useAuth();
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ReviewSession | null>(null);
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载复习详情
  const loadDetail = async () => {
    if (!user || !sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/error-questions/review/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
        setRecords(data.records || []);
      } else if (response.status === 404) {
        router.push('/error-questions/review/history');
      }
    } catch (error) {
      console.error('Load review detail error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [user, sessionId]);

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

  // 获取题目预览
  const getQuestionPreview = (question: any) => {
    if (!question) return '题目已删除';

    switch (question.type) {
      case 'spelling':
        return question.content?.word || '拼写题';
      case 'multiple-choice':
      case 'word-choice':
        return question.content?.question || '选择题';
      case 'grammar':
        return question.content?.sentence || '语法题';
      case 'translation':
        return question.content?.source || '翻译题';
      case 'reading':
        return question.content?.question || '阅读理解题';
      default:
        return question.content?.description || '自定义题型';
    }
  };

  // 获取掌握度变化图标
  const getMasteryChangeIcon = (prev: number, current: number) => {
    if (current > prev) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (current < prev) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return null;
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
            <div className="text-center py-20">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">加载中...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/error-questions/review/history">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              复习详情
            </Link>
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
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/error-questions/review/history">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              复习详情
            </Link>
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
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">复习会话不存在</h2>
            <Link href="/error-questions/review/history">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                返回历史
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const accuracy = session.completedQuestions > 0
    ? Math.round((session.correctCount / session.completedQuestions) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/error-questions/review/history">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="text-lg font-bold text-gray-800">复习详情</div>
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
        {/* Summary Card */}
        <Card className="border-0 bg-white/80 shadow-xl mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-1">开始时间</div>
              <div className="text-gray-800">{formatDate(session.startedAt)}</div>
            </div>

            {session.completedAt && (
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">完成时间</div>
                <div className="text-gray-800">{formatDate(session.completedAt)}</div>
              </div>
            )}

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">
                  进度 {session.completedQuestions}/{session.totalQuestions}
                </span>
                <span className="text-gray-600">正确率 {accuracy}%</span>
              </div>
              <Progress
                value={(session.completedQuestions / session.totalQuestions) * 100}
                className="h-2"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">总题数</div>
                <div className="text-2xl font-bold text-gray-800">{session.totalQuestions}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">已完成</div>
                <div className="text-2xl font-bold text-blue-600">{session.completedQuestions}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">答对</div>
                <div className="text-2xl font-bold text-green-600">{session.correctCount}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">答错</div>
                <div className="text-2xl font-bold text-red-600">{session.wrongCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Records List */}
        {records.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">答题记录</h3>
            {records.map((record, index) => (
              <Card key={record.id} className="border-0 bg-white/80 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {record.result === 'correct' ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-500">#{index + 1}</span>
                        {record.question && (
                          <>
                            <Badge variant="secondary">
                              {questionTypeLabels[record.question.type] || record.question.type}
                            </Badge>
                            {record.question.tags?.map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>

                      <p className="text-gray-800 mb-3 truncate">
                        {getQuestionPreview(record.question)}
                      </p>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">掌握度:</span>
                          <span>{record.previousMasteryLevel}</span>
                          {getMasteryChangeIcon(record.previousMasteryLevel, record.newMasteryLevel)}
                          <span>{record.newMasteryLevel}</span>
                        </div>
                        <span className="text-gray-400">
                          {formatDate(record.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center mt-8">
          {session.status === 'in_progress' && (
            <Link href={`/error-questions/review?sessionId=${session.id}`}>
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                继续复习
              </Button>
            </Link>
          )}
          <Link href="/error-questions/review/start">
            <Button variant="outline">
              再来一组
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
