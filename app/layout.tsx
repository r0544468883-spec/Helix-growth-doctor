import type { Metadata } from 'next';
import './globals.css';
import HelixCommandBar from '@/components/HelixCommandBar';

export const metadata: Metadata = {
  title: 'HELIX Growth Doctor',
  description: 'מאבחן איפה מאבדים לקוחות — ומתקן. CRO + שימור, בעברית, עם פרטיות.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <HelixCommandBar />
      </body>
    </html>
  );
}
