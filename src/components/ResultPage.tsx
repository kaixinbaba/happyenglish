'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, FileText, Image as ImageIcon } from 'lucide-react';
import { domToPng, domToJpeg } from 'modern-screenshot';
import jsPDF from 'jspdf';

interface GenerateResult {
  story: string;
  translation: string;
  images: string[];
  words: string[];
  wordMappings?: Record<string, string>;
}

interface ResultPageProps {
  result: GenerateResult;
  onReset: () => void;
}

export default function ResultPage({ result, onReset }: ResultPageProps) {
  const { story, translation, images, words, wordMappings } = result;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Highlight target words in the English story
  const highlightEnglishWords = (text: string, wordList: string[]) => {
    if (!text) return null;

    const escapedWords = wordList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
    const parts = text.split(pattern);

    return parts.map((part, index) => {
      const isTargetWord = wordList.some(
        word => word.toLowerCase() === part.toLowerCase()
      );

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
      return <span key={index}>{part}</span>;
    });
  };

  // Highlight Chinese translations based on wordMappings
  const highlightChineseWords = (text: string, mappings: Record<string, string> | undefined) => {
    if (!text) return null;

    if (!mappings || Object.keys(mappings).length === 0) {
      return <span>{text}</span>;
    }

    const chineseWords = Object.values(mappings).filter(w => w && w.trim());
    if (chineseWords.length === 0) {
      return <span>{text}</span>;
    }

    const escapedWords = chineseWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escapedWords.join('|')})`, 'g');
    const parts = text.split(pattern);

    return parts.map((part, index) => {
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
      return <span key={index}>{part}</span>;
    });
  };

  // Convert external images to data URLs to avoid CORS issues during export
  const convertImagesToDataUrls = async (): Promise<Map<HTMLImageElement, string>> => {
    const originalSrcs = new Map<HTMLImageElement, string>();
    if (!contentRef.current) return originalSrcs;

    const imgs = contentRef.current.querySelectorAll('img');
    await Promise.all(
      Array.from(imgs).map(async (img) => {
        const src = img.src;
        if (!src || src.startsWith('data:')) return;
        originalSrcs.set(img, src);
        try {
          const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
          const data = await resp.json();
          if (data.dataUrl) {
            img.src = data.dataUrl;
          }
        } catch {
          // keep original src if proxy fails
        }
      })
    );
    return originalSrcs;
  };

  const restoreImageSrcs = (originalSrcs: Map<HTMLImageElement, string>) => {
    originalSrcs.forEach((src, img) => {
      img.src = src;
    });
  };

  const exportToPDF = async () => {
    if (!contentRef.current) return;

    setIsExporting(true);
    let originalSrcs = new Map<HTMLImageElement, string>();
    try {
      // Convert external images to data URLs to avoid CORS
      originalSrcs = await convertImagesToDataUrls();

      // Use modern-screenshot to capture the content
      const dataUrl = await domToPng(contentRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Load the image to get dimensions
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
      restoreImageSrcs(originalSrcs);
      setIsExporting(false);
    }
  };

  const exportToImage = async () => {
    if (!contentRef.current) return;

    setIsExporting(true);
    let originalSrcs = new Map<HTMLImageElement, string>();
    try {
      // Convert external images to data URLs to avoid CORS
      originalSrcs = await convertImagesToDataUrls();

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
      restoreImageSrcs(originalSrcs);
      setIsExporting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #eff6ff, #ffffff, #faf5ff)', padding: '16px' }}>
      <div style={{ maxWidth: '896px', margin: '0 auto' }}>
        {/* Header with Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#2563eb' }}>
            单词故事
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Button
              onClick={onReset}
              variant="outline"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCcw style={{ width: '16px', height: '16px' }} />
              重新生成
            </Button>
            <Button
              onClick={exportToPDF}
              disabled={isExporting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#3b82f6', color: '#ffffff' }}
            >
              <FileText style={{ width: '16px', height: '16px' }} />
              导出PDF
            </Button>
            <Button
              onClick={exportToImage}
              disabled={isExporting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#9333ea', color: '#ffffff' }}
            >
              <ImageIcon style={{ width: '16px', height: '16px' }} />
              导出图片
            </Button>
          </div>
        </div>

        {/* Words Tag Cloud */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <span style={{ color: '#4b5563', fontWeight: 500 }}>学习单词：</span>
          {words.map((word, index) => (
            <span
              key={index}
              style={{ 
                padding: '4px 12px', 
                background: 'linear-gradient(to right, #3b82f6, #9333ea)', 
                color: '#ffffff', 
                borderRadius: '9999px', 
                fontSize: '14px', 
                fontWeight: 500 
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Content Area for Export */}
        <div 
          ref={contentRef} 
          style={{ 
            backgroundColor: '#ffffff', 
            padding: '24px', 
            borderRadius: '16px', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
        >
          {/* English Story Section */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '32px', height: '32px', backgroundColor: '#dbeafe', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  📖
                </span>
                English Story
              </h2>
              <div style={{ fontSize: '1.125rem', lineHeight: 1.75, color: '#374151' }}>
                {story.split('\n\n').map((paragraph, index) => (
                  <p key={index} style={{ marginBottom: '16px', textAlign: 'justify' }}>
                    {highlightEnglishWords(paragraph, words)}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Images Section */}
          {images.length > 0 && (
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
                  gridTemplateColumns: images.length === 1 ? '1fr' : 'repeat(2, 1fr)'
                }}>
                  {images.map((imageUrl, index) => (
                    <div
                      key={index}
                      style={{ 
                        position: 'relative', 
                        aspectRatio: '1', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={`Story illustration ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#ffffff', padding: '4px 8px', borderRadius: '8px', fontSize: '14px' }}>
                        {index + 1} / {images.length}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chinese Translation Section */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '32px', height: '32px', backgroundColor: '#dcfce7', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  🌏
                </span>
                中文翻译
              </h2>
              <div style={{ fontSize: '1.125rem', lineHeight: 1.75, color: '#374151' }}>
                {translation.split('\n\n').map((paragraph, index) => (
                  <p key={index} style={{ marginBottom: '16px', textAlign: 'justify' }}>
                    {highlightChineseWords(paragraph, wordMappings)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginTop: '24px' }}>
          <p>故事和图片由AI生成，仅供学习参考</p>
        </div>
      </div>
    </div>
  );
}
