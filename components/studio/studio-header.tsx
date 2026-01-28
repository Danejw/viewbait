"use client";

import React from "react";
import Link from "next/link";
import { Zap, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioHeader as HeaderFrame } from "./studio-frame";

/**
 * StudioHeaderBrand
 * Logo and brand name
 */
export function StudioHeaderBrand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
        <Zap className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="text-lg font-semibold">ViewBait</span>
    </Link>
  );
}

/**
 * StudioHeaderTitle
 * Page title in the center
 */
export function StudioHeaderTitle({ title }: { title: string }) {
  return (
    <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold">
      {title}
    </h1>
  );
}

/**
 * StudioHeaderCredits
 * Credits/progress indicator
 */
export function StudioHeaderCredits({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const percentage = (current / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium">{current}</span>
      </div>
      <Button variant="ghost" size="icon">
        <Menu className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * StudioHeaderUser
 * User profile icon
 */
export function StudioHeaderUser() {
  return (
    <Button variant="ghost" size="icon" className="ml-2">
      <User className="h-4 w-4" />
    </Button>
  );
}

/**
 * StudioHeader
 * Complete header composition
 */
export function StudioHeader() {
  return (
    <HeaderFrame>
      <StudioHeaderBrand />
      <StudioHeaderTitle title="Create Your Next Viral Thumbnail" />
      <div className="flex items-center">
        <StudioHeaderCredits current={4} total={100} />
        <StudioHeaderUser />
      </div>
    </HeaderFrame>
  );
}
