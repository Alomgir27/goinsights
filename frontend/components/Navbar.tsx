"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Youtube } from "lucide-react";

export default function Navbar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e5e5]">
      <div className="container h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="GoInsights" width={32} height={32} />
            <span className="text-xl font-bold text-[#1a1a1a]">GoInsights</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <NavLink href="/" label="Home" active={pathname === "/"} />
            <NavLink href="/projects" label="Projects" active={pathname?.startsWith("/projects") || pathname?.startsWith("/workspace")} />
            <NavLink href="/connect" label="Connect" active={pathname === "/connect"} />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/connect" className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors font-medium">
            <Youtube className="w-4 h-4" />
            <span className="hidden sm:inline">Connect YouTube</span>
          </Link>
          <Link href="/projects/new" className="btn-primary text-sm py-2.5 px-5">
            New Project
          </Link>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }): React.ReactElement {
  return (
    <Link
      href={href}
      className={`text-sm font-medium transition-colors ${
        active ? "text-[#1a1a1a]" : "text-[#666] hover:text-[#1a1a1a]"
      }`}
    >
      {label}
    </Link>
  );
}
