'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, History, LogOut, Book, BookOpen } from 'lucide-react';
import ResultPage from '@/components/ResultPage';
import { useAuth, getUserDisplayName } from '@/contexts/AuthContext';

const ageGroups = [
  { value: 'preschool', label: '学龄前 (3-6岁)' },
  { value: 'grade1-3', label: '一二三年级 (6-9岁)' },
  { value: 'grade4-5', label: '四五年级 (9-11岁)' },
  { value: 'grade6-7', label: '六七年级 (11-13岁)' },
  { value: 'grade8-9', label: '八九年级 (13-15岁)' },
];

const wordCountOptions = [
  { value: '100', label: '100字' },
  { value: '150', label: '150字' },
  { value: '200', label: '200字' },
];

const imageCountOptions = [
  { value: '1', label: '1张' },
  { value: '2', label: '2张' },
  { value: '4', label: '4张' },
];

interface GenerateResult {
  story: string;
  translation: string;
  images: string[];
  words: string[];
  wordMappings: Record<string, string>;
  storyId?: string;
  learnedWords?: string[];
  // New fields for async image loading
  storyIdForImages?: string;
  imagePrompts?: string[];
  imageCount?: number;
  ageGroup?: string;
  wordCountVal?: number;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [words, setWords] = useState('');
  const [ageGroup, setAgeGroup] = useState('grade1-3');
  const [wordCount, setWordCount] = useState('100');
  const [imageCount, setImageCount] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');

  const parseWords = (input: string): string[] => {
    const normalized = input.replace(/，/g, ',');
    const parts = normalized.split(/[\n,]+/);
    return parts
      .map(word => word.trim())
      .filter(word => word.length > 0)
      .map(word => word.toLowerCase());
  };

  const handleFeishuLogin = () => {
    window.location.href = '/api/auth/feishu';
  };

  const handleGenerate = async () => {
    const parsedWords = parseWords(words);
    
    if (parsedWords.length === 0) {
      setError('请输入至少一个单词');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      // Step 1: Generate story + translation (fast, ~10-15s)
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          words: parsedWords,
          ageGroup,
          wordCount: parseInt(wordCount),
          imageCount: parseInt(imageCount),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const data = await response.json();
      setResult(data);
      setIsLoading(false);

      // Step 2: Generate images asynchronously (slow, ~10-30s)
      if (data.imagePrompts && data.imagePrompts.length > 0) {
        setIsGeneratingImages(true);
        generateImagesAsync(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
      setIsLoading(false);
    }
  };

  const generateImagesAsync = async (data: GenerateResult) => {
    try {
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyId: data.storyIdForImages,
          imagePrompts: data.imagePrompts,
        }),
      });

      if (response.ok) {
        const imageResult = await response.json();
        if (imageResult.images && imageResult.images.length > 0) {
          // Update the result with the generated images
          setResult(prev => prev ? { ...prev, images: imageResult.images } : prev);
        }
      }
    } catch (imageError) {
      console.error('Image generation failed:', imageError);
      // Non-critical, story is already shown
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setWords('');
    setError('');
  };

  // Show result page if generation is complete
  if (result) {
    return <ResultPage result={result} onReset={handleReset} isGeneratingImages={isGeneratingImages} />;
  }

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-purple-50 p-4">
        <div className="text-center space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 animate-spin text-blue-500 mx-auto" />
            <Sparkles className="w-6 h-6 text-yellow-400 absolute top-0 right-1/3 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">正在创作中...</h2>
            <p className="text-gray-600">AI正在为您生成有趣的故事和精美的插图</p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main input page
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      {/* Header with Auth */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            单词故事
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
                <Link href="/words/statistics">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    生词本
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
            ) : (
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
                <Link href="/words/statistics">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    生词本
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFeishuLogin}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.5 2C7.25 2 3 6.25 3 11.5c0 2.83 1.24 5.37 3.21 7.12l.01-.01c.93.85 2.08 1.47 3.35 1.81.67.18 1.37.28 2.09.28.72 0 1.42-.1 2.09-.28 1.27-.34 2.42-.96 3.35-1.81l.01.01C19.76 16.87 21 14.33 21 11.5 21 6.25 16.75 2 12.5 2zm0 16c-3.59 0-6.5-2.91-6.5-6.5S8.91 5 12.5 5s6.5 2.91 6.5 6.5-2.91 6.5-6.5 6.5z"/>
                  </svg>
                  飞书登录
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 pt-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            儿童单词故事生成器
          </h1>
          <p className="text-gray-600 text-lg">
            输入单词，AI为您创作专属学习故事
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl text-gray-800">故事设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Age Group Selection */}
            <div className="space-y-2">
              <Label htmlFor="ageGroup" className="text-base font-medium">
                选择年龄段
              </Label>
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger id="ageGroup" className="h-12 text-base">
                  <SelectValue placeholder="选择年龄段" />
                </SelectTrigger>
                <SelectContent>
                  {ageGroups.map(group => (
                    <SelectItem key={group.value} value={group.value} className="text-base">
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Words Input */}
            <div className="space-y-2">
              <Label htmlFor="words" className="text-base font-medium">
                输入要学习的单词
              </Label>
              <Textarea
                id="words"
                placeholder="输入单词，支持换行或逗号分隔&#10;例如：&#10;apple, banana, cat&#10;或者：&#10;apple&#10;banana&#10;cat"
                value={words}
                onChange={e => setWords(e.target.value)}
                className="min-h-[150px] text-base resize-none"
              />
              <p className="text-sm text-gray-500">
                已输入 {parseWords(words).length} 个单词
              </p>
            </div>

            {/* Options Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">故事字数</Label>
                <Select value={wordCount} onValueChange={setWordCount}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wordCountOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">图片数量</Label>
                <Select value={imageCount} onValueChange={setImageCount}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {imageCountOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isLoading || parseWords(words).length === 0}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              生成故事
            </Button>
            
            {/* Login hint for anonymous users */}
            {!user && (
              <p className="text-center text-sm text-gray-500">
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-blue-500"
                  onClick={handleFeishuLogin}
                >
                  飞书登录
                </Button>
                后可保存历史记录
              </p>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm pb-8">
          <p>故事和图片由AI生成，仅供学习参考</p>
        </div>
      </div>
    </div>
  );
}
