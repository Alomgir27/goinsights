"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { youtube } from "@/lib/api";

export default function AuthCallback(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Connecting your YouTube account...");
  const calledRef = useRef(false);

  useEffect(() => {
    // Prevent double call in React StrictMode
    if (calledRef.current) return;
    
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage("Authorization was cancelled or failed.");
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      return;
    }

    calledRef.current = true;
    handleCallback(code);
  }, [searchParams]);

  const handleCallback = async (code: string) => {
    try {
      const { data } = await youtube.handleCallback(code);
      localStorage.setItem("youtube_connected", "true");
      localStorage.setItem("youtube_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("youtube_refresh_token", data.refresh_token);
      }
      setStatus("success");
      setMessage("Successfully connected!");
      setTimeout(() => router.push("/connect"), 1500);
    } catch {
      setStatus("error");
      setMessage("Failed to connect. Please try again.");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-lg text-center max-w-sm mx-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Connecting...</h2>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Connected!</h2>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Connection Failed</h2>
          </>
        )}
        <p className="text-slate-600">{message}</p>
        {status === "error" && (
          <button onClick={() => router.push("/")} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800">
            Go Back
          </button>
        )}
      </div>
    </main>
  );
}

