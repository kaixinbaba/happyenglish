'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Book, LogOut, Plus, MoreHorizontal, Edit, Trash2, PlayCircle, Loader2, AlertTriangle, History, Search } from 'lucide-react';
import { useAuth, getUserDisplayName } from '@/contexts/AuthContext';

const questionTypeLabels: Record<string, string> = {
  'spelling': '单词拼写',
  'multiple-choice': '单项选择',
  'grammar': '语法填空',
  'translation': '翻译/连词成句',
  'reading': '阅读理解',
  'custom': '自定义题型',
};

interface QuestionContent {
  word?: string;
  question?: string;
  sentence?: string;
  source?: string;
  description?: string;
}

interface ErrorQuestion {
  id: string;
  type: string;
  content: QuestionContent;
  correctAnswer: string;
  userAnswer: string;
  errorReason: string;
  masteryLevel: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  relatedWords: string[];
}

interface Statistics {
  basic: {
    totalQuestions: number;
    masteredCount: number;
    toReviewCount: number;
    masteryRate: number;
  };
  topTags: Array<{ tag: string; count: number }>;
  weakestWords: Array<{ word: string; translation: string; masteryLevel: number; errorCount: number }>;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

export default function ErrorQuestionsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState<ErrorQuestion[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 加载错题列表和统计数据
  const loadData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (selectedType !== 'all') params.set('type', selectedType);
      if (selectedTag !== 'all') params.set('tag', selectedTag);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      // 先加载错题列表，优先保证页面可交互
      const listResponse = await fetch(`/api/error-questions?${params.toString()}`);
      if (listResponse.ok) {
        const listData = await listResponse.json();
        setQuestions(listData.list || []);
        setPagination(listData.pagination || {
          page,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        });
      }
      setIsLoading(false); // 列表加载完直接结束全局loading，不等待统计

      // 异步加载统计数据，不阻塞页面
      const statsResponse = await fetch('/api/error-questions/review/statistics');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStatistics(statsData);
      }
    } catch (error) {
      console.error('Load error questions error:', error);
      setIsLoading(false);
    }
  }, [page, searchTerm, selectedTag, selectedType, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [selectedType, selectedTag, searchTerm]);

  // 获取掌握度对应的颜色
  const getMasteryColor = (level: number) => {
    if (level >= 80) return 'bg-green-50 text-green-700 border-green-200';
    if (level >= 60) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (level >= 40) return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  // 获取掌握度对应的文本
  const getMasteryText = (level: number) => {
    if (level >= 80) return '掌握良好';
    if (level >= 60) return '基本掌握';
    if (level >= 40) return '掌握一般';
    return '需要加强';
  };

  // 获取题目预览文本
  const getQuestionPreview = (question: ErrorQuestion) => {
    switch (question.type) {
      case 'spelling':
        return question.content.word || '拼写题';
      case 'word-choice':
      case 'multiple-choice':
        return question.content.question || '选择题';
      case 'grammar':
        return question.content.sentence || '语法题';
      case 'translation':
        return question.content.source || '翻译题';
      case 'reading':
        return question.content.question || '阅读理解题';
      default:
        return question.content.description || '自定义题型';
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteQuestionId || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/error-questions/${deleteQuestionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setQuestions(questions.filter(q => q.id !== deleteQuestionId));
        setDeleteQuestionId(null);
        // 重新加载统计数据
        loadData();
      } else {
        const data = await response.json();
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  // 未登录显示登录提示
  if (!user && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              单词故事
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
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            错题本
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/history">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    历史故事
                  </Button>
                </Link>
                <Link href="/error-questions">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Book className="w-4 h-4" />
                    错题本
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
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">我的错题</h1>
            <Link href="/error-questions/add">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                <Plus className="w-4 h-4 mr-2" />
                录入错题
              </Button>
            </Link>
            <Link href="/error-questions/review">
              <Button variant="outline" className="border-blue-500 text-blue-500">
                <PlayCircle className="w-4 h-4 mr-2" />
                开始复习
              </Button>
            </Link>
          </div>
        </div>

        {/* Statistics Cards */}
        {!isLoading && statistics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索题目、答案、标签"
              className="h-10 pl-9 bg-white/80"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="全部题型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部题型</SelectItem>
                {Object.entries(questionTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger>
                <SelectValue placeholder="全部标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部标签</SelectItem>
                {statistics?.topTags.map(({ tag }) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && questions.length === 0 && (
          <div className="text-center py-20">
            <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">暂无错题</h2>
            <p className="text-gray-500 mb-6">开始录入您的第一道错题吧</p>
            <Link href="/error-questions/add">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                录入错题
              </Button>
            </Link>
          </div>
        )}

        {/* Questions List */}
        {!isLoading && questions.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              共 {pagination.total} 道错题，第 {pagination.page} / {Math.max(pagination.totalPages, 1)} 页
            </div>
            <div className="space-y-4">
              {questions.map((question) => (
                <Card key={question.id} className="hover:shadow-lg transition-shadow border-0 bg-white/80">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant="secondary">{questionTypeLabels[question.type] || question.type}</Badge>
                          <Badge className={getMasteryColor(question.masteryLevel)} variant="outline">
                            {getMasteryText(question.masteryLevel)}
                          </Badge>
                          <span className="text-xs text-gray-400">{formatDate(question.createdAt)}</span>
                        </div>

                        {/* Question Preview */}
                        <p className="text-gray-800 text-base line-clamp-2 mb-3">
                          {getQuestionPreview(question)}
                        </p>

                        {/* Tags */}
                        {question.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {question.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Related Words */}
                        {question.relatedWords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {question.relatedWords.map(word => (
                              <Badge key={word} variant="outline" className="text-xs px-2 py-0 bg-blue-50 text-blue-700 border-blue-100">
                                {word}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-2 h-auto">
                            <MoreHorizontal className="w-5 h-5 text-gray-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>操作</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/error-questions/${question.id}/edit`)}>
                            <Edit className="w-4 h-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push('/error-questions/review')}>
                            <PlayCircle className="w-4 h-4 mr-2" />
                            加入复习
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeleteQuestionId(question.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                >
                  上一页
                </Button>
                <div className="text-sm text-gray-500">
                  {page} / {pagination.totalPages}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages))}
                >
                  下一页
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteQuestionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">确认删除</h3>
                <p className="text-sm text-gray-500">此操作无法撤销</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              确定要永久删除这道错题吗？删除后将无法恢复。
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteQuestionId(null)}
                disabled={isDeleting}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
