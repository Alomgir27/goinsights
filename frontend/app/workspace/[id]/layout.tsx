"use client";

import React from "react";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="workspace-layout">
      <style jsx global>{`
        .workspace-layout ~ footer,
        body > nav {
          display: none !important;
        }
      `}</style>
      {children}
    </div>
  );
}
