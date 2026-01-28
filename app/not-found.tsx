"use client";

import { useRouter } from "next/navigation";
import { Home, ArrowLeft } from "lucide-react";
import SearchIcon from "@/components/SearchIcon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* <Header /> */}
      <main className="flex-1 flex items-center justify-center px-6 py-20 md:px-8 md:py-32">
        <div className="mx-auto max-w-2xl w-full text-center">
          <Card className="relative p-8">
            {/* Search Icon */}
            <div className="mb-6 flex justify-center">
              <SearchIcon
                size={160}
                animated={true}
                showGlow={true}
                startColor="#FF512F"
                endColor="#F09819"
              />
            </div>

            {/* 404 Number */}
            <div className="mb-6">
              <h1 className="text-8xl md:text-9xl font-bold font-display text-gradient bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                404
              </h1>
            </div>

            {/* Message */}
            <h2 className="mb-4 text-3xl font-bold font-display text-foreground md:text-4xl">
              You&apos;ve lost your way
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              <br />
              Time to find your way back to creating{" "}
              <span className="text-gradient">viral thumbnails</span>.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                variant="default"
                size="lg"
                onClick={() => router.push("/")}
              >
                Go Home
              </Button>
              <Button
                variant="default"
                size="lg"
                onClick={() => router.back()}
              >
                Go Back
              </Button>
            </div>
          </Card>
        </div>
      </main>
      {/* <Footer /> */}
    </div>
  );
}
