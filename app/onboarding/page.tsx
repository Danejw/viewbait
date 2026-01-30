"use client";

/**
 * Onboarding Page
 *
 * Self-contained multi-step flow: Name → Face (optional) → Style → Generate → Success.
 * Does not use StudioProvider or any studio state. Reuses /api/generate and public styles.
 * Visiting /onboarding always runs the full flow (no "already completed" skip).
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ViewBaitLogo,
} from "@/components/ui/viewbait-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Sparkles,
  User,
  Palette,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  ImagePlus,
} from "lucide-react";

/** Public style shape returned by GET /api/styles?publicOnly=true */
interface PublicStyle {
  id: string;
  name: string;
  description: string | null;
  preview_thumbnail_url: string | null;
  like_count?: number;
}

const TOTAL_STEPS = 5;
const STEP_NAMES = [
  "Name your thumbnail",
  "Add your face (optional)",
  "Pick a style",
  "Generate",
  "Done",
];

const EXAMPLE_NAMES = ["MIND BLOWN", "SECRET REVEALED", "YOU WON'T BELIEVE THIS"];

export default function OnboardingPage() {
  const { user } = useAuth();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [faceImageUrls, setFaceImageUrls] = useState<string[]>([]);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceUploadError, setFaceUploadError] = useState<string | null>(null);
  const [styles, setStyles] = useState<PublicStyle[]>([]);
  const [stylesLoading, setStylesLoading] = useState(true);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedThumbnailId, setGeneratedThumbnailId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Fetch public styles on mount (no auth required for publicOnly)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStylesLoading(true);
      try {
        const res = await fetch("/api/styles?publicOnly=true");
        if (!res.ok) throw new Error("Failed to load styles");
        const data = await res.json();
        if (!cancelled && data.styles?.length) {
          setStyles(data.styles);
          if (!selectedStyleId) setSelectedStyleId(data.styles[0].id);
        }
      } catch {
        if (!cancelled) setStyles([]);
      } finally {
        if (!cancelled) setStylesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus main input when step changes
  useEffect(() => {
    if (step === 1) {
      nameInputRef.current?.focus();
    }
  }, [step]);

  const canProceedFromName = name.trim().length > 0;

  const handleNext = useCallback(() => {
    setGenerateError(null);
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }, [step]);

  const handleSkipFace = useCallback(() => {
    setFaceUploadError(null);
    setStep(3);
  }, []);

  const handleFaceUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !user?.id) return;
      if (!file.type.startsWith("image/")) {
        setFaceUploadError("Please choose an image file.");
        return;
      }
      setFaceUploadError(null);
      setFaceUploading(true);
      try {
        const path = `${user.id}/onboarding-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
        const formData = new FormData();
        formData.set("file", file);
        formData.set("bucket", "faces");
        formData.set("path", path);
        const res = await fetch("/api/storage/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setFaceUploadError(data.error || "Upload failed");
          return;
        }
        const url = data.url ?? data.path;
        if (url) {
          setFaceImageUrls((prev) => [...prev, url].slice(0, 3));
        }
      } catch {
        setFaceUploadError("Upload failed");
      } finally {
        setFaceUploading(false);
      }
    },
    [user?.id]
  );

  const handleRemoveFace = useCallback((index: number) => {
    setFaceImageUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!name.trim()) return;
    setGenerateError(null);
    setIsGenerating(true);
    try {
      const body: Record<string, unknown> = {
        title: name.trim(),
        variations: 1,
        resolution: "1K",
        aspectRatio: "16:9",
      };
      if (selectedStyleId) body.style = selectedStyleId;
      if (faceImageUrls.length > 0) {
        body.faceCharacters = [{ images: faceImageUrls }];
      }
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || "Generation failed");
        return;
      }
      const firstResult = data.results?.[0] ?? data;
      const imageUrl = firstResult.imageUrl ?? firstResult.image_url;
      const thumbId = firstResult.thumbnailId ?? firstResult.thumbnail_id ?? data.thumbnailId ?? data.thumbnail_id;
      if (imageUrl) {
        setGeneratedImageUrl(imageUrl);
        setGeneratedThumbnailId(thumbId ?? null);
        setStep(5);
      } else {
        setGenerateError("No image returned");
      }
    } catch {
      setGenerateError("Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [name, selectedStyleId, faceImageUrls]);

  const handleCreateAnother = useCallback(() => {
    setStep(1);
    setName("");
    setFaceImageUrls([]);
    setSelectedStyleId(styles[0]?.id ?? null);
    setGeneratedImageUrl(null);
    setGeneratedThumbnailId(null);
    setGenerateError(null);
    setFaceUploadError(null);
  }, [styles]);

  const handleDownload = useCallback(() => {
    if (!generatedImageUrl) return;
    const link = document.createElement("a");
    link.href = generatedImageUrl;
    link.download = `${name.trim() || "thumbnail"}.png`;
    link.click();
  }, [generatedImageUrl, name]);

  const selectedStyle = styles.find((s) => s.id === selectedStyleId);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
          aria-label="Back to home"
        >
          <ViewBaitLogo className="size-8" />
          <span className="font-semibold text-sm">ViewBait</span>
        </Link>
        <Link
          href="/studio"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip to Studio
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-lg mx-auto w-full">
        <div className="mb-6 text-center">
          <p className="text-xs text-muted-foreground mb-1">
            Step {step} of {TOTAL_STEPS}
          </p>
          <h1 className="text-lg font-semibold">{STEP_NAMES[step - 1]}</h1>
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <Card className="w-full" size="default">
            <CardHeader>
              <CardTitle className="text-sm">Thumbnail text</CardTitle>
              <CardDescription>
                This text will appear on your thumbnail or guide the image.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onboarding-name">Name or phrase</Label>
                <Input
                  id="onboarding-name"
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MIND BLOWN"
                  className="text-sm"
                  aria-describedby="name-hint"
                />
                <p id="name-hint" className="text-xs text-muted-foreground">
                  Great, that&apos;ll pop on the thumbnail.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_NAMES.map((example) => (
                  <Button
                    key={example}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setName(example)}
                    className="text-xs"
                  >
                    {example}
                  </Button>
                ))}
              </div>
              <Button
                onClick={handleNext}
                disabled={!canProceedFromName}
                className="w-full"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Face (optional) */}
        {step === 2 && (
          <Card className="w-full" size="default">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="size-4" />
                Add your face (optional)
              </CardTitle>
              <CardDescription>
                Upload a photo so the thumbnail can include your face. You can add faces later in Studio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFaceUpload}
                aria-label="Upload face image"
              />
              {faceImageUrls.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {faceImageUrls.map((url, i) => (
                    <div
                      key={url}
                      className="relative rounded-lg overflow-hidden border border-border size-20 shrink-0"
                    >
                      <Image
                        src={url}
                        alt={`Face ${i + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="80px"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        className="absolute top-1 right-1"
                        onClick={() => handleRemoveFace(i)}
                        aria-label="Remove face"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {faceImageUrls.length < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={faceUploading}
                  className="w-full"
                >
                  {faceUploading ? (
                    <Spinner className="size-4" />
                  ) : (
                    <>
                      <ImagePlus className="size-4" />
                      Upload face
                    </>
                  )}
                </Button>
              )}
              {faceUploadError && (
                <p className="text-xs text-destructive">{faceUploadError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipFace}
                  className="flex-1"
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1"
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Style */}
        {step === 3 && (
          <Card className="w-full" size="default">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Palette className="size-4" />
                Pick a style
              </CardTitle>
              <CardDescription>
                Choose a look for your thumbnail. Nice choice—ready to generate?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stylesLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-lg bg-muted animate-pulse"
                    />
                  ))}
                </div>
              ) : styles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No styles available. You can still generate with just your text.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {styles.slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStyleId(s.id)}
                      className={cn(
                        "rounded-lg border-2 overflow-hidden text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selectedStyleId === s.id
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-border"
                      )}
                      aria-pressed={selectedStyleId === s.id}
                      aria-label={`Select style ${s.name}`}
                    >
                      <div className="aspect-video relative bg-muted">
                        {s.preview_thumbnail_url ? (
                          <Image
                            src={s.preview_thumbnail_url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 400px) 50vw, 200px"
                            unoptimized
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="size-6 text-muted-foreground" />
                          </div>
                        )}
                        {selectedStyleId === s.id && (
                          <div className="absolute top-1 right-1 rounded-full bg-primary p-0.5">
                            <Check className="size-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="px-2 py-1 text-xs font-medium truncate">
                        {s.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <Button onClick={handleNext} className="w-full">
                Next
                <ChevronRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Generate */}
        {step === 4 && (
          <Card className="w-full" size="default">
            <CardHeader>
              <CardTitle className="text-sm">Review & generate</CardTitle>
              <CardDescription>
                Review your choices below, then hit Generate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="text-xs space-y-1">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-medium">{name.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Style</dt>
                  <dd className="font-medium">{selectedStyle?.name ?? "Default"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Face</dt>
                  <dd className="font-medium">
                    {faceImageUrls.length > 0 ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !name.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Spinner className="size-4" />
                    Creating your thumbnail…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate my thumbnail
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Success */}
        {step === 5 && generatedImageUrl && (
          <Card className="w-full" size="default">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Check className="size-4 text-green-600" />
                Your thumbnail is ready
              </CardTitle>
              <CardDescription>
                Download it or open Studio to create more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                <Image
                  src={generatedImageUrl}
                  alt="Generated thumbnail"
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="(max-width: 512px) 100vw, 512px"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={handleDownload} variant="outline" className="w-full">
                  <Download className="size-4" />
                  Download
                </Button>
                <Link href="/studio" className="block">
                  <Button className="w-full">
                    <ExternalLink className="size-4" />
                    Open in Studio
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCreateAnother}
                  className="w-full"
                >
                  <RefreshCw className="size-4" />
                  Create another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
