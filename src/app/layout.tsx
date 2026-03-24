import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '儿童单词故事生成器',
    template: '%s | 儿童单词故事生成器',
  },
  description:
    '通过AI为儿童创作有趣的单词学习故事，帮助孩子轻松记忆英语单词。',
  keywords: [
    '儿童英语',
    '单词故事',
    'AI 故事生成',
    '英语学习',
    '儿童教育',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
