import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A&I Global - Client Workflow System",
  description: "Client Workflow Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}