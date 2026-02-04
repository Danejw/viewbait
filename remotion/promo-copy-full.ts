/**
 * Full promo copy for the 60-second ViewBait intro video.
 * Mirrors the 30-card structure from ViewBaitPromoVideo.jsx for Remotion.
 */

export type PromoCardBg = "dark" | "red-glow" | "green-glow" | "white";

export type PromoCardFull =
  | { type: "big-text"; text: string; subtext: string | null; bg: PromoCardBg; highlight?: boolean }
  | {
      type: "stat";
      number: string;
      label: string;
      subtext?: string;
      bg: PromoCardBg;
    }
  | {
      type: "text-stack";
      lines: string[];
      label?: string;
      bg: PromoCardBg;
    }
  | { type: "centered"; text: string; highlight?: boolean; bg: PromoCardBg }
  | { type: "logo-reveal"; bg: PromoCardBg }
  | { type: "tagline"; text: string; subtext: string; bg: PromoCardBg }
  | {
      type: "feature";
      icon: string;
      title: string;
      description: string;
      bg: PromoCardBg;
    }
  | {
      type: "demo-chat";
      messages: Array<{ role: "user" | "ai"; text: string }>;
      bg: PromoCardBg;
    }
  | { type: "testimonial"; quote: string; author: string; bg: PromoCardBg }
  | {
      type: "pricing";
      plan: string;
      features: string[];
      bg: PromoCardBg;
    }
  | { type: "cta"; text: string; subtext: string; bg: PromoCardBg }
  | { type: "logo-final-animated"; words: string[]; bg: PromoCardBg };

export const PROMO_CARDS_FULL: PromoCardFull[] = [
  { type: "big-text", text: "STOP.", subtext: null, bg: "dark" },
  {
    type: "big-text",
    text: "YOUR THUMBNAILS",
    subtext: "ARE KILLING YOUR CHANNEL",
    bg: "dark",
  },
  {
    type: "stat",
    number: "90%",
    label: "OF VIDEOS FAIL",
    subtext: "because of bad thumbnails",
    bg: "red-glow",
  },
  {
    type: "text-stack",
    lines: ["Hours in Photoshop", "Inconsistent results", "Zero click-through"],
    bg: "dark",
  },
  { type: "big-text", text: "SOUND FAMILIAR?", subtext: null, bg: "dark" },
  {
    type: "centered",
    text: "There's a better way.",
    highlight: true,
    bg: "dark",
  },
  { type: "logo-reveal", bg: "dark" },
  {
    type: "tagline",
    text: "THE AI THUMBNAIL STUDIO",
    subtext: "That actually gets it.",
    bg: "dark",
  },
  {
    type: "big-text",
    text: "DESCRIBE.",
    subtext: "Tell AI what you want.",
    bg: "dark",
  },
  {
    type: "big-text",
    text: "GENERATE.",
    subtext: "Watch the magic happen.",
    bg: "red-glow",
  },
  {
    type: "feature",
    icon: "💬",
    title: "CONVERSATIONAL AI",
    description: "Just describe your vision in plain English",
    bg: "dark",
  },
  {
    type: "feature",
    icon: "😀",
    title: "FACE LIBRARY",
    description: "Upload once. Use your face everywhere.",
    bg: "dark",
  },
  {
    type: "feature",
    icon: "🎨",
    title: "STYLE TEMPLATES",
    description: "Save your winning formulas",
    bg: "dark",
  },
  {
    type: "stat",
    number: "<30s",
    label: "GENERATION TIME",
    subtext: "From prompt to thumbnail",
    bg: "dark",
  },
  {
    type: "feature",
    icon: "📐",
    title: "EVERY FORMAT",
    description: "YouTube • Shorts • Instagram • TikTok",
    bg: "dark",
  },
  {
    type: "feature",
    icon: "4K",
    title: "ULTRA HD",
    description: "Crystal clear exports every time",
    bg: "dark",
  },
  {
    type: "demo-chat",
    messages: [
      { role: "user", text: "dramatic reaction, yellow text, shocked face" },
      { role: "ai", text: "Creating your thumbnail..." },
    ],
    bg: "dark",
  },
  { type: "big-text", text: "NO PHOTOSHOP.", subtext: null, bg: "dark" },
  { type: "big-text", text: "NO TEMPLATES.", subtext: null, bg: "dark" },
  { type: "big-text", text: "JUST RESULTS.", subtext: null, bg: "red-glow" },
  {
    type: "stat",
    number: "+340%",
    label: "AVERAGE CTR INCREASE",
    subtext: "Reported by creators",
    bg: "green-glow",
  },
  {
    type: "stat",
    number: "12,500+",
    label: "CREATORS",
    subtext: "Already using ViewBait",
    bg: "dark",
  },
  {
    type: "testimonial",
    quote: '"Cut my thumbnail time from 2 hours to 5 minutes"',
    author: "@alexgaming",
    bg: "dark",
  },
  {
    type: "testimonial",
    quote: '"The AI actually understands what makes people click"',
    author: "@sarahvlogs",
    bg: "dark",
  },
  {
    type: "text-stack",
    lines: ["Gaming", "Vlogs", "Tutorials", "Reviews", "Podcasts"],
    label: "FOR EVERY NICHE",
    bg: "dark",
  },
  {
    type: "big-text",
    text: "READY TO",
    subtext: "STOP THE SCROLL?",
    highlight: true,
    bg: "dark",
  },
  {
    type: "pricing",
    plan: "FREE",
    features: ["10 thumbnails/month", "No credit card"],
    bg: "dark",
  },
  {
    type: "big-text",
    text: "START FREE.",
    subtext: "Upgrade when you grow.",
    bg: "dark",
  },
  {
    type: "cta",
    text: "VIEWBAIT.AI",
    subtext: "Open your studio today",
    bg: "red-glow",
  },
  {
    type: "logo-final-animated",
    words: ["ATTENTION", "CLICKS", "VIEWS"],
    bg: "white",
  },
];
