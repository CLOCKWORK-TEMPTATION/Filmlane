import type { Metadata } from 'next';
import './globals.css';
import './ui-kit.css';
import { ThemeProvider } from '@/providers';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'محرر السيناريو العربي',
  description: 'محرر سيناريو متقدم للكتابة العربية',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
