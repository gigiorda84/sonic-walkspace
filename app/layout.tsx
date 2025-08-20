import './(styles)/globals.css';

export const metadata = { title: "Sonic Walkscape" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head><link rel="preconnect" href="https://unpkg.com" /></head>
      <body>{children}</body>
    </html>
  );
}
