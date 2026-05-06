'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  LogOut,
  CheckCircle,
  XCircle,
  Book,
  Loader2,
  Award,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const questionTypeLabels: Record<string, string> = {
  spelling: '单词拼写',
  'word-choice': '词义辨析',
  'multiple-choice': '单项选择',
  grammar: '语法填空',
  translation: '翻译/连词成句',
  reading: '阅读理解',
  custom: '自定义题型',
};

interface ReviewQuestion {
  id: string;
  type: string;
  content: Record<string, any>;
  correctAnswer: string;
  userAnswer: string;
  errorReason: string;
  masteryLevel: number;
  tags: string[];
  relatedWords: { word: string; translation?: string }[];
  orderIndex: number;
}

function ReviewContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('sessionId');

  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const submittedQuestionIdsRef = useRef<Set<string>>(new Set());
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionData, setSessionData] = useState<any>(null);

  const loadReviewData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      let response;

      if (sessionId) {
        response = await fetch(
          `/api/error-questions/review/list?sessionId=${sessionId}`
        );
      } else {
        router.push('/error-questions/review/start');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || data.list || []);
        setSessionData(data.session || null);
        if (data.session) {
          setReviewedCount(data.session.completedQuestions || 0);
          setCorrectCount(data.session.correctCount || 0);
          setCurrentIndex(data.session.completedQuestions || 0);
        }
      }
    } catch (error) {
      console.error('Load review data error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, sessionId, router]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  const submitReviewInBackground = (
    params: { questionId: string; result: string; sessionId: string | null; orderIndex: number },
    retriesLeft: number = 2,
  ) => {
    fetch('/api/error-questions/review/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
      .then((response) => {
        if (!response.ok && retriesLeft > 0 && response.status >= 500) {
          setTimeout(() => submitReviewInBackground(params, retriesLeft - 1), 1000);
        }
      })
      .catch(() => {
        if (retriesLeft > 0) {
          setTimeout(() => submitReviewInBackground(params, retriesLeft - 1), 1000);
        }
      });
  };

  const handleSubmitReview = (isCorrect: boolean) => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;

    // 按 questionId 去重，防止重复提交
    if (submittedQuestionIdsRef.current.has(currentQuestion.id)) return;
    submittedQuestionIdsRef.current.add(currentQuestion.id);

    // 乐观更新本地状态 — 同步执行，立即切题
    setReviewedCount((prev) => prev + 1);
    if (isCorrect) setCorrectCount((prev) => prev + 1);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
    } else {
      setSessionData((prev: any) =>
        prev ? { ...prev, status: 'completed' } : null
      );
    }

    // 后台提交，不阻塞 UI
    submitReviewInBackground({
      questionId: currentQuestion.id,
      result: isCorrect ? 'correct' : 'wrong',
      sessionId: sessionId,
      orderIndex: currentQuestion.orderIndex || currentIndex,
    });
  };

  const renderQuestionContent = (question: ReviewQuestion) => {
    switch (question.type) {
      case 'spelling':
        return (
          <div className="space-y-4">
            <p className="text-lg font-medium">请拼写单词：</p>
            <p className="text-2xl font-bold text-center py-4">
              {question.content.hint || '请根据提示拼写对应的单词'}
            </p>
          </div>
        );
      case 'word-choice':
      case 'multiple-choice':
        return (
          <div className="space-y-4">
            <p className="text-lg font-medium">{question.content.question || ''}</p>
            <div className="space-y-2">
              {question.content.options?.map((option: string, index: number) => (
                <div key={index} className="p-3 border rounded-lg bg-gray-50">
                  <span className="font-semibold mr-2">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option}
                </div>
              ))}
            </div>
          </div>
        );
      case 'grammar':
        return (
          <div className="space-y-4">
            <p className="text-lg font-medium">请填写空白处的正确答案：</p>
            <p className="text-xl p-4 border rounded-lg bg-gray-50">
              {question.content.sentence || ''}
            </p>
          </div>
        );
      case 'translation':
        return (
          <div className="space-y-4">
            <p className="text-lg font-medium">请翻译：</p>
            <p className="text-xl p-4 border rounded-lg bg-gray-50">
              {question.content.source || ''}
            </p>
          </div>
        );
      case 'reading':
        return (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-gray-50 max-h-60 overflow-y-auto">
              <p className="text-gray-800 whitespace-pre-line">
                {question.content.passage || ''}
              </p>
            </div>
            <p className="text-lg font-medium">
              问题：{question.content.question || ''}
            </p>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <p className="text-xl p-4 border rounded-lg bg-gray-50">
              {question.content.description || ''}
            </p>
          </div>
        );
    }
  };

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
            <p className="text-gray-500 mb-6">登录后可使用复习功能</p>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/error-questions">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              复习
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="flex items-center gap-2"></div>
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

  if (!isLoading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/error-questions">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              复习
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="flex items-center gap-2"></div>
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
            <Award className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">太棒了！</h2>
            <p className="text-gray-500 mb-6">现在没有需要复习的错题</p>
            <Link href="/error-questions">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                返回错题本
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (currentIndex >= questions.length || sessionData?.status === 'completed') {
    const accuracy = reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0;
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/error-questions">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              复习完成
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="flex items-center gap-2"></div>
                  <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
          <div className="text-center py-10">
            <Award className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">恭喜完成本次复习！</h2>
            <p className="text-gray-500 mb-8">
              你总共复习了 {reviewedCount} 道题，正确率 {accuracy}%
            </p>

            <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl p-6 mb-8">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">总题数</span>
                    <span className="font-semibold">{reviewedCount}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">做对</span>
                    <span className="font-semibold text-green-600">{correctCount}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">做错</span>
                    <span className="font-semibold text-red-600">
                      {reviewedCount - correctCount}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">正确率</span>
                    <span className="font-semibold text-blue-600">{accuracy}%</span>
                  </div>
                  <Progress value={accuracy} className="h-2" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <Link href="/error-questions">
                <Button variant="outline">返回错题本</Button>
              </Link>
              <Link href="/error-questions/review/start">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                  再来一组
                </Button>
              </Link>
              {sessionId && (
                <Link href={`/error-questions/review/${sessionId}`}>
                  <Button variant="outline">查看详情</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/error-questions">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-800">复习中</h1>
            <p className="text-xs text-gray-500">
              {currentIndex + 1} / {questions.length}
            </p>
          </div>
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
        <div className="mb-6">
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {questionTypeLabels[currentQuestion.type] || currentQuestion.type}
              </Badge>
              {currentQuestion.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {renderQuestionContent(currentQuestion)}

            {showAnswer ? (
              <div className="space-y-4 p-4 border-2 border-green-200 rounded-xl bg-green-50">
                <div>
                  <div className="text-sm text-gray-500 mb-1">正确答案</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {currentQuestion.correctAnswer}
                  </div>
                </div>
                {currentQuestion.errorReason && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">上次错误原因</div>
                    <div className="text-gray-700">{currentQuestion.errorReason}</div>
                  </div>
                )}
                {currentQuestion.relatedWords.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 mb-1">关联单词</div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentQuestion.relatedWords.map((item) => (
                        <Badge key={item.word} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {item.word}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-500"
                onClick={() => setShowAnswer(true)}
              >
                点击查看答案
              </Button>
            )}
          </CardContent>

          {showAnswer && (
            <div className="p-4 pt-0 flex gap-3">
              <Button
                className="flex-1 h-12 bg-green-500 hover:bg-green-600 text-white text-lg font-medium"
                onClick={() => handleSubmitReview(true)}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                答对了
              </Button>
              <Button
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white text-lg font-medium"
                onClick={() => handleSubmitReview(false)}
              >
                <XCircle className="w-5 h-5 mr-2" />
                答错了
              </Button>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">已复习</div>
            <div className="text-xl font-bold text-gray-800">{reviewedCount}</div>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">做对</div>
            <div className="text-xl font-bold text-green-600">{correctCount}</div>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">正确率</div>
            <div className="text-xl font-bold text-blue-600">
              {reviewedCount > 0 ? Math.round((correctCount / reviewedCount) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>}>
      <ReviewContent />
    </Suspense>
  );
}
