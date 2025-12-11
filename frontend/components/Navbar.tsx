"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Youtube } from "lucide-react";

export default function Navbar(): React.ReactElement {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled ? "py-2" : "py-4"
    }`}>
      <div className={`mx-auto transition-all duration-500 ease-out ${
        isScrolled 
          ? "max-w-2xl bg-white/70 backdrop-blur-xl border border-white/40 shadow-lg shadow-black/5 rounded-full px-4" 
          : "max-w-7xl px-6"
      }`}>
        <div className={`flex items-center justify-between transition-all duration-500 ${
          isScrolled ? "h-12 gap-4" : "h-16 gap-8"
        }`}>
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.svg" alt="ZapClip" width={isScrolled ? 24 : 32} height={isScrolled ? 24 : 32} className="transition-all duration-300" />
            <span className={`font-bold text-[#1a1a1a] transition-all duration-300 ${isScrolled ? "text-base" : "text-xl"}`}>
              ZapClip
            </span>
          </Link>
          
          <div className={`hidden md:flex items-center transition-all duration-500 ${isScrolled ? "gap-3" : "gap-6"}`}>
            <NavLink href="/" label="Home" active={pathname === "/"} compact={isScrolled} />
            <NavLink href="/projects" label="Projects" active={pathname?.startsWith("/projects") || pathname?.startsWith("/workspace")} compact={isScrolled} />
            <NavLink href="/connect" label="Connect" active={pathname === "/connect"} compact={isScrolled} />
          </div>

          <div className={`flex items-center transition-all duration-500 ${isScrolled ? "gap-2" : "gap-4"}`}>
            {!isScrolled && (
              <Link href="/connect" className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors font-medium">
                <Youtube className="w-4 h-4" />
                <span className="hidden sm:inline">Connect YouTube</span>
              </Link>
            )}
            <Link href="/projects/new" className={`bg-[#1a1a1a] text-white font-semibold rounded-full transition-all duration-300 hover:bg-[#333] ${
              isScrolled ? "text-xs py-2 px-4" : "text-sm py-2.5 px-5"
            }`}>
              New Project
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label, active, compact }: { href: string; label: string; active: boolean; compact: boolean }): React.ReactElement {
  return (
    <Link
      href={href}
      className={`font-medium transition-all duration-300 ${
        compact ? "text-xs" : "text-sm"
      } ${active ? "text-[#1a1a1a]" : "text-[#666] hover:text-[#1a1a1a]"}`}
    >
      {label}
    </Link>
  );
}
