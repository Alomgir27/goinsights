"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, ArrowRight, Folder, Plus, Clock } from "lucide-react";
import { projects } from "@/lib/api";

interface ProjectItem {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  created_at: string;
}

export default function ProjectsPage(): React.ReactElement {
  const [list, setList] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  const loadProjects = async (): Promise<void> => {
    setLoading(true);
    try {
      const { data } = await projects.list();
      setList(data);
    } catch {
      console.error("Failed to load projects");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm("Delete this project?")) return;
    await projects.delete(id);
    loadProjects();
  };

  const formatDate = (date: string): string =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-white py-8 px-6">
      <div className="container">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">Projects</h1>
            <p className="text-sm text-[#666] mt-1">Manage your video projects</p>
          </div>
          <Link href="/" className="btn-primary">
            <Plus className="w-4 h-4" /> New Project
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-[#999]">Loading...</div>
        ) : list.length === 0 ? (
          <div className="card text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 bg-[#f5f5f5] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Folder className="w-8 h-8 text-[#999]" />
            </div>
            <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">No projects yet</h2>
            <p className="text-sm text-[#666] mb-6">Create your first AI-powered video project</p>
            <Link href="/" className="btn-primary inline-flex">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((p) => (
              <div key={p.id} className="card group overflow-hidden p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-[#f5f5f5]">
                  {p.thumbnail ? (
                    <Image src={p.thumbnail} alt={p.title} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Folder className="w-10 h-10 text-[#d4d4d4]" />
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Link href={`/workspace/${p.id}`} className="bg-white text-[#1a1a1a] px-4 py-2 rounded-lg text-sm font-semibold">
                      Open Project
                    </Link>
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-[#1a1a1a] truncate mb-2">{p.title || "Untitled"}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        p.status === "completed" ? "bg-green-50 text-green-600" : "bg-[#f5f5f5] text-[#666]"
                      }`}>
                        {p.status}
                      </span>
                      <span className="text-xs text-[#999] flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDate(p.created_at)}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDelete(p.id)} 
                      className="p-1.5 text-[#999] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
