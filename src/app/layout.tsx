import type { Metadata } from 'next';
import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuthModal } from '@/components/auth/AuthModal';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-space-grotesk',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'AxisForge — On-Demand 3D Print Studio (.STL, .3MF, .SCAD & AI)',
    template: '%s | AxisForge Studio 01',
  },
  description:
    'Generer 3D-modeller fra tekst/bilde via AI, tilpass parametriske OpenSCAD (.scad) filer eller last opp .stl / .3mf, og bestill direkte fra vår Bambu Lab X1C print-farm.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/logo-mark.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/icon.svg'],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nb"
      className={`${spaceGrotesk.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased selection:bg-[#FF5500] selection:text-white">
        <AuthProvider>
          <Navbar />
          <AuthModal />
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
