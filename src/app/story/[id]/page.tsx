'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

interface StoryImage {
  id: string;
  image_url: string;
  order_index: number;
}

interface StoryWord {
  word: string;
  translation: string;
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
  words: StoryWord[];
  wordMappings?: Record<string, string>;
}

export default function StoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStory = async () => {
      try {
        const response = await fetch(`/api/stories/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setStory(data.story);
        } else {
          router.push('/history');
        }
      } catch (error) {
        console.error('Failed to fetch story:', error);
        router.push('/history');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchStory();
    }
  }, [params.id, router]);

  // Highlight English words in English story
  const highlightEnglishWords = (text: string, words: StoryWord[]) => {
    if (!text || !words.length) return text;

    const wordList = words.map(w => w.word);
    const escapedWords = wordList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
    
    return text.split(pattern).map((part, index) => {
      const isTargetWord = wordList.some(w => w.toLowerCase() === part.toLowerCase());
      if (isTargetWord) {
        return (
          <span
            key={index}
            style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fef2f2', padding: '0 2px', borderRadius: '2px' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Highlight Chinese words in translation
  const highlightChineseWords = (text: string, wordMappings: Record<string, string> | undefined) => {
    if (!text) return text;

    if (!wordMappings || Object.keys(wordMappings).length === 0) {
      return text;
    }

    // Get all Chinese translations from wordMappings
    const chineseWords = Object.values(wordMappings).filter(w => w && w.trim());
    if (chineseWords.length === 0) {
      return text;
    }

    const escapedWords = chineseWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escapedWords.join('|')})`, 'g');
    
    return text.split(pattern).map((part, index) => {
      const isTargetWord = chineseWords.includes(part);
      if (isTargetWord) {
        return (
          <span
            key={index}
            style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fef2f2', padding: '0 2px', borderRadius: '2px' }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const exportToPDF = async () => {
    if (!contentRef.current) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await domToPng(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = dataUrl;
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (img.height * imgWidth) / img.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`单词故事_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('导出PDF失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToImage = async () => {
    if (!contentRef.current) return;
    
    setIsExporting(true);
    try {
      const dataUrl = await domToPng(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `单词故事_${new Date().toLocaleDateString()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Image export error:', error);
      alert('导出图片失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!story) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #eff6ff, #ffffff, #faf5ff)' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/history" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
            <ArrowLeft style={{ width: '20px', height: '20px' }} />
            <span>返回历史</span>
          </Link>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button onClick={exportToPDF} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#3b82f6', color: '#ffffff' }}>
              <FileText style={{ width: '16px', height: '16px' }} />
              导出PDF
            </Button>
            <Button onClick={exportToImage} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#9333ea', color: '#ffffff' }}>
              <ImageIcon style={{ width: '16px', height: '16px' }} />
              导出图片
            </Button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '16px' }}>
        {/* Meta info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
          <span>创建于 {formatDate(story.created_at)}</span>
        </div>

        {/* Content */}
        <div 
          ref={contentRef} 
          style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        >
          {/* English Story */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '32px', height: '32px', backgroundColor: '#dbeafe', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  📖
                </span>
                English Story
              </h2>
              <div style={{ fontSize: '1.125rem', lineHeight: 1.75, color: '#374151' }}>
                {story.story_en.split('\n\n').map((paragraph, index) => (
                  <p key={index} style={{ marginBottom: '16px', textAlign: 'justify' }}>
                    {highlightEnglishWords(paragraph, story.words)}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Images */}
          {story.story_images && story.story_images.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <div style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '32px', height: '32px', backgroundColor: '#f3e8ff', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    🎨
                  </span>
                  Story Illustrations
                </h2>
                <div style={{ 
                  display: 'grid', 
                  gap: '16px',
                  gridTemplateColumns: story.story_images.length === 1 ? '1fr' : 'repeat(2, 1fr)'
                }}>
                  {story.story_images.map((image, index) => (
                    <div key={image.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <img src={image.image_url} alt={`Illustration ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#ffffff', padding: '4px 8px', borderRadius: '8px', fontSize: '14px' }}>
                        {index + 1} / {story.story_images.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chinese Translation */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '32px', height: '32px', backgroundColor: '#dcfce7', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  🌏
                </span>
                中文翻译
              </h2>
              <div style={{ fontSize: '1.125rem', lineHeight: 1.75, color: '#374151' }}>
                {story.story_zh.split('\n\n').map((paragraph, index) => (
                  <p key={index} style={{ marginBottom: '16px', textAlign: 'justify' }}>
                    {highlightChineseWords(paragraph, story.wordMappings)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
