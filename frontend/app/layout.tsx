import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { ToastContainer } from "@/components/Toast";

export const metadata: Metadata = {
  title: "ZapClip - AI Video Creator",
  description: "Transform YouTube videos into engaging content with AI",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        {children}
        <ToastContainer />
        
        {/* Footer */}
        <footer className="border-t border-[#e5e5e5] py-8 px-6 bg-white">
          <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/favicon.svg" alt="ZapClip" width={24} height={24} />
              <span className="text-sm font-semibold text-[#1a1a1a]">ZapClip</span>
              <span className="text-sm text-[#999]">© 2024</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-[#666] hover:text-[#1a1a1a] transition-colors">Privacy</a>
              <a href="#" className="text-sm text-[#666] hover:text-[#1a1a1a] transition-colors">Terms</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
