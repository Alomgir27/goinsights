import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ToastContainer } from "@/components/Toast";

export const metadata: Metadata = {
  title: "GoInsights - AI YouTube Video Analysis",
  description: "Transform YouTube videos into engaging content with AI"
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        <Navbar />
        {children}
        <ToastContainer />
        
        {/* Footer - Mobbin style */}
        <footer className="border-t border-[#e5e5e5] py-8 px-6 bg-white">
          <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <span className="text-sm font-semibold text-[#1a1a1a]">GoInsights</span>
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
