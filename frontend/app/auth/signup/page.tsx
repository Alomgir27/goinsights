"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, Lock, User, Eye, EyeOff, Check } from "lucide-react";
import { auth } from "@/lib/api";

export default function SignupPage(): React.ReactElement {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await auth.signup(name, email, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/projects");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = password.length >= 8;

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#fafafa] to-[#fff5f5] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Image src="/logo.svg" alt="ZapClip" width={40} height={40} />
            <span className="text-2xl font-bold text-[#1a1a1a]">ZapClip</span>
          </Link>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2">Create your account</h1>
          <p className="text-[#666]">Start creating AI-powered videos in seconds</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#f0f0f0] p-8 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Full name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input input-with-icon"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input input-with-icon"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999] pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="input input-with-icon input-with-icon-right"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#666]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className={`flex items-center gap-1.5 mt-2 text-xs ${passwordStrength ? "text-green-600" : "text-[#999]"}`}>
                  <Check className="w-3 h-3" />
                  <span>At least 8 characters</span>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="relative my-6">
            <div className="divider" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-[#999]">or</span>
          </div>

          <button className="btn-secondary w-full justify-center">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </button>

          <p className="text-center mt-5 text-xs text-[#999]">
            By signing up, you agree to our{" "}
            <Link href="#" className="text-[#666] hover:underline">Terms</Link> and{" "}
            <Link href="#" className="text-[#666] hover:underline">Privacy Policy</Link>
          </p>
        </div>

        <p className="text-center mt-6 text-sm text-[#666]">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-purple-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

