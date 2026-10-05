"use client"

import type React from "react"
import { Bell, Check, Loader2, X } from "lucide-react"
import { Toaster as Sonner, toast as sonnerToast, type ExternalToast } from "sonner"

type NotifyOptions = Pick<
  ExternalToast,
  | "duration"
  | "id"
  | "action"
  | "cancel"
  | "closeButton"
  | "dismissible"
  | "testId"
  | "onDismiss"
  | "onAutoClose"
  | "className"
  | "icon"
>

function toastOptions(
  description?: string,
  options?: NotifyOptions
): ExternalToast | undefined {
  const merged: ExternalToast = { ...options }
  if (description) merged.description = description
  return Object.keys(merged).length > 0 ? merged : undefined
}

/** Flat colored circle badge with a white glyph, per the toast design spec. */
function ToastBadge({
  background,
  children,
}: {
  background: string
  children: React.ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full"
      style={{ backgroundColor: background }}
    >
      {children}
    </span>
  )
}

/** Success: flat green circle with a white tick. */
function SuccessToastIcon() {
  return (
    <ToastBadge background="#10B981">
      <Check
        aria-hidden="true"
        className="h-3 w-3 text-white"
        strokeWidth={3.5}
      />
    </ToastBadge>
  )
}

/** Error: flat red circle with a white x. */
function ErrorToastIcon() {
  return (
    <ToastBadge background="#EF4444">
      <X
        aria-hidden="true"
        className="h-3 w-3 text-white"
        strokeWidth={3.5}
      />
    </ToastBadge>
  )
}

/** Info: flat blue circle with a white "i". */
function InfoToastIcon() {
  return (
    <ToastBadge background="#3B82F6">
      <span
        aria-hidden="true"
        className="font-sans text-[11px] font-bold leading-none text-white"
      >
        {"i"}
      </span>
    </ToastBadge>
  )
}

/** Warning: flat orange circle with a white "!". */
function WarningToastIcon() {
  return (
    <ToastBadge background="#F97316">
      <span
        aria-hidden="true"
        className="font-sans text-[11px] font-bold leading-none text-white"
      >
        {"!"}
      </span>
    </ToastBadge>
  )
}

/** Reminder: flat purple circle with a white bell (pass via the `icon` option). */
export function ReminderToastIcon() {
  return (
    <ToastBadge background="#8B5CF6">
      <Bell
        aria-hidden="true"
        className="h-3 w-3 text-white"
        fill="white"
      />
    </ToastBadge>
  )
}

/** Standard toast API — title plus optional description (matches styled [data-title] / [data-description]). */
export const notify = {
  error: (title: string, description?: string, options?: NotifyOptions) =>
    sonnerToast.error(title, toastOptions(description, options)),
  success: (title: string, description?: string, options?: NotifyOptions) =>
    sonnerToast.success(title, toastOptions(description, options)),
  info: (title: string, description?: string, options?: NotifyOptions) =>
    sonnerToast.info(title, toastOptions(description, options)),
  warning: (title: string, description?: string, options?: NotifyOptions) =>
    sonnerToast.warning(title, toastOptions(description, options)),
  loading: (title: string, description?: string, options?: NotifyOptions) =>
    sonnerToast.loading(title, toastOptions(description, options)),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
} as const

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ icons, ...props }: ToasterProps) => {
  const defaultIcons: NonNullable<ToasterProps["icons"]> = {
    success: <SuccessToastIcon />,
    error: <ErrorToastIcon />,
    info: <InfoToastIcon />,
    warning: <WarningToastIcon />,
    loading: (
      <Loader2
        aria-hidden="true"
        className="h-5 w-5 animate-spin text-[#1D6FE8]"
      />
    ),
    close: <X aria-hidden="true" className="h-4 w-4" />,
  }

  return (
    <>
      <style jsx global>{`
        /* Near Sonner default width on desktop; nearly full width on narrow screens */
        [data-sonner-toaster] {
          --width: min(100dvw - 1.5rem, 22.5rem) !important;
          box-sizing: border-box !important;
        }

        @media (min-width: 640px) {
          [data-sonner-toaster] {
            --width: min(100dvw - 2rem, 24rem) !important;
          }
        }

        [data-sonner-toaster]:has(.template-v2-model-warning-toast) {
          --width: min(100dvw - 2rem, 48rem) !important;
        }

        /* Neutral "card" toast container — soft rounded pastel card */
        [data-sonner-toast][data-styled="true"] {
          border-radius: 14px !important;

          border: 1px solid #E5E7EB !important;
          background: rgba(255, 255, 255, 0.94) !important;
          box-shadow:
            0 8px 24px -4px rgba(16, 24, 40, 0.08),
            0 2px 6px -1px rgba(16, 24, 40, 0.04) !important;
          padding: clamp(9px, 0.5rem + 0.35vw, 12px) clamp(11px, 0.65rem + 0.5vw, 14px) !important;
          gap: clamp(8px, 0.5rem + 0.35vw, 11px) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        /* Typography — slight scale-up from original 12px, capped modestly */
        [data-sonner-toast][data-styled="true"] [data-title] {
          font-family: var(--gslide-font-ui) !important;
          font-size: clamp(0.8125rem, 0.8rem + 0.12vw, 0.9375rem) !important;
          font-weight: 500 !important;
          line-height: 1.35 !important;
          letter-spacing: 0.03em !important;
          color: rgb(15 23 42) !important; /* slate-900 */
          text-transform: none !important;
          overflow-wrap: anywhere !important;
        }

        [data-sonner-toast][data-styled="true"] [data-description] {
          font-family: var(--gslide-font-ui) !important;
          font-size: clamp(0.6875rem, 0.67rem + 0.1vw, 0.8125rem) !important;
          font-weight: 400 !important;
          line-height: 1.4 !important;
          letter-spacing: 0.03em !important;
          color: rgb(100 116 139) !important; /* slate-500 */
          overflow-wrap: anywhere !important;
        }

        [data-sonner-toast][data-styled="true"] [data-content] {
          gap: clamp(2px, 0.15vw, 5px) !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
        }

        /* Left icon badge */
        [data-sonner-toast][data-styled="true"] [data-icon] {
          width: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
          height: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
          flex-shrink: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
        }

        /* Only size a bare svg icon; badge-wrapped glyphs keep their own size */
        [data-sonner-toast][data-styled="true"] [data-icon] > svg {
          width: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
          height: clamp(20px, 1.15rem + 0.35vw, 22px) !important;
        }

        /* Pastel gradient + subtle diagonal stripes per toast type */
        [data-sonner-toast][data-type="success"] {
          background:
            linear-gradient(to right, #FFFFFF 20%, rgba(236, 253, 245, 0.7) 100%),
            repeating-linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0, rgba(16, 185, 129, 0.09) 8px, transparent 8px, transparent 16px) !important;
          border-color: #A7F3D0 !important;
        }

        [data-sonner-toast][data-type="info"] {
          background:
            linear-gradient(to right, #FFFFFF 20%, rgba(239, 246, 255, 0.7) 100%),
            repeating-linear-gradient(135deg, rgba(59, 130, 246, 0.09) 0, rgba(59, 130, 246, 0.09) 8px, transparent 8px, transparent 16px) !important;
          border-color: #BFDBFE !important;
        }

        [data-sonner-toast][data-type="warning"] {
          background:
            linear-gradient(to right, #FFFFFF 20%, rgba(255, 247, 237, 0.7) 100%),
            repeating-linear-gradient(135deg, rgba(249, 115, 22, 0.09) 0, rgba(249, 115, 22, 0.09) 8px, transparent 8px, transparent 16px) !important;
          border-color: #FED7AA !important;
        }

        [data-sonner-toast][data-type="error"] {
          background:
            linear-gradient(to right, #FFFFFF 20%, rgba(255, 241, 242, 0.7) 100%),
            repeating-linear-gradient(135deg, rgba(239, 68, 68, 0.09) 0, rgba(239, 68, 68, 0.09) 8px, transparent 8px, transparent 16px) !important;
          border-color: #FECDD3 !important;
        }

        /* Rounded white pill action button */
        [data-sonner-toast][data-styled="true"] [data-button] {
          height: auto !important;
          padding: 5px 12px !important;
          border-radius: 8px !important;
          font-family: var(--gslide-font-ui) !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          line-height: 1.3 !important;
          background: #FFFFFF !important;
          color: #0F172A !important;
          border: 1px solid #E2E8F0 !important;
          box-shadow: none !important;
        }

        [data-sonner-toast][data-styled="true"] [data-button]:hover {
          background: #F8FAFC !important;
        }

        /* Round icon-only close (X) button */
        [data-sonner-toast][data-styled="true"] [data-close-button] {
          position: static !important;
          inset: auto !important;
          transform: none !important;
          order: 9999 !important;
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          width: 24px !important;
          height: 24px !important;
          padding: 4px !important;
          border-radius: 9999px !important;
          margin-left: auto !important;
          margin-right: 0 !important;
          align-self: center !important;
          background: transparent !important;
          border: none !important;
          color: #64748B !important;
          box-shadow: none !important;
          font-family: var(--gslide-font-ui) !important;
        }

        [data-sonner-toast][data-styled="true"] [data-close-button] svg {
          width: 16px !important;
          height: 16px !important;
        }

        [data-sonner-toast][data-styled="true"] [data-close-button]:hover {
          background: rgba(0, 0, 0, 0.05) !important;
          color: #0F172A !important;
        }

        /* When the toast has an Action Button, hide the Close (X) button */
        [data-sonner-toast]:has([data-button]) [data-close-button] {
          display: none !important;
        }

        [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast {
          align-items: center !important;
          gap: 14px !important;
          padding: 14px 16px !important;
          width: min(100dvw - 2rem, 48rem) !important;
          max-width: min(100dvw - 2rem, 48rem) !important;
        }

        [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-icon] {
          align-self: flex-start !important;
          margin-top: 2px !important;
        }

        [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-content] {
          flex: 1 1 auto !important;
          max-width: none !important;
          min-width: 0 !important;
        }

        [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-title] {
          font-size: 0.9375rem !important;
          line-height: 1.3 !important;
        }

        [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-description] {
          max-width: 34rem !important;
          line-height: 1.45 !important;
        }

        [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-button] {
          margin-left: auto !important;
          white-space: nowrap !important;
        }

        @media (max-width: 640px) {
          [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast {
            flex-wrap: wrap !important;
            align-items: flex-start !important;
          }

          [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-content] {
            flex-basis: calc(100% - 38px) !important;
          }

          [data-sonner-toast][data-styled="true"].template-v2-model-warning-toast [data-button] {
            margin-left: 38px !important;
          }
        }

        /* Dark mode — same radius, border weight, shadow; frosted dark surface */
        .dark [data-sonner-toast][data-styled="true"] {
          border-radius: 14px !important;
          border: 1px solid rgba(148, 163, 184, 0.22) !important;
          background: rgba(2, 6, 23, 0.94) !important;
          box-shadow:
            0 8px 24px -4px rgba(0, 0, 0, 0.08),
            0 2px 6px -1px rgba(0, 0, 0, 0.04) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
        }

        .dark [data-sonner-toast][data-styled="true"] [data-title] {
          color: rgb(248 250 252) !important; /* slate-50 */
        }

        .dark [data-sonner-toast][data-styled="true"] [data-description] {
          color: rgb(148 163 184) !important; /* slate-400 */
        }

        .dark [data-sonner-toast][data-styled="true"] [data-button] {
          background: rgb(2 6 23) !important;
          color: rgb(248 250 252) !important;
          border: 1px solid rgba(148, 163, 184, 0.26) !important;
        }

        .dark [data-sonner-toast][data-styled="true"] [data-button]:hover {
          background: rgb(15 23 42) !important; /* slate-900 */
        }

        .dark [data-sonner-toast][data-styled="true"] [data-close-button] {
          background: transparent !important;
          color: rgb(148 163 184) !important;
          border: none !important;
        }

        .dark [data-sonner-toast][data-styled="true"] [data-close-button]:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          color: rgb(248 250 252) !important;
        }
      `}</style>
      <Sonner
        style={{ zIndex: 999999999 }}
        className="toaster group z-50 bg-transparent"
        icons={{ ...defaultIcons, ...(icons ?? {}) }}
        closeButton
        toastOptions={{
          closeButton: true,
          closeButtonAriaLabel: "Dismiss notification",
          classNames: {
            toast: "group toast",
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:rounded-2xl group-[.toast]:border group-[.toast]:border-slate-200 group-[.toast]:bg-white group-[.toast]:text-slate-900 hover:group-[.toast]:bg-slate-50",
            cancelButton:
              "group-[.toast]:rounded-2xl group-[.toast]:border group-[.toast]:border-slate-200 group-[.toast]:bg-white group-[.toast]:text-slate-700 hover:group-[.toast]:bg-slate-50",
          },
        }}
        {...props}
      />
    </>
  )
}

export { Toaster }
