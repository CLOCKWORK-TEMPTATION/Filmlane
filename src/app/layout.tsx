import type { Metadata } from 'next';
import './globals.css';
import './ui-kit.css';
import { ThemeProvider } from '@/providers';
import { Toaster } from '@/components/ui/toaster';


export const metadata: Metadata = {
  title: 'محرر السيناريو العربي',
  description: 'محرر سيناريو متقدم للكتابة العربية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
