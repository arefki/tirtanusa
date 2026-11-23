import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TirtaNusa — SDG 6 Water Tracker for Indonesia',
  description:
    'Where does Indonesia stand on clean water? An interactive atlas of drinking-water access across all 38 provinces, community water-condition reports, and the road to SDG 6 by 2030.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
