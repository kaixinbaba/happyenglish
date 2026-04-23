'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, FileText, Image as ImageIcon } from 'lucide-react';
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
  isGeneratingImages?: boolean;
}

// --- Image compression helpers ---

const COMPRESS_QUALITY = 0.75;
const MAX_IMG_WIDTH = 800;
const MAX_IMG_HEIGHT = 800;

/** Fetch image through CORS proxy, return a compressed JPEG data-URL */
async function fetchAndCompressImage(url: string): Promise<string> {
  const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
  if (!resp.ok) return url;
  const { dataUrl } = await resp.json();
  return compressDataUrl(dataUrl);
}

/** Resize & re-encode a data-URL to JPEG */
function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { naturalWidth: w, naturalHeight: h } = img;

      if (w > MAX_IMG_WIDTH) {
        const ratio = MAX_IMG_WIDTH / w;
        w = MAX_IMG_WIDTH;
        h = Math.round(h * ratio);
      }
      if (h > MAX_IMG_HEIGHT) {
        const ratio = MAX_IMG_HEIGHT / h;
        h = MAX_IMG_HEIGHT;
        w = Math.round(w * ratio);
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', COMPRESS_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// --- jsPDF layout constants ---

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM_LIMIT = PAGE_H - MARGIN - 12; // leave room for footer
const COLOR_BLUE = [37, 99, 235] as const;
const COLOR_RED = [220, 38, 38] as const;
const COLOR_GRAY = [55, 65, 81] as const;
const COLOR_LIGHT_GRAY = [107, 114, 128] as const;

/** Simple text wrapping for canvas */
function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    const test = current + char;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// --- PDF Building ---

/** Estimate total content height at scale=1 to determine fit ratio */
async function computeScale(result: GenerateResult): Promise<number> {
  const { story, translation, images } = result;
  const AVAILABLE = PAGE_H - MARGIN * 2 - 14;
  let h = 22; // header (title + word tags)

  // English story: accurate line measurement via temp jsPDF
  const tmp = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  tmp.setFont('helvetica', 'normal');
  tmp.setFontSize(10);
  h += 12; // section heading
  for (const para of story.split(/\n\n+/).filter(p => p.trim())) {
    h += tmp.splitTextToSize(para, CONTENT_W).length * 6 + 2;
  }
  h += 4;

  // Images
  if (images.length > 0) {
    const iw = (CONTENT_W - 4) / 2;
    h += 12 + Math.ceil(images.length / 2) * (iw * 0.75 + 4) + 6;
  }

  // Chinese translation estimate (~18 chars/line at 6.4mm/line)
  h += 12;
  const seenEst = new Set<string>();
  for (const para of translation.split(/\n+/).filter(p => p.trim())) {
    const key = para.trim().slice(0, 50);
    if (seenEst.has(key)) continue;
    seenEst.add(key);
    h += Math.max(1, Math.ceil(para.length / 18)) * 6.4 + 3.2;
  }

  return h > AVAILABLE ? Math.max(0.55, AVAILABLE / h) : 1.0;
}

async function buildPDF(result: GenerateResult): Promise<jsPDF> {
  const { story, translation, images, words, wordMappings } = result;

  // Compute layout scale so all content fits on one page
  const s = await computeScale(result);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let cursorY = MARGIN;

  const addNewPage = () => {
    pdf.addPage();
    cursorY = MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > BOTTOM_LIMIT) addNewPage();
  };

  const hGap = Math.max(8, 12 * s);
  const drawHeading = (title: string) => {
    ensureSpace(hGap + 4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(9, 12 * s));
    pdf.setTextColor(...COLOR_BLUE);
    pdf.text(title, MARGIN, cursorY + Math.max(4, 5 * s));
    pdf.setDrawColor(220, 230, 250);
    pdf.setLineWidth(0.5);
    const lineY = cursorY + Math.max(5, 7 * s);
    pdf.line(MARGIN, lineY, PAGE_W - MARGIN, lineY);
    cursorY += hGap;
    pdf.setTextColor(0, 0, 0);
  };

  // ====== Title row ======
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(Math.max(12, 18 * s));
  pdf.setTextColor(...COLOR_BLUE);
  pdf.text('Word Story', MARGIN, cursorY + 5);
  pdf.setFontSize(9);
  pdf.setTextColor(...COLOR_LIGHT_GRAY);
  const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  pdf.text(dateStr, PAGE_W - MARGIN, cursorY + 4, { align: 'right' });
  cursorY += 12;

  // ====== Word tags ======
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...COLOR_GRAY);
  pdf.text('Target Words:', MARGIN, cursorY);
  let currentX = MARGIN + pdf.getTextWidth('Target Words:  ');
  pdf.setFontSize(9);
  for (const word of words) {
    const tw = pdf.getTextWidth(word) + 6;
    if (currentX + tw > PAGE_W - MARGIN) { currentX = MARGIN; cursorY += 7; ensureSpace(10); }
    pdf.setFillColor(59, 130, 246);
    pdf.roundedRect(currentX, cursorY - 3.5, tw, 5, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text(word, currentX + 3, cursorY + 0.2);
    currentX += tw + 2;
  }
  cursorY += 10;

  // ====== SECTION 1: English Story ======
  drawHeading('English Story');
  const enFontSize = Math.max(7, 10 * s);
  const enLineHeight = Math.max(4.5, 6 * s);
  pdf.setFontSize(enFontSize);
  const lowerTargetWords = words.map(w => w.toLowerCase());
  const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const wordRegex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
  const paras = story.split(/\n\n+/).filter(p => p.trim());
  for (const para of paras) {
    ensureSpace(enLineHeight * 2);
    const tokens: { text: string; isTarget: boolean }[] = [];
    para.split(wordRegex).forEach((seg) => {
      if (!seg) return;
      if (lowerTargetWords.includes(seg.toLowerCase())) {
        tokens.push({ text: seg, isTarget: true });
      } else {
        seg.split(/(\s+)/).forEach(p => { if (p) tokens.push({ text: p, isTarget: false }); });
      }
    });
    let x = MARGIN;
    pdf.setFont('helvetica', 'normal');
    const spaceWidth = pdf.getTextWidth('x x') - pdf.getTextWidth('xx');
    for (const token of tokens) {
      let tw = pdf.getTextWidth(token.text);
      if (/^\s+$/.test(token.text)) {
        tw = spaceWidth * token.text.length;
      }
      if (x + tw > PAGE_W - MARGIN && !/^\s+$/.test(token.text)) { x = MARGIN; cursorY += enLineHeight; ensureSpace(enLineHeight); }
      if (token.isTarget) {
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLOR_RED);
        pdf.setFillColor(254, 242, 242);
        pdf.rect(x - 0.5, cursorY - enLineHeight * 0.6, tw + 1, enLineHeight * 0.75, 'F');
        pdf.text(token.text, x, cursorY);
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...COLOR_GRAY);
        if (!/^\s+$/.test(token.text)) {
          pdf.text(token.text, x, cursorY);
        }
      }
      x += tw;
    }
    cursorY += enLineHeight + Math.max(1, 2 * s);
  }
  cursorY += Math.max(2, 4 * s);

  // ====== SECTION 2: Story Illustrations ======
  if (images.length > 0) {
    drawHeading('Story Illustrations');
    const compressedImages: string[] = [];
    for (const url of images) {
      try { compressedImages.push(await fetchAndCompressImage(url)); }
      catch { compressedImages.push(url); }
    }
    const imgGap = 4;
    // Scale image dimensions uniformly to maintain aspect ratio
    const baseImgW = (CONTENT_W - imgGap) / 2;
    const imgWidth = baseImgW * Math.max(s, 0.6);
    const imgHeight = imgWidth * 0.75;
    for (let i = 0; i < compressedImages.length; i += 2) {
      ensureSpace(imgHeight + 10);
      await pdf.addImage(compressedImages[i], 'JPEG', MARGIN, cursorY, imgWidth, imgHeight);
      if (i + 1 < compressedImages.length) {
        await pdf.addImage(compressedImages[i+1], 'JPEG', MARGIN + imgWidth + imgGap, cursorY, imgWidth, imgHeight);
      }
      cursorY += imgHeight + imgGap;
    }
    cursorY += Math.max(3, 6 * s);
  }

  // ====== SECTION 3: Chinese Translation ======
  drawHeading('Chinese Translation');
  const PX_PER_MM = 5;
  const canvasWidth = CONTENT_W * PX_PER_MM;
  const cnFontSize = Math.max(12, Math.round(20 * s));
  const ctxLineHeight = cnFontSize * 1.6;
  const chineseMappings = wordMappings ? Object.values(wordMappings).filter(v => v && v.trim()) : [];
  const escapedCn = chineseMappings.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const cnRegex = escapedCn.length > 0 ? new RegExp(`(${escapedCn.join('|')})`, 'g') : null;
  const rawParas = translation.split(/\n+/).filter(p => p.trim());
  const dedupedParas: string[] = [];
  const seenCn = new Set<string>();
  for (const p of rawParas) {
    const key = p.trim().slice(0, 50);
    if (!seenCn.has(key)) { seenCn.add(key); dedupedParas.push(p); }
  }
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = canvasWidth;
  const mctx = measureCanvas.getContext('2d')!;
  mctx.font = `${cnFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  let totalPxHeight = 20;
  const linesToDraw: { tokens: {text: string, isTarget: boolean, x: number}[], y: number }[] = [];
  for (const para of dedupedParas) {
    const tokens: { text: string, isTarget: boolean }[] = [];
    if (cnRegex) {
      para.split(cnRegex).forEach(seg => {
        if (seg) tokens.push({ text: seg, isTarget: chineseMappings.includes(seg) });
      });
    } else {
      tokens.push({ text: para, isTarget: false });
    }
    let currentLineTokens: {text: string, isTarget: boolean, x: number}[] = [];
    let curX = 0;
    for (const token of tokens) {
      const chars = token.isTarget ? [token.text] : token.text.split('');
      for (const char of chars) {
        const charW = mctx.measureText(char).width;
        if (curX + charW > canvasWidth) {
          linesToDraw.push({ tokens: currentLineTokens, y: totalPxHeight + cnFontSize });
          totalPxHeight += ctxLineHeight;
          currentLineTokens = [];
          curX = 0;
        }
        const lastToken = currentLineTokens[currentLineTokens.length - 1];
        if (lastToken && !lastToken.isTarget && !token.isTarget) { lastToken.text += char; }
        else { currentLineTokens.push({ text: char, isTarget: token.isTarget, x: curX }); }
        curX += charW;
      }
    }
    if (currentLineTokens.length > 0) {
      linesToDraw.push({ tokens: currentLineTokens, y: totalPxHeight + cnFontSize });
      totalPxHeight += ctxLineHeight;
    }
    totalPxHeight += cnFontSize * 0.8;
  }
  const cnCanvas = document.createElement('canvas');
  cnCanvas.width = canvasWidth;
  cnCanvas.height = totalPxHeight;
  const ctx = cnCanvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cnCanvas.width, cnCanvas.height);
  ctx.font = `${cnFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  for (const line of linesToDraw) {
    for (const token of line.tokens) {
      const tw = ctx.measureText(token.text).width;
      if (token.isTarget) {
        ctx.fillStyle = '#fef2f2'; ctx.fillRect(token.x - 1, line.y - cnFontSize + 2, tw + 2, cnFontSize + 2);
        ctx.fillStyle = '#dc2626'; ctx.font = `bold ${cnFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.fillText(token.text, token.x, line.y); ctx.font = `${cnFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      } else {
        ctx.fillStyle = '#374151'; ctx.fillText(token.text, token.x, line.y);
      }
    }
  }
  let remainingPx = cnCanvas.height;
  let currentSrcY = 0;
  while (remainingPx > 0) {
    const availMm = BOTTOM_LIMIT - cursorY;
    if (availMm < 10) { addNewPage(); continue; }
    const availPx = availMm * PX_PER_MM;
    const slicePx = Math.min(remainingPx, availPx);
    if (slicePx <= 0) break;
    const sliceMm = slicePx / PX_PER_MM;
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasWidth; sliceCanvas.height = slicePx;
    const sctx = sliceCanvas.getContext('2d')!;
    sctx.drawImage(cnCanvas, 0, currentSrcY, canvasWidth, slicePx, 0, 0, canvasWidth, slicePx);
    await pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, cursorY, CONTENT_W, sliceMm);
    cursorY += sliceMm; currentSrcY += slicePx; remainingPx -= slicePx;
    if (remainingPx > 0 && cursorY >= BOTTOM_LIMIT - 5) addNewPage();
  }

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOR_LIGHT_GRAY);
    pdf.text('Generated by AI - For learning purposes only', PAGE_W / 2, PAGE_H - 6, { align: 'center' });
    pdf.text(`${i} / ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
  }
  return pdf;
}

// --- Main Component ---

export default function ResultPage({ result, onReset, isGeneratingImages = false }: ResultPageProps) {
  const { story, translation, images, words, wordMappings } = result;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Highlight target words in the English story (for display)
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

  // Highlight Chinese translations based on wordMappings (for display)
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

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = await buildPDF(result);
      pdf.save(`word_story_${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF 导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToImage = async () => {
    setIsExporting(true);
    try {
      const width = 800;
      const padding = 40;
      const contentWidth = width - padding * 2;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      const tctx = tempCanvas.getContext('2d')!;
      
      let curY = padding;

      // Measure height
      tctx.font = 'bold 32px "PingFang SC", sans-serif';
      curY += 60; // Title + gap
      
      tctx.font = '16px "PingFang SC", sans-serif';
      curY += 40; // Words + gap
      
      tctx.font = '18px Helvetica, sans-serif';
      const enParas = story.split(/\n\n+/).filter(p => p.trim());
      for (const p of enParas) {
        const lines = wrapCanvasText(tctx, p, contentWidth);
        curY += lines.length * 28 + 24;
      }
      
      if (images.length > 0) {
        curY += 60; // Heading
        const imgHeight = contentWidth * 0.75;
        curY += Math.ceil(images.length / 2) * (imgHeight + 24);
      }
      
      tctx.font = '18px "PingFang SC", sans-serif';
      const cnParas = translation.split(/\n+/).filter(p => p.trim());
      const seen = new Set<string>();
      for (const p of cnParas) {
        const key = p.trim().slice(0, 50);
        if (seen.has(key)) continue;
        seen.add(key);
        const lines = wrapCanvasText(tctx, p, contentWidth);
        curY += lines.length * 32 + 24;
      }
      
      curY += padding + 40; // Footer

      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = curY * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, curY);
      
      let y = padding;

      // Draw Title
      ctx.font = 'bold 32px "PingFang SC", sans-serif';
      ctx.fillStyle = '#2563eb';
      ctx.fillText('单词故事', padding, y + 32);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText(new Date().toLocaleDateString(), width - padding - 80, y + 25);
      y += 80;

      // Draw Words
      ctx.font = 'bold 16px "PingFang SC", sans-serif';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('学习单词：', padding, y);
      let wx = padding + ctx.measureText('学习单词：').width + 10;
      ctx.font = '14px sans-serif';
      for (const word of words) {
        const tw = ctx.measureText(word).width + 24;
        if (wx + tw > width - padding) { wx = padding; y += 35; }
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.roundRect(wx, y - 18, tw, 24, 12); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(word, wx + 12, y);
        wx += tw + 10;
      }
      y += 60;

      // Draw English Story
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#2563eb';
      ctx.fillText('English Story', padding, y);
      y += 12;
      ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
      y += 40;

      const escapedWords = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const wordRegex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
      const lowerWords = words.map(w => w.toLowerCase());

      for (const p of enParas) {
        const tokens: {text: string, isTarget: boolean}[] = [];
        p.split(wordRegex).forEach(seg => {
          if (!seg) return;
          if (lowerWords.includes(seg.toLowerCase())) tokens.push({ text: seg, isTarget: true });
          else seg.split(/(\s+)/).forEach(part => { if (part) tokens.push({ text: part, isTarget: false }); });
        });

        let lx = padding;
        for (const token of tokens) {
          ctx.font = token.isTarget ? 'bold 18px Helvetica' : '18px Helvetica';
          const tw = ctx.measureText(token.text).width;
          if (lx + tw > width - padding && !/^\s+$/.test(token.text)) { lx = padding; y += 28; }
          if (token.isTarget) {
            ctx.fillStyle = '#fef2f2'; ctx.fillRect(lx - 2, y - 18, tw + 4, 24);
            ctx.fillStyle = '#dc2626';
          } else { ctx.fillStyle = '#374151'; }
          ctx.fillText(token.text, lx, y);
          lx += tw;
        }
        y += 48;
      }

      // Draw Images
      if (images.length > 0) {
        y += 20;
        ctx.font = 'bold 22px "PingFang SC", sans-serif';
        ctx.fillStyle = '#2563eb';
        ctx.fillText('故事插图', padding, y);
        y += 12;
        ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
        y += 40;
        const imgGap = 20;
        const imgW = (contentWidth - imgGap) / 2;
        const imgH = imgW * 0.75;
        for (let i = 0; i < images.length; i += 2) {
          const drawImg = async (url: string, x: number) => {
            try {
              const resp = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
              if (!resp.ok) return null;
              const { dataUrl } = await resp.json();
              return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => { ctx.drawImage(img, x, y, imgW, imgH); resolve(null); };
                img.onerror = () => resolve(null);
                img.src = dataUrl;
              });
            } catch (e) {
              console.error('Image proxy failed', e);
              return null;
            }
          };
          await drawImg(images[i], padding);
          if (i + 1 < images.length) await drawImg(images[i+1], padding + imgW + imgGap);
          y += imgH + imgGap;
        }
        y += 20;
      }

      // Draw Chinese Translation
      ctx.font = 'bold 22px "PingFang SC", sans-serif';
      ctx.fillStyle = '#2563eb';
      ctx.fillText('中文翻译', padding, y);
      y += 12;
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
      y += 40;
      seen.clear();
      const chineseMappings = wordMappings ? Object.values(wordMappings).filter(v => v && v.trim()) : [];
      const escapedCn = chineseMappings.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const cnRegex = escapedCn.length > 0 ? new RegExp(`(${escapedCn.join('|')})`, 'g') : null;

      for (const p of cnParas) {
        const key = p.trim().slice(0, 50);
        if (seen.has(key)) continue;
        seen.add(key);
        const tokens: {text: string, isTarget: boolean}[] = [];
        if (cnRegex) p.split(cnRegex).forEach(seg => { if (seg) tokens.push({ text: seg, isTarget: chineseMappings.includes(seg) }); });
        else tokens.push({ text: p, isTarget: false });
        let lx = padding;
        for (const token of tokens) {
          const chars = token.isTarget ? [token.text] : token.text.split('');
          for (const char of chars) {
            ctx.font = token.isTarget ? 'bold 18px "PingFang SC", sans-serif' : '18px "PingFang SC", sans-serif';
            const cw = ctx.measureText(char).width;
            if (lx + cw > width - padding) { lx = padding; y += 32; }
            if (token.isTarget) {
              ctx.fillStyle = '#fef2f2'; ctx.fillRect(lx - 1, y - 18, cw + 2, 24);
              ctx.fillStyle = '#dc2626';
            } else { ctx.fillStyle = '#374151'; }
            ctx.fillText(char, lx, y);
            lx += cw;
          }
        }
        y += 48;
      }
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center';
      ctx.fillText('故事和插图由 AI 生成 - 仅供学习参考', width / 2, y);

      const link = document.createElement('a');
      link.download = `word_story_${new Date().getTime()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (error) {
      console.error('Image export error:', error);
      alert('图片导出失败，请重试');
    } finally {
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
              {isExporting ? '导出中...' : '导出PDF'}
            </Button>
            <Button
              onClick={exportToImage}
              disabled={isExporting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#9333ea', color: '#ffffff' }}
            >
              <ImageIcon style={{ width: '16px', height: '16px' }} />
              {isExporting ? '导出中...' : '导出图片'}
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
                fontWeight: 500,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* Content Area */}
        <div
          ref={contentRef}
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
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
          {(images.length > 0 || isGeneratingImages) && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
              <div style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '32px', height: '32px', backgroundColor: '#f3e8ff', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    🎨
                  </span>
                  Story Illustrations
                  {isGeneratingImages && (
                    <span style={{ fontSize: '14px', fontWeight: 400, color: '#9333ea', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
                      </svg>
                      正在生成插图...
                    </span>
                  )}
                </h2>
                <div style={{
                  display: 'grid',
                  gap: '16px',
                  gridTemplateColumns: Math.max(images.length, isGeneratingImages ? (result.wordMappings ? Object.keys(result.wordMappings).length : 1) : 0) === 1 ? '1fr' : 'repeat(2, 1fr)',
                }}>
                  {images.map((imageUrl, index) => (
                    <div
                      key={index}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
                  {/* Loading placeholders */}
                  {isGeneratingImages && images.length === 0 && Array.from({ length: 1 }).map((_, index) => (
                    <div
                      key={`placeholder-${index}`}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        background: 'linear-gradient(135deg, #f3e8ff, #dbeafe)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: '#9333ea', animation: 'spin 1.5s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="31.4 31.4" />
                      </svg>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>AI 绘画中...</span>
                    </div>
                  ))}
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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
                {(() => {
                  const seen = new Set<string>();
                  return translation.split(/\n+/).filter((p) => {
                    const key = p.trim().slice(0, 60);
                    if (!p.trim() || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).map((paragraph, index) => (
                    <p key={index} style={{ marginBottom: '16px', textAlign: 'justify' }}>
                      {highlightChineseWords(paragraph, wordMappings)}
                    </p>
                  ));
                })()}
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
