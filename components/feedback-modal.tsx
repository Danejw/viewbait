"use client";

/**
 * Feedback Modal
 *
 * Form for submitting feedback (contact) from the footer. Submits to POST /api/feedback
 * and inserts into the feedback table. Used by LandingFooter, auth page, and root landing.
 */

import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitFeedback } from "@/lib/services/feedback";
import type { FeedbackTableCategory } from "@/lib/types/database";

/** Max message length (must match server MESSAGE_MAX_LENGTH). */
const MESSAGE_MAX_LENGTH = 5000;

/** Allowed categories (must match DB constraint). */
const FEEDBACK_CATEGORIES: { value: FeedbackTableCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature request", label: "Feature request" },
  { value: "other", label: "Other" },
  { value: "just a message", label: "Just a message" },
];

/** Basic email format for client-side hint. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FeedbackModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the modal should close (e.g. after submit or cancel). */
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<FeedbackTableCategory | "">("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setMessage("");
    setCategory("");
    setEmail("");
    setMessageError(null);
    setCategoryError(null);
    setEmailError(null);
  }, []);

  const validate = (): boolean => {
    let valid = true;
    const msgTrim = message.trim();
    if (!msgTrim) {
      setMessageError("Message is required");
      valid = false;
    } else if (msgTrim.length > MESSAGE_MAX_LENGTH) {
      setMessageError(`Message must be at most ${MESSAGE_MAX_LENGTH} characters`);
      valid = false;
    } else {
      setMessageError(null);
    }
    if (!category) {
      setCategoryError("Please select a category");
      valid = false;
    } else {
      setCategoryError(null);
    }
    const emailTrim = email.trim();
    if (emailTrim && !EMAIL_REGEX.test(emailTrim)) {
      setEmailError("Please enter a valid email address");
      valid = false;
    } else {
      setEmailError(null);
    }
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);
    const page_url = typeof window !== "undefined" ? window.location.href : "";
    const app_version = process.env.NEXT_PUBLIC_APP_VERSION ?? "web";
    const user_agent = typeof navigator !== "undefined" ? navigator.userAgent : "";

    const result = await submitFeedback({
      message: message.trim(),
      category: category as FeedbackTableCategory,
      email: email.trim() || undefined,
      page_url,
      app_version,
      user_agent,
    });

    setSubmitting(false);
    if (result.success) {
      toast.success(result.message ?? "Feedback submitted. Thanks!");
      resetForm();
      onClose();
    } else {
      toast.error(result.error ?? "Failed to submit feedback. Please try again.");
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-md">
        <DialogHeader className="space-y-1.5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send feedback
          </DialogTitle>
          <DialogDescription>
            Share a bug, feature idea, or message. We read everything.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feedback-message">
              Message <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="feedback-message"
              placeholder="Your feedback…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MESSAGE_MAX_LENGTH}
              rows={4}
              className="min-h-20 resize-y"
              aria-invalid={!!messageError}
              aria-describedby={messageError ? "feedback-message-error" : undefined}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span id="feedback-message-error" className="text-destructive">
                {messageError ?? ""}
              </span>
              <span>
                {message.length} / {MESSAGE_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as FeedbackTableCategory)}
            >
              <SelectTrigger
                id="feedback-category"
                className="w-full"
                aria-invalid={!!categoryError}
                aria-describedby={categoryError ? "feedback-category-error" : undefined}
              >
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_CATEGORIES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryError && (
              <p id="feedback-category-error" className="text-xs text-destructive">
                {categoryError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-email">Email (optional)</Label>
            <Input
              id="feedback-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "feedback-email-error" : undefined}
            />
            {emailError && (
              <p id="feedback-email-error" className="text-xs text-destructive">
                {emailError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
