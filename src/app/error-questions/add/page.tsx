'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, LogOut, Plus, X, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const questionTypes = [
  { value: 'spelling', label: '单词拼写题' },
  { value: 'multiple-choice', label: '单项选择题' },
  { value: 'grammar', label: '语法填空题' },
  { value: 'translation', label: '翻译/连词成句' },
  { value: 'reading', label: '阅读理解题' },
  { value: 'custom', label: '其他/自定义题型' },
];

const MIN_CHOICE_OPTIONS = 2;
const MAX_CHOICE_OPTIONS = 6;

interface QuestionContent {
  word?: string;
  hint?: string;
  wrongSpelling?: string;
  question?: string;
  options?: string[];
  sentence?: string;
  blankPosition?: number;
  source?: string;
  targetLanguage?: string;
  passage?: string;
  description?: string;
}

interface FormData {
  type: string;
  content: QuestionContent;
  correctAnswer: string;
  userAnswer: string;
  errorReason: string;
  tags: string[];
  relatedWords: string[];
}

export default function AddErrorQuestionPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [error, setError] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newWord, setNewWord] = useState('');

  const [formData, setFormData] = useState<FormData>({
    type: 'spelling',
    content: {
      word: '',
      hint: '',
      wrongSpelling: '',
    },
    correctAnswer: '',
    userAnswer: '',
    errorReason: '',
    tags: [],
    relatedWords: [],
  });

  // 题型切换时重置content
  const handleTypeChange = (type: string) => {
    let newContent: QuestionContent = {};
    switch (type) {
      case 'spelling':
        newContent = { word: '', hint: '', wrongSpelling: '' };
        break;
      case 'multiple-choice':
        newContent = { question: '', options: ['', ''] };
        break;
      case 'grammar':
        newContent = { sentence: '', blankPosition: 0 };
        break;
      case 'translation':
        newContent = { source: '', targetLanguage: 'en' };
        break;
      case 'reading':
        newContent = { passage: '', question: '' };
        break;
      default:
        newContent = { description: '' };
    }
    setFormData(prev => ({
      ...prev,
      type,
      content: newContent,
      correctAnswer: type === 'spelling' ? (newContent.word ?? '') : prev.correctAnswer,
      userAnswer: type === 'spelling' ? (newContent.wrongSpelling ?? '') : prev.userAnswer
    }));
  };

  // 单词拼写题自动同步正确答案、错误答案
  useEffect(() => {
    if (formData.type === 'spelling') {
      const word = formData.content.word?.trim().toLowerCase() || '';
      const wrongSpelling = formData.content.wrongSpelling?.trim() || '';

      // 自动同步正确答案
      setFormData(prev => ({
        ...prev,
        correctAnswer: word,
        userAnswer: wrongSpelling
      }));
    }
  }, [formData.type, formData.content.word, formData.content.wrongSpelling]);

  // 添加标签
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  // 添加关联单词
  const handleAddWord = () => {
    if (newWord.trim() && !formData.relatedWords.includes(newWord.trim().toLowerCase())) {
      setFormData(prev => ({ ...prev, relatedWords: [...prev.relatedWords, newWord.trim().toLowerCase()] }));
      setNewWord('');
    }
  };

  // 删除关联单词
  const handleRemoveWord = (word: string) => {
    setFormData(prev => ({ ...prev, relatedWords: prev.relatedWords.filter(w => w !== word) }));
  };

  // 添加选择题选项
  const handleAddOption = () => {
    if (formData.type !== 'word-choice' && formData.type !== 'multiple-choice') return;
    if ((formData.content.options ?? []).length >= MAX_CHOICE_OPTIONS) return;
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        options: [...(prev.content.options ?? []), '']
      }
    }));
  };

  // 删除选择题选项
  const handleRemoveOption = (index: number) => {
    if (formData.type !== 'word-choice' && formData.type !== 'multiple-choice') return;
    if ((formData.content.options ?? []).length <= MIN_CHOICE_OPTIONS) return;
    setFormData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        options: (prev.content.options ?? []).filter((_: string, i: number) => i !== index)
      }
    }));
  };

  // 自动生成标签
  const handleGenerateTags = async () => {
    if (!formData.type || !formData.correctAnswer) {
      setError('请先填写题目内容和正确答案');
      return;
    }

    setIsGeneratingTags(true);
    setError('');

    try {
      const response = await fetch('/api/error-questions/generate-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          content: formData.content,
          correctAnswer: formData.correctAnswer,
          userAnswer: formData.userAnswer,
          errorReason: formData.errorReason,
          relatedWords: formData.relatedWords,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // 合并新生成的标签，去重
        setFormData(prev => ({
          ...prev,
          tags: [...new Set([...prev.tags, ...data.tags])] as string[],
        }));
      }
    } catch (err) {
      console.error('Generate tags error:', err);
      setError('生成标签失败，请手动添加');
    } finally {
      setIsGeneratingTags(false);
    }
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const choiceOptions = (formData.content.options ?? [])
        .map((option: string) => option.trim())
        .filter(Boolean);

      const submitData = {
        ...formData,
        content: formData.type === 'multiple-choice'
          ? {
              ...formData.content,
              options: choiceOptions,
            }
          : formData.content,
      };

      if (submitData.type === 'multiple-choice' && choiceOptions.length < MIN_CHOICE_OPTIONS) {
        throw new Error('单项选择题至少需要填写 A、B 两个选项');
      }

      const response = await fetch('/api/error-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '提交失败');
      }

      // 提交成功，跳转到错题列表页
      router.push('/error-questions');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 未登录显示登录提示
  if (!user) {
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
          <div className="flex items-center gap-3">
            <Link href="/error-questions">
              <Button variant="ghost" size="sm" className="p-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              错题本
            </Link>
          </div>
          <div className="flex items-center gap-3">
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
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user.nickname}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">录入错题</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-6">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="type" className="text-base font-medium">
                  选择题型
                </Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="type" className="h-12 text-base">
                    <SelectValue placeholder="选择题型" />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value} className="text-base">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Form Fields Based on Type */}
              {/* 单词拼写题 */}
              {formData.type === 'spelling' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="word" className="text-base font-medium">单词</Label>
                    <Input
                      id="word"
                      value={formData.content.word}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, word: e.target.value } }))}
                      onBlur={() => {
                        // 输入完成失去焦点时才自动添加关联单词，避免输入过程中每个字符都被添加
                        const word = formData.content.word?.trim().toLowerCase() || '';
                        if (word.length >= 2 && !formData.relatedWords.includes(word)) {
                          setFormData(prev => ({
                            ...prev,
                            relatedWords: [...new Set([...prev.relatedWords, word])] as string[]
                          }));
                        }
                      }}
                      placeholder="例如：apple"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hint" className="text-base font-medium">中文提示</Label>
                    <Input
                      id="hint"
                      value={formData.content.hint || ''}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, hint: e.target.value } }))}
                      placeholder="例如：苹果"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wrongSpelling" className="text-base font-medium">错误拼写（选填）</Label>
                    <Input
                      id="wrongSpelling"
                      value={formData.content.wrongSpelling}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, wrongSpelling: e.target.value } }))}
                      placeholder="孩子写错的拼写，例如：appel"
                    />
                  </div>
                </div>
              )}

              {/* 单项选择题 */}
              {formData.type === 'multiple-choice' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question" className="text-base font-medium">题目</Label>
                    <Textarea
                      id="question"
                      value={formData.content.question}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, question: e.target.value } }))}
                      placeholder="输入题目内容"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-medium">选项（A/B 必填，C-F 选填）</Label>
                    {(formData.content.options ?? []).map((option: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={option}
                          onChange={e => {
                            const newOptions = [...(formData.content.options ?? [])];
                            newOptions[index] = e.target.value;
                            setFormData(prev => ({ ...prev, content: { ...prev.content, options: newOptions } }));
                          }}
                          placeholder={`选项 ${String.fromCharCode(65 + index)}`}
                          required={index < MIN_CHOICE_OPTIONS}
                        />
                        {(formData.content.options ?? []).length > MIN_CHOICE_OPTIONS && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveOption(index)}
                            className="px-2 text-red-500 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {(formData.content.options ?? []).length < MAX_CHOICE_OPTIONS && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddOption}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        添加选项 {String.fromCharCode(65 + (formData.content.options ?? []).length)}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* 语法填空题 */}
              {formData.type === 'grammar' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sentence" className="text-base font-medium">句子</Label>
                    <Textarea
                      id="sentence"
                      value={formData.content.sentence}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, sentence: e.target.value } }))}
                      placeholder="输入句子，用____表示空白处，例如：I ____ to school every day."
                      rows={2}
                      required
                    />
                  </div>
                </div>
              )}

              {/* 翻译/连词成句题 */}
              {formData.type === 'translation' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="source" className="text-base font-medium">原文</Label>
                    <Textarea
                      id="source"
                      value={formData.content.source}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, source: e.target.value } }))}
                      placeholder="输入需要翻译或者连词成句的内容"
                      rows={3}
                      required
                    />
                  </div>
                </div>
              )}

              {/* 阅读理解题 */}
              {formData.type === 'reading' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="passage" className="text-base font-medium">短文</Label>
                    <Textarea
                      id="passage"
                      value={formData.content.passage}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, passage: e.target.value } }))}
                      placeholder="输入阅读短文内容"
                      rows={5}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="readingQuestion" className="text-base font-medium">问题</Label>
                    <Textarea
                      id="readingQuestion"
                      value={formData.content.question}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, question: e.target.value } }))}
                      placeholder="输入针对短文的问题"
                      rows={2}
                      required
                    />
                  </div>
                </div>
              )}

              {/* 自定义题型 */}
              {formData.type === 'custom' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base font-medium">题目描述</Label>
                    <Textarea
                      id="description"
                      value={formData.content.description}
                      onChange={e => setFormData(prev => ({ ...prev, content: { ...prev.content, description: e.target.value } }))}
                      placeholder="输入题目内容"
                      rows={4}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Answers */}
              {formData.type !== 'spelling' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="correctAnswer" className="text-base font-medium">正确答案</Label>
                    <Textarea
                      id="correctAnswer"
                      value={formData.correctAnswer}
                      onChange={e => setFormData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                      placeholder="输入正确答案"
                      rows={2}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userAnswer" className="text-base font-medium">孩子的错误答案（选填）</Label>
                    <Textarea
                      id="userAnswer"
                      value={formData.userAnswer}
                      onChange={e => setFormData(prev => ({ ...prev, userAnswer: e.target.value }))}
                      placeholder="输入孩子做错的答案"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="errorReason" className="text-base font-medium">错误原因（选填）</Label>
                <Textarea
                  id="errorReason"
                  value={formData.errorReason}
                  onChange={e => setFormData(prev => ({ ...prev, errorReason: e.target.value }))}
                  placeholder="例如：拼写错误、词义混淆、语法掌握不牢、粗心大意等"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tags and Related Words */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-6">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">知识点与关联单词</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tags */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">知识点标签</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateTags}
                    disabled={isGeneratingTags}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    {isGeneratingTags ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    AI自动生成
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1 text-sm">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="输入标签，按回车添加"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button type="button" onClick={handleAddTag} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Related Words */}
              <div className="space-y-3">
                <Label className="text-base font-medium">关联单词</Label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.relatedWords.map(word => (
                    <Badge key={word} variant="outline" className="px-3 py-1 text-sm bg-blue-50 text-blue-700 border-blue-200">
                      {word}
                      <button
                        type="button"
                        onClick={() => handleRemoveWord(word)}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newWord}
                    onChange={e => setNewWord(e.target.value)}
                    placeholder="输入单词，按回车添加，例如：apple"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddWord())}
                  />
                  <Button type="button" onClick={handleAddWord} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-6">
              {error}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3">
            <Link href="/error-questions">
              <Button variant="outline" type="button" disabled={isSubmitting}>
                取消
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                '保存错题'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
