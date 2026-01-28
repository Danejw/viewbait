import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Sparkles, Image, TrendingUp, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">ViewBait</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/studio"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Studio
            </Link>
            <Button asChild size="sm">
              <Link href="/studio">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              Create Your Next{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Viral Thumbnail
              </span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              AI-powered thumbnail generation that helps creators design eye-catching,
              conversion-optimized thumbnails in seconds. No design skills required.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/studio">
                  Start Creating
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-border bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl">
              <h2 className="mb-12 text-center text-3xl font-bold">
                Everything you need to create viral thumbnails
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>AI-Powered Generation</CardTitle>
                    <CardDescription>
                      Describe your thumbnail in natural language and let AI create
                      multiple variations instantly.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Image className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Face Library</CardTitle>
                    <CardDescription>
                      Save and reuse faces across thumbnails. Perfect for consistent
                      branding and recurring characters.
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Style System</CardTitle>
                    <CardDescription>
                      Create and save visual styles, palettes, and formats. Build your
                      unique thumbnail brand.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border py-20">
          <div className="container mx-auto px-4">
            <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/5">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Ready to create viral thumbnails?</CardTitle>
                <CardDescription className="text-base">
                  Join creators who are using ViewBait to grow their channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button asChild size="lg">
                  <Link href="/studio">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <Zap className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-sm font-medium">ViewBait</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} ViewBait. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
