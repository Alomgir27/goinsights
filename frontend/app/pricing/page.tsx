"use client";

import React from "react";
import Link from "next/link";
import { Check, Zap, Crown, Rocket, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for trying things out",
    icon: <Zap className="w-5 h-5" />,
    features: ["5 videos per month", "720p export", "Basic subtitles", "Community support"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    desc: "For creators who want more",
    icon: <Crown className="w-5 h-5" />,
    features: ["50 videos per month", "1080p HD export", "All subtitle styles", "AI thumbnails", "Background music", "Priority support"],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "per month",
    desc: "For teams and agencies",
    icon: <Rocket className="w-5 h-5" />,
    features: ["Unlimited videos", "4K export", "Custom branding", "API access", "Team collaboration", "Dedicated support"],
    cta: "Contact Sales",
    popular: false,
  },
];

export default function PricingPage(): React.ReactElement {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-28 pb-20 px-6">
        <div className="container max-w-5xl">
          <div className="text-center mb-14">
            <div className="badge mb-4 mx-auto">
              <Zap className="w-3.5 h-3.5 text-purple-500" />
              <span>Simple pricing</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4">Choose your plan</h1>
            <p className="text-lg text-[#666] max-w-xl mx-auto">
              Start free, upgrade when you need. No hidden fees, cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 transition-all ${
                  plan.popular
                    ? "bg-[#1a1a1a] text-white ring-2 ring-[#1a1a1a] scale-105"
                    : "bg-white border border-[#f0f0f0] hover:border-[#e5e5e5]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  plan.popular ? "bg-white/10" : "bg-[#f5f5f5]"
                }`}>
                  {plan.icon}
                </div>

                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.popular ? "text-white/70" : "text-[#666]"}`}>{plan.desc}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className={`text-sm ml-1 ${plan.popular ? "text-white/60" : "text-[#999]"}`}>/{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 ${plan.popular ? "text-green-400" : "text-green-600"}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.name === "Business" ? "/contact" : "/auth/signup"}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? "bg-white text-[#1a1a1a] hover:bg-white/90"
                      : "bg-[#1a1a1a] text-white hover:bg-[#333]"
                  }`}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <p className="text-sm text-[#999] mb-4">Trusted by 10,000+ creators worldwide</p>
            <div className="flex items-center justify-center gap-8 opacity-40">
              {["YouTube", "TikTok", "Instagram", "Twitter"].map((brand) => (
                <span key={brand} className="text-lg font-bold text-[#1a1a1a]">{brand}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

