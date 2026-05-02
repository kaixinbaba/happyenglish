'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { History, LogOut, ChevronRight, BookOpen, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth, getUserDisplayName } from '@/contexts/AuthContext';

interface StoryImage {
  id: string;
  image_url: string;
  order_index: number;
}

interface Story {
  id: string;
  story_en: string;
  story_zh: string;
  age_group: string;
  word_count: number;
  image_count: number;
  created_at: string;
  story_images: StoryImage[];
}

const ageGroupLabels: Record<string, string> = {
  'preschool': '学龄前',
  'grade1-3': '一二三年级',
  'grade4-5': '四五年级',
  'grade6-7': '六七年级',
  'grade8-9': '八九年级',
};

export default function HistoryPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchStories = async () => {
      try {
        const response = await fetch('/api/stories');
        if (response.ok) {
          const data = await response.json();
          setStories(data.stories || []);
        }
      } catch (error) {
        console.error('Failed to fetch stories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStories();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPreviewText = (text: string | null | undefined, maxLength: number = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleFeishuLogin = () => {
    window.location.href = '/api/auth/feishu';
  };

  const handleDeleteClick = (e: React.MouseEvent, storyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteStoryId(storyId);
  };

  const handleConfirmDelete = async () => {
    if (!deleteStoryId || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/stories/${deleteStoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStories(stories.filter(s => s.id !== deleteStoryId));
        setDeleteStoryId(null);
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

  const handleCancelDelete = () => {
    setDeleteStoryId(null);
  };

  if (!user && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              单词故事
            </Link>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={handleFeishuLogin} className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 2C7.25 2 3 6.25 3 11.5c0 2.83 1.24 5.37 3.21 7.12l.01-.01c.93.85 2.08 1.47 3.35 1.81.67.18 1.37.28 2.09.28.72 0 1.42-.1 2.09-.28 1.27-.34 2.42-.96 3.35-1.81l.01.01C19.76 16.87 21 14.33 21 11.5 21 6.25 16.75 2 12.5 2zm0 16c-3.59 0-6.5-2.91-6.5-6.5S8.91 5 12.5 5s6.5 2.91 6.5 6.5-2.91 6.5-6.5 6.5z"/>
                </svg>
                飞书登录
              </Button>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto p-4 sm:p-8">
          <div className="text-center py-20">
            <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">请先登录</h2>
            <p className="text-gray-500 mb-6">登录后可查看您的历史故事记录</p>
            <Button onClick={handleFeishuLogin} className="bg-gradient-to-r from-blue-500 to-purple-500">
              立即登录
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
            单词故事
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
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
            ) : (
              <Button variant="outline" size="sm" onClick={handleFeishuLogin} className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.5 2C7.25 2 3 6.25 3 11.5c0 2.83 1.24 5.37 3.21 7.12l.01-.01c.93.85 2.08 1.47 3.35 1.81.67.18 1.37.28 2.09.28.72 0 1.42-.1 2.09-.28 1.27-.34 2.42-.96 3.35-1.81l.01.01C19.76 16.87 21 14.33 21 11.5 21 6.25 16.75 2 12.5 2zm0 16c-3.59 0-6.5-2.91-6.5-6.5S8.91 5 12.5 5s6.5 2.91 6.5 6.5-2.91 6.5-6.5 6.5z"/>
                </svg>
                飞书登录
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <History className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800">历史故事</h1>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">加载中...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && stories.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">暂无历史记录</h2>
            <p className="text-gray-500 mb-6">开始生成您的第一个故事吧</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                生成故事
              </Button>
            </Link>
          </div>
        )}

        {/* Stories List */}
        <div className="space-y-4">
          {stories.map((story) => (
            <div key={story.id} className="relative group">
              {/* Delete Button - shows on hover using CSS */}
              <button
                onClick={(e) => handleDeleteClick(e, story.id)}
                className="absolute top-3 right-3 z-20 w-9 h-9 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="删除故事"
              >
                <X className="w-5 h-5" />
              </button>
              
              <Link href={`/story/${story.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer border-0 bg-white/80">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      {story.story_images && story.story_images.length > 0 && (
                        <div className="flex-shrink-0">
                          <img
                            src={story.story_images[0].image_url}
                            alt="Story thumbnail"
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-gray-800 text-sm sm:text-base line-clamp-2 mb-2">
                              {getPreviewText(story.story_en, 120)}
                            </p>
                            <p className="text-gray-500 text-xs sm:text-sm line-clamp-1">
                              {getPreviewText(story.story_zh, 80)}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                        
                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500">
                          <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">
                            {ageGroupLabels[story.age_group] || story.age_group}
                          </span>
                          <span>{story.word_count}字</span>
                          <span>{story.image_count}张图</span>
                          <span className="text-gray-400">|</span>
                          <span>{formatDate(story.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteStoryId && (
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
              确定要永久删除这个故事吗？删除后将无法恢复。
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
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
