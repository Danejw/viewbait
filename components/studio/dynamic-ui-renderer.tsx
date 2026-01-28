"use client";

import React from "react";
import { User, Palette, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "./studio-provider";
import {
  StudioGeneratorThumbnailText,
  StudioGeneratorCustomInstructions,
  StudioGeneratorStyleReferences,
  StudioGeneratorStyleSelection,
  StudioGeneratorPalette,
  StudioGeneratorAspectRatio,
  StudioGeneratorResolution,
  StudioGeneratorAspectAndResolution,
  StudioGeneratorVariations,
  StudioGeneratorFaces,
  StudioGeneratorSubmit,
} from "./studio-generator";

/**
 * UI component names returned by the assistant chat API.
 * Must match API route and tool definition.
 */
export type UIComponentName =
  | "ThumbnailTextSection"
  | "IncludeFaceSection"
  | "StyleSelectionSection"
  | "ColorPaletteSection"
  | "StyleReferencesSection"
  | "AspectRatioSection"
  | "ResolutionSection"
  | "AspectRatioResolutionSection"
  | "VariationsSection"
  | "CustomInstructionsSection"
  | "GenerateThumbnailButton"
  | "RegisterNewFaceCard"
  | "RegisterNewStyleCard"
  | "RegisterNewPaletteCard";

export interface DynamicUIRendererProps {
  components: UIComponentName[];
}

/**
 * Register cards: compact links to add new face/style/palette (navigate to My Faces/Styles/Palettes).
 */
function RegisterNewFaceCard() {
  const { actions } = useStudio();
  return (
    <div className="mb-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => actions.setView("faces")}
      >
        <User className="mr-2 h-4 w-4" />
        Add a new face
      </Button>
    </div>
  );
}

function RegisterNewStyleCard() {
  const { actions } = useStudio();
  return (
    <div className="mb-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => actions.setView("styles")}
      >
        <Palette className="mr-2 h-4 w-4" />
        Add a new style
      </Button>
    </div>
  );
}

function RegisterNewPaletteCard() {
  const { actions } = useStudio();
  return (
    <div className="mb-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => actions.setView("palettes")}
      >
        <Droplets className="mr-2 h-4 w-4" />
        Add a new palette
      </Button>
    </div>
  );
}

const COMPONENT_MAP: Record<UIComponentName, React.ComponentType> = {
  ThumbnailTextSection: StudioGeneratorThumbnailText,
  IncludeFaceSection: StudioGeneratorFaces,
  StyleSelectionSection: StudioGeneratorStyleSelection,
  ColorPaletteSection: StudioGeneratorPalette,
  StyleReferencesSection: StudioGeneratorStyleReferences,
  AspectRatioSection: StudioGeneratorAspectRatio,
  ResolutionSection: StudioGeneratorResolution,
  AspectRatioResolutionSection: StudioGeneratorAspectAndResolution,
  VariationsSection: StudioGeneratorVariations,
  CustomInstructionsSection: StudioGeneratorCustomInstructions,
  GenerateThumbnailButton: StudioGeneratorSubmit,
  RegisterNewFaceCard: RegisterNewFaceCard,
  RegisterNewStyleCard: RegisterNewStyleCard,
  RegisterNewPaletteCard: RegisterNewPaletteCard,
};

/**
 * DynamicUIRenderer
 * Maps UI component names from the assistant response to StudioGenerator sections (and compact variants).
 * Renders the list of components in order so the chat can drive the same form state.
 */
export function DynamicUIRenderer({ components }: DynamicUIRendererProps) {
  if (!components?.length) return null;

  return (
    <div className="mt-2 space-y-2">
      {components.map((name, index) => {
        const Component = COMPONENT_MAP[name];
        if (!Component) return null;
        return <Component key={`${name}-${index}`} />;
      })}
    </div>
  );
}
