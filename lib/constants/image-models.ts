/**
 * Studio image generation model choices (Gemini Nano Banana + OpenAI GPT Image).
 * @see https://ai.google.dev/gemini-api/docs/models
 * @see https://developers.openai.com/api/reference/resources/images
 */

export const STUDIO_IMAGE_MODEL_STORAGE_KEY = "studio-image-model";

export type ImageModelProvider = "gemini" | "openai";

export type ImageModelChoice = "nano-banana-pro" | "nano-banana-2" | "gpt-image-2";

export const DEFAULT_IMAGE_MODEL: ImageModelChoice = "nano-banana-pro";

/** Gemini API model ids per user choice */
export const IMAGE_MODEL_GEMINI_API_IDS: Record<
  Extract<ImageModelChoice, "nano-banana-pro" | "nano-banana-2">,
  string
> = {
  "nano-banana-pro": "gemini-3-pro-image-preview",
  "nano-banana-2": "gemini-3.1-flash-image-preview",
};

export const OPENAI_IMAGE_MODEL_ID = "gpt-image-2" as const;

/** @deprecated Use resolveImageModel or IMAGE_MODEL_GEMINI_API_IDS */
export const IMAGE_MODEL_API_IDS: Record<ImageModelChoice, string> = {
  "nano-banana-pro": IMAGE_MODEL_GEMINI_API_IDS["nano-banana-pro"],
  "nano-banana-2": IMAGE_MODEL_GEMINI_API_IDS["nano-banana-2"],
  "gpt-image-2": OPENAI_IMAGE_MODEL_ID,
};

export const IMAGE_MODEL_OPTIONS: ReadonlyArray<{
  id: ImageModelChoice;
  label: string;
}> = [
  { id: "nano-banana-pro", label: "Nano Banana Pro" },
  { id: "nano-banana-2", label: "Nano Banana 2" },
  { id: "gpt-image-2", label: "GPT Image 2" },
] as const;

const VALID_CHOICES = new Set<string>(IMAGE_MODEL_OPTIONS.map((o) => o.id));

export function isImageModelChoice(value: string): value is ImageModelChoice {
  return VALID_CHOICES.has(value);
}

export interface ResolvedImageModel {
  provider: ImageModelProvider;
  apiModelId: string;
  choice: ImageModelChoice;
}

/**
 * Resolve client choice to provider + API model id (allowlist only).
 */
export function resolveImageModel(choice: string | undefined): ResolvedImageModel {
  if (choice === "gpt-image-2") {
    return {
      provider: "openai",
      apiModelId: OPENAI_IMAGE_MODEL_ID,
      choice: "gpt-image-2",
    };
  }
  if (choice === "nano-banana-2") {
    return {
      provider: "gemini",
      apiModelId: IMAGE_MODEL_GEMINI_API_IDS["nano-banana-2"],
      choice: "nano-banana-2",
    };
  }
  const resolvedChoice: keyof typeof IMAGE_MODEL_GEMINI_API_IDS =
    choice === "nano-banana-pro" ? "nano-banana-pro" : DEFAULT_IMAGE_MODEL;
  return {
    provider: "gemini",
    apiModelId: IMAGE_MODEL_GEMINI_API_IDS[resolvedChoice],
    choice: resolvedChoice,
  };
}

/**
 * Resolve client choice to an API model id (allowlist only).
 */
export function resolveImageModelApiId(choice: string | undefined): string {
  return resolveImageModel(choice).apiModelId;
}

export function loadCachedImageModel(): ImageModelChoice {
  if (typeof window === "undefined") {
    return DEFAULT_IMAGE_MODEL;
  }
  try {
    const stored = localStorage.getItem(STUDIO_IMAGE_MODEL_STORAGE_KEY);
    if (stored && isImageModelChoice(stored)) {
      return stored;
    }
  } catch {
    // private browsing, disabled storage, etc.
  }
  return DEFAULT_IMAGE_MODEL;
}

export function saveCachedImageModel(choice: ImageModelChoice): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STUDIO_IMAGE_MODEL_STORAGE_KEY, choice);
  } catch {
    // quota exceeded, disabled storage, etc.
  }
}
