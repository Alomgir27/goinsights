"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e5e5]">
      <div className="container h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-[#1a1a1a]">
            GoInsights
          </Link>
          
          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <NavLink href="/" label="Home" active={pathname === "/"} />
            <NavLink href="/projects" label="Projects" active={pathname === "/projects"} />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-sm text-[#666] hover:text-[#1a1a1a] transition-colors">
            My Projects
          </Link>
          <Link href="/" className="btn-primary text-sm py-2.5 px-5">
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
