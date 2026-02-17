"use client";

import React, { useMemo, useState } from 'react'
import { WandSparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { enhanceTitle } from '@/lib/services/thumbnails'
import type { YouTubeVideoAnalytics } from '@/lib/services/youtube-video-analyze'
import { optimizeYouTubeDescription, updateYouTubeVideoDescription } from '@/lib/services/youtube-video-seo'

interface YouTubeSeoOptimizerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
  videoTitle: string
  analytics: YouTubeVideoAnalytics
  channelTitle?: string
  channelDescription?: string
  channelSocialLinks?: string[]
}

export function YouTubeSeoOptimizerModal({
  open,
  onOpenChange,
  videoId,
  videoTitle,
  analytics,
  channelTitle,
  channelDescription,
  channelSocialLinks,
}: YouTubeSeoOptimizerModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([])
  const [description, setDescription] = useState('')

  const contextTitle = useMemo(
    () => `${videoTitle}\n\nVideo context: ${analytics.summary}\nHooks: ${analytics.hooks}`,
    [videoTitle, analytics.summary, analytics.hooks]
  )

  const handleGenerate = async () => {
    setIsGenerating(true)
    const [titleResult, descriptionResult] = await Promise.all([
      enhanceTitle({ title: contextTitle }),
      optimizeYouTubeDescription({
        videoTitle,
        analytics,
        channelTitle,
        channelDescription,
        channelSocialLinks,
      }),
    ])
    setIsGenerating(false)

    if (titleResult.error) {
      toast.error(titleResult.error.message)
    }
    if (descriptionResult.error) {
      toast.error(descriptionResult.error.message)
    }

    if (!titleResult.error) setTitleSuggestions(titleResult.suggestions)
    if (!descriptionResult.error && descriptionResult.description) {
      setDescription(descriptionResult.description)
      toast.success('Generated title ideas and SEO description')
    }
  }

  const handleApplyDescription = async () => {
    if (!description.trim()) {
      toast.error('Generate or enter a description first')
      return
    }

    setIsUpdating(true)
    const { success, error } = await updateYouTubeVideoDescription(videoId, description)
    setIsUpdating(false)

    if (!success || error) {
      toast.error(error?.message || 'Failed to update YouTube description')
      return
    }

    toast.success('YouTube description updated')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>SEO/AIEO title + description optimizer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Uses video understanding to generate high-CTR title options and an optimized description with overview, links, and chapters.</p>
            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              {isGenerating ? 'Generating…' : 'Generate'}
            </Button>
          </div>

          {titleSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">High-CTR title suggestions</p>
              <div className="flex flex-wrap gap-2">
                {titleSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="rounded-md border bg-muted/40 px-2 py-1 text-xs text-left hover:bg-muted"
                    onClick={() => navigator.clipboard.writeText(suggestion).then(() => toast.success('Title copied'))}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">Optimized description</p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Generate a description..."
              className="min-h-[260px]"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleApplyDescription} disabled={isUpdating || !description.trim()}>
              {isUpdating ? 'Updating YouTube…' : 'Update YouTube description'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
