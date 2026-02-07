"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { CloseButton } from "@/components/ui/close-button"

/**
 * Modal size variants
 */
const modalContentVariants = cva(
  "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid gap-4 rounded-xl p-4 text-xs/relaxed ring-1 duration-300 fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
        "4xl": "max-w-4xl",
        full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

function Modal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="modal" {...props} />
}

function ModalTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="modal-trigger" {...props} />
}

function ModalPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="modal-portal" {...props} />
}

function ModalClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="modal-close" {...props} />
}

function ModalOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="modal-overlay"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-white/80 dark:bg-black/80 duration-300 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50",
        className
      )}
      {...props}
    />
  )
}

function ModalContent({
  className,
  children,
  size,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof modalContentVariants> & {
    showCloseButton?: boolean
  }) {
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        data-slot="modal-content"
        className={cn(modalContentVariants({ size }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="modal-close" asChild>
            <CloseButton className="absolute top-2 right-2" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
}

function ModalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-header"
      className={cn("gap-1 flex flex-col", className)}
      {...props}
    />
  )
}

function ModalBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-body"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  )
}

function ModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-footer"
      className={cn(
        "gap-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function ModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="modal-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function ModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="modal-description"
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-xs/relaxed *:[a]:underline *:[a]:underline-offset-3",
        className
      )}
      {...props}
    />
  )
}

/**
 * ImageModal - A specialized modal for displaying full-size images.
 * Optional footer (e.g. Live performance block for thumbnails) is rendered below the image.
 */
interface ImageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  alt: string
  title?: string
  /** Optional content below the image (e.g. live thumbnail performance) */
  footer?: React.ReactNode
}

function ImageModal({ open, onOpenChange, src, alt, title, footer }: ImageModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="4xl"
        className="flex flex-col gap-0 p-0 border-0 max-w-[75vw] max-h-[95vh] overflow-hidden bg-white dark:bg-black"
        showCloseButton={true}
      >
        {title && (
          <ModalHeader className="absolute top-2 left-2 z-10 pointer-events-none">
            <ModalTitle className="text-foreground drop-shadow-lg text-base font-semibold">
              {title}
            </ModalTitle>
          </ModalHeader>
        )}
        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
          <img
            src={src}
            alt={alt}
            className="h-auto max-h-[90vh] w-full object-contain transition-opacity duration-300"
            loading="eager"
          />
        </div>
        {footer && (
          <div className="border-t border-border bg-muted/30 px-4 py-3">
            {footer}
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}

/**
 * PaletteViewModal - Modal for displaying a larger view of a color palette (reuses same pattern as ImageModal)
 */
export interface PaletteViewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  colors: string[]
}

function PaletteViewModal({ open, onOpenChange, name, colors }: PaletteViewModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="2xl"
        className="p-0 overflow-hidden"
        showCloseButton={true}
      >
        <ModalHeader className="p-4 pb-0">
          <ModalTitle>{name}</ModalTitle>
          <ModalDescription>{colors.length} colors</ModalDescription>
        </ModalHeader>
        <div className="p-4">
          {colors.length > 0 ? (
            <div className="flex w-full overflow-hidden rounded-lg ring-1 ring-border">
              {colors.map((color, index) => (
                <div
                  key={`${color}-${index}`}
                  className="flex-1 min-h-[80px] transition-opacity hover:opacity-90"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm">
              No colors
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  )
}

export {
  Modal,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalPortal,
  ModalTitle,
  ModalTrigger,
  ImageModal,
  PaletteViewModal,
  modalContentVariants,
}
