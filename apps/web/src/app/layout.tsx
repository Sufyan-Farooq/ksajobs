import type { Metadata } from 'next';
import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { LanguageProvider } from '../context/LanguageContext';

export const metadata: Metadata = {
  title: 'KSA Jobs - Saudi Arabia Careers & Job Openings',
  description:
    'The premier job aggregation platform in Saudi Arabia. Browse verified career vacancies across Riyadh, Jeddah, Dammam, NEOM, and all KSA regions for locals and expats with instant WhatsApp job alerts.',
  keywords: [
    'KSA Jobs',
    'Jobs in Saudi Arabia',
    'Riyadh Jobs',
    'Jeddah Jobs',
    'NEOM Jobs',
    'Saudization',
    'Saudi Careers',
  ],
  openGraph: {
    title: 'KSA Jobs - Saudi Arabia Careers Portal',
    description: 'Latest verified job openings in Saudi Arabia with direct apply and WhatsApp alerts.',
    url: 'https://ksajobs.app',
    siteName: 'KSA Jobs',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
        <LanguageProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
