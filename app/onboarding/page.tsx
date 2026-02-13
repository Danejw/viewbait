  "use client";

  /**
   * Onboarding Page
   *
   * Multi-step flow using Studio generator components: Name → Face (optional) → Style → Generate → Success.
   * Wraps content in OnboardingProvider, StudioProvider, and StudioDndContext so the same components
   * as the manual generator are reused. Visiting /onboarding always runs the full flow.
   */

  import React, {
    useState,
    useCallback,
    useEffect,
    useRef,
  } from "react";
  import Link from "next/link";
  import Image from "next/image";
  import { useRouter, useSearchParams } from "next/navigation";
  import { ChevronRight, ExternalLink, RefreshCw, Zap } from "lucide-react";
  import { toast } from "sonner";
  import { OnboardingProvider } from "@/lib/contexts/onboarding-context";
  import { StudioProvider, StudioDndContext, useStudio } from "@/components/studio";
  import { ChatDropHandlerProvider } from "@/components/studio/chat-drop-handler-context";
  import {
    StudioGeneratorThumbnailText,
    StudioGeneratorFaces,
    StudioGeneratorStyleSelection,
    StudioGeneratorSubmit,
  } from "@/components/studio/studio-generator";
  import { useThumbnails } from "@/lib/hooks/useThumbnails";
  import { useStyles } from "@/lib/hooks/useStyles";
  import { useAuth } from "@/lib/hooks/useAuth";
  import { markOnboardingCompleted } from "@/lib/services/profiles";
  import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
  import { CRTLoadingEffect } from "@/components/ui/crt-loading-effect";
  import { TooltipProvider } from "@/components/ui/tooltip";
  import { isAllowedRedirect } from "@/lib/utils/redirect-allowlist";
  import type { Thumbnail } from "@/lib/types/database";

  const ONBOARDING_REDIRECT_KEY = "onboarding_redirect";

  const TOTAL_STEPS = 6;
  const STEP_NAMES = [
    "Welcome",
    "Name your thumbnail",
    "Add your face (optional)",
    "Pick a style",
    "Generate",
    "Your thumbnail is ready",
  ];

  /** Inner flow that uses Studio context; must be rendered inside StudioProvider + OnboardingProvider */
  function OnboardingFlow() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [isSkippingToStudio, setIsSkippingToStudio] = useState(false);
    const [postCompletionRedirect, setPostCompletionRedirect] = useState("/studio");
    const {
      state: { thumbnailText, selectedStyle, includeFaces, selectedFaces, isGenerating },
      actions: { setIncludeStyles, setThumbnailText, setSelectedStyle, setIncludeFaces, clearLastGeneratedThumbnail },
      data: { lastGeneratedThumbnail },
    } = useStudio();
    const { thumbnails } = useThumbnails({
      userId: user?.id,
      enabled: !!user?.id,
      limit: 5,
    });
    const { defaultStyles, styles } = useStyles({
      enabled: true,
      autoFetch: true,
      includeDefaults: true,
    });

    const [step, setStep] = useState(0);
    const [generatedThumbnail, setGeneratedThumbnail] = useState<Thumbnail | null>(null);
    const prevThumbnailsCountRef = useRef(0);
    const wasGeneratingRef = useRef(false);
    const didExpandFacesRef = useRef(false);
    const didExpandStylesRef = useRef(false);
    const onboardingMarkedDoneRef = useRef(false);

    // Refs for studio actions so effects/callbacks don't depend on them (avoids "Maximum update depth" when provider re-renders).
    const setIncludeStylesRef = useRef(setIncludeStyles);
    const setIncludeFacesRef = useRef(setIncludeFaces);
    const setThumbnailTextRef = useRef(setThumbnailText);
    const setSelectedStyleRef = useRef(setSelectedStyle);
    setIncludeStylesRef.current = setIncludeStyles;
    setIncludeFacesRef.current = setIncludeFaces;
    setThumbnailTextRef.current = setThumbnailText;
    setSelectedStyleRef.current = setSelectedStyle;

    // Store validated redirect from URL so we can send user there after completion
    useEffect(() => {
      const r = searchParams.get("redirect");
      if (r && isAllowedRedirect(r)) {
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(ONBOARDING_REDIRECT_KEY, r);
      }
    }, [searchParams]);

    // When entering step 5, read stored redirect for "Open in Studio" link
    useEffect(() => {
      if (step !== 5) return;
      const r = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ONBOARDING_REDIRECT_KEY) : null;
      setPostCompletionRedirect(r && isAllowedRedirect(r) ? r : "/studio");
    }, [step]);

    // When entering step 3, show the style grid once (includeStyles = true)
    useEffect(() => {
      if (step === 3 && !didExpandStylesRef.current) {
        didExpandStylesRef.current = true;
        setIncludeStylesRef.current(true);
      }
      if (step !== 3) didExpandStylesRef.current = false;
    }, [step]);

    // When entering step 2, expand face section once so user sees the toggle and grid
    useEffect(() => {
      if (step === 2 && !didExpandFacesRef.current) {
        didExpandFacesRef.current = true;
        setIncludeFacesRef.current(true);
      }
      if (step !== 2) didExpandFacesRef.current = false;
    }, [step]);

    // Track when we're generating so we know when to advance
    useEffect(() => {
      if (isGenerating) {
        wasGeneratingRef.current = true;
        prevThumbnailsCountRef.current = thumbnails.length;
      }
    }, [isGenerating, thumbnails.length]);

    // Primary: advance to step 5 when generation result is set (from API response – reliable)
    useEffect(() => {
      if (step === 4 && wasGeneratingRef.current && lastGeneratedThumbnail?.imageUrl) {
        wasGeneratingRef.current = false;
        setGeneratedThumbnail(lastGeneratedThumbnail);
        setStep(5);
        clearLastGeneratedThumbnail();
        toast.success("Your thumbnail is ready!");
      }
    }, [step, lastGeneratedThumbnail, clearLastGeneratedThumbnail]);

    // Fallback: advance when list refetch includes the new thumbnail (if lastGeneratedThumbnail wasn't set)
    useEffect(() => {
      if (wasGeneratingRef.current && !isGenerating && step === 4 && thumbnails.length > prevThumbnailsCountRef.current && thumbnails[0]) {
        wasGeneratingRef.current = false;
        setGeneratedThumbnail(thumbnails[0]);
        setStep(5);
        toast.success("Your thumbnail is ready!");
      }
    }, [isGenerating, step, thumbnails]);

    // Safeguard: if we're on step 5 but generatedThumbnail is missing (e.g. race), use newest thumbnail
    useEffect(() => {
      if (step === 5 && !generatedThumbnail?.imageUrl && thumbnails[0]?.imageUrl) {
        setGeneratedThumbnail(thumbnails[0]);
      }
    }, [step, generatedThumbnail, thumbnails]);

    // Mark onboarding completed once when user reaches step 5 with a thumbnail
    useEffect(() => {
      if (step !== 5 || !generatedThumbnail?.imageUrl || onboardingMarkedDoneRef.current) return;
      onboardingMarkedDoneRef.current = true;
      markOnboardingCompleted().then(({ error }) => {
        if (error) {
          toast.error("Could not save completion. You may see onboarding again next time.");
        }
      });
    }, [step, generatedThumbnail?.imageUrl]);

    const canProceedFromName = thumbnailText.trim().length > 0;
    const canProceedFromStyle = selectedStyle != null;

    const handleNext = useCallback((fromStep: number) => {
      if (fromStep === 1) toast.success("Step 1 done – you're on a roll!");
      if (fromStep === 2) toast.success("Step 2 done!");
      if (fromStep === 3) toast.success("Step 3 done – almost there!");
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }, []);

    const handleSkipFace = useCallback(() => {
      toast.success("Step 2 done!");
      setStep(3);
    }, []);

    const handleCreateAnother = useCallback(() => {
      setStep(0);
      setGeneratedThumbnail(null);
      setThumbnailTextRef.current("");
      setSelectedStyleRef.current(null);
      setIncludeFacesRef.current(false);
    }, []);

    /** Skip onboarding: mark completed then navigate to studio so middleware allows access. */
    const handleSkipToStudio = useCallback(async () => {
      if (isSkippingToStudio) return;
      setIsSkippingToStudio(true);
      const { error } = await markOnboardingCompleted();
      if (error) {
        toast.error("Could not skip onboarding. Please try again.");
        setIsSkippingToStudio(false);
        return;
      }
      router.push("/studio");
    }, [isSkippingToStudio]);

    const selectedStyleName =
      selectedStyle &&
      [...(defaultStyles || []), ...(styles || [])].find((s) => s.id === selectedStyle)?.name;

    return (
      <div
        className="landing-page min-h-screen flex flex-col"
        style={{
          minHeight: "100vh",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        {/* Global CRT effects – same as root landing; pointer-events: none so they never block clicks */}
        <div className="global-scanlines" aria-hidden style={{ pointerEvents: "none" }} />
        <div className="crt-vignette" aria-hidden style={{ pointerEvents: "none" }} />
        <div className="interference-line" aria-hidden style={{ pointerEvents: "none" }} />
        <div className="noise" aria-hidden style={{ pointerEvents: "none" }} />

        {/* Navigation – same as root landing for consistency. z-index above main so "Skip to Studio" receives taps on mobile. */}
        <nav
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10001,
            padding: "16px var(--landing-padding-x)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(3,3,3,0.95)",
            backdropFilter: "blur(20px) saturate(180%)",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
            transition: "all 0.4s ease",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}
            aria-label="Back to home"
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "#ff0000",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow: "0 0 30px rgba(255,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.1)",
              }}
            >
              <div className="crop-mark tl" style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }} />
              <div className="crop-mark br" style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }} />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <span
                className="crt-text-heavy"
                style={{
                  fontSize: "18px",
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  display: "block",
                  lineHeight: 1,
                }}
              >
                VIEWBAIT
              </span>
              <span
                className="mono hide-mobile crt-text"
                style={{
                  fontSize: "9px",
                  color: "#555",
                  letterSpacing: "0.1em",
                }}
              >
                THUMBNAIL STUDIO
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleSkipToStudio}
            disabled={isSkippingToStudio}
            className="btn-crt"
            style={{
              padding: "12px 24px",
              background: "#fff",
              border: "none",
              borderRadius: "10px",
              color: "#000",
              fontSize: "14px",
              fontWeight: 700,
              cursor: isSkippingToStudio ? "wait" : "pointer",
              position: "relative",
              overflow: "hidden",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            {isSkippingToStudio ? "..." : "Skip to Studio"}
          </button>
        </nav>

        {/* Confetti on success */}
        {step === 5 &&
          Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                background: ["#ff0000", "#ff4444", "#ffaa00", "#44ff88", "#4488ff"][i % 5],
                animationDelay: `${Math.random() * 0.5}s`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
              aria-hidden
            />
          ))}

        <main
          className="flex-1 flex flex-col items-center justify-center w-full mx-auto max-w-[min(100%,480px)] sm:max-w-[520px] md:max-w-[600px] lg:max-w-[680px] xl:max-w-[720px] 2xl:max-w-[800px]"
          style={{
            padding: "100px var(--landing-padding-x) 40px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Progress bar – 6 segments for steps 0–5 */}
          <div className="progress-container w-full">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="progress-step">
                <div
                  className="progress-step-fill"
                  style={{ width: step > i ? "100%" : "0%" }}
                />
              </div>
            ))}
          </div>

          {/* Step label */}
          <div className="text-center mb-6 w-full">
            <span
              className="mono crt-text block mb-2"
              style={{
                fontSize: "11px",
                color: "#ff4444",
                letterSpacing: "0.1em",
              }}
            >
              STEP {step + 1} OF {TOTAL_STEPS}
            </span>
            <h1
              className="crt-text-heavy"
              style={{
                fontSize: "clamp(20px, 5vw, 28px)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {STEP_NAMES[step]}
            </h1>
          </div>

          {/* Single card with crop marks – content changes per step */}
          <div className="onboarding-card w-full" key={step}>
            <div className="crop-mark tl" />
            <div className="crop-mark tr" />
            <div className="crop-mark bl" />
            <div className="crop-mark br" />

            {/* Step 0: Welcome – prime the user before the flow */}
            {step === 0 && (
              <div className="relative z-[1]">
                <p
                  className="crt-text mb-5"
                  style={{ fontSize: "16px", color: "#aaa", lineHeight: 1.7 }}
                >
                  I noticed this is your first time here. Let&rsquo;s walk you through the steps to create your first thumbnail. It only takes a minute.
                </p>
                <p
                  className="crt-text mb-6"
                  style={{ fontSize: "14px", color: "#777", lineHeight: 1.6 }}
                >
                  You&rsquo;ll name your thumbnail, optionally add your face, pick a style, and we&rsquo;ll generate it. Ready when you are.
                </p>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => setStep(1)}
                >
                  Get started
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Step 1: Name */}
            {step === 1 && (
              <div className="relative z-[1]">
                <p
                  className="crt-text mb-5"
                  style={{ fontSize: "14px", color: "#777", lineHeight: 1.6 }}
                >
                  What text should appear on your thumbnail? Make it catchy!
                </p>
                <StudioGeneratorThumbnailText />
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={!canProceedFromName}
                    onClick={() => handleNext(1)}
                  >
                    Continue
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  onClick={() => setStep(0)}
                >
                  Back
                </button>
              </div>
            )}

            {/* Step 2: Face (optional) */}
            {step === 2 && (
              <div className="relative z-[1]">
                <p
                  className="crt-text mb-5"
                  style={{ fontSize: "14px", color: "#777", lineHeight: 1.6 }}
                >
                  Add a face to make your thumbnail more personal. This step is optional.
                </p>
                <StudioGeneratorFaces />
                <p className="text-xs text-muted-foreground mt-2">
                  You can add more faces anytime in Studio.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={handleSkipFace}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={() => handleNext(2)}
                  >
                    Continue
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
              </div>
            )}

            {/* Step 3: Style */}
            {step === 3 && (
              <div className="relative z-[1]">
                <p
                  className="crt-text mb-5"
                  style={{ fontSize: "14px", color: "#777", lineHeight: 1.6 }}
                >
                  Choose a style that matches your content.
                </p>
                <StudioGeneratorStyleSelection />
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!canProceedFromStyle}
                    onClick={() => handleNext(3)}
                  >
                    Continue
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
              </div>
            )}

            {/* Step 4: Generate – summary + submit, or generating state */}
            {step === 4 && !isGenerating && (
              <div className="relative z-[1]">
                <p
                  className="crt-text mb-6"
                  style={{ fontSize: "14px", color: "#777", lineHeight: 1.6 }}
                >
                  Review your choices and generate your thumbnail.
                </p>
                <div
                  className="rounded-xl p-5 mb-6"
                  style={{ background: "rgba(0,0,0,0.3)" }}
                >
                  <div className="mb-4">
                    <span
                      className="mono block mb-1"
                      style={{ fontSize: "10px", color: "#555" }}
                    >
                      TEXT
                    </span>
                    <span className="crt-text" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {thumbnailText.trim() || "—"}
                    </span>
                  </div>
                  <div className="mb-4">
                    <span
                      className="mono block mb-1"
                      style={{ fontSize: "10px", color: "#555" }}
                    >
                      STYLE
                    </span>
                    <span className="crt-text" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {selectedStyleName ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span
                      className="mono block mb-1"
                      style={{ fontSize: "10px", color: "#555" }}
                    >
                      FACES
                    </span>
                    <span className="crt-text" style={{ fontSize: "15px", fontWeight: 600 }}>
                      {includeFaces && selectedFaces.length > 0 ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
                <StudioGeneratorSubmit
                  className="btn-primary pulse-glow"
                  buttonLabel="Generate Thumbnail"
                  icon={<Zap className="size-5 mr-2 shrink-0" />}
                  hideCredits
                  hideSaveToProject
                />
                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  onClick={() => setStep(3)}
                >
                  Back
                </button>
              </div>
            )}

            {/* Step 4: Generating state – thumbnail-shaped CRT effect, then loading message */}
            {step === 4 && isGenerating && (
              <div className="flex flex-col gap-4 w-full">
                {/* Thumbnail slot with CRT effect while waiting for generation */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                  <CRTLoadingEffect className="absolute inset-0 h-full w-full !aspect-auto rounded-xl" />
                  <div className="absolute inset-0 flex items-center justify-center z-[1]">
                    <ViewBaitLogo className="h-14 w-14 animate-spin shrink-0 text-primary/90" aria-hidden />
                  </div>
                </div>
                <div className="text-center">
                  <p
                    className="crt-text-heavy mb-1"
                    style={{ fontSize: "18px", fontWeight: 700 }}
                  >
                    Creating your thumbnail
                  </p>
                  <p className="generating-text mono">
                    Working our magic<span>...</span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Success */}
            {step === 5 && generatedThumbnail?.imageUrl && (
              <div className="success-container relative z-[1]">
                <div className="success-preview relative">
                  <div className="relative z-[1] size-full">
                    <Image
                      src={generatedThumbnail.imageUrl}
                      alt="Generated thumbnail"
                      fill
                      className="object-cover"
                      unoptimized
                      sizes="(max-width: 512px) 100vw, 512px"
                    />
                  </div>
                </div>
                <div
                  className="text-center mb-6 p-4 rounded-xl border"
                  style={{
                    background: "rgba(34,197,94,0.1)",
                    borderColor: "rgba(34,197,94,0.2)",
                  }}
                >
                  <div className="text-3xl mb-2">🎉</div>
                  <p
                    className="crt-text"
                    style={{ fontSize: "15px", fontWeight: 600, color: "#22c55e" }}
                  >
                    Your thumbnail is ready!
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Link
                    href={postCompletionRedirect}
                    className="btn-primary w-full inline-flex items-center justify-center gap-2 no-underline"
                  >
                    <ExternalLink className="size-4 shrink-0" strokeWidth={2} />
                    Open in Studio
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCreateAnother}
                    style={{ color: "#666" }}
                  >
                    <RefreshCw className="size-4 mr-2 inline" strokeWidth={2} />
                    Create Another
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Encouragement text – steps 1–3 only */}
          {step >= 1 && step < 4 && (
            <p
              className="mono crt-text mt-6 text-center"
              style={{ fontSize: "11px", color: "#444" }}
            >
              {step === 1 && "Great thumbnails start with great hooks 🎣"}
              {step === 2 && "Faces increase CTR by up to 40% 📈"}
              {step === 3 && "Almost there! Pick what fits your vibe ✨"}
            </p>
          )}
        </main>
      </div>
    );
  }

  export default function OnboardingPage() {
    return (
      <OnboardingProvider isOnboarding>
        <TooltipProvider delayDuration={0}>
          <StudioProvider>
            <ChatDropHandlerProvider>
              <StudioDndContext>
                <React.Suspense fallback={null}>
                  <OnboardingFlow />
                </React.Suspense>
              </StudioDndContext>
            </ChatDropHandlerProvider>
          </StudioProvider>
        </TooltipProvider>
      </OnboardingProvider>
    );
  }
