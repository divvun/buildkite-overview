/// <reference path="../types/webawesome.d.ts" />
import type { ComponentChildren } from "preact"

export interface EmptyStateProps {
  icon: string
  title: string
  description: string
  variant?: "neutral" | "success" | "warning" | "danger"
  children?: ComponentChildren
  maxWidth?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  variant = "neutral",
  children,
  maxWidth = "900px",
}: EmptyStateProps) {
  const getIconColor = (variant: string): string => {
    switch (variant) {
      case "success":
        return "var(--wa-color-success-fill-loud)"
      case "warning":
        return "var(--wa-color-warning-fill-loud)"
      case "danger":
        return "var(--wa-color-danger-fill-loud)"
      default:
        return "var(--wa-color-neutral-fill-loud)"
    }
  }

  return (
    <wa-card style={`max-width: ${maxWidth}`}>
      <div class="wa-stack wa-gap-s wa-align-items-center" style="padding: var(--wa-space-l)">
        <wa-icon
          name={icon}
          style={`font-size: 3rem; color: ${getIconColor(variant)}`}
        />
        <h3 class="wa-heading-m">{title}</h3>
        <p class="wa-body-m wa-color-text-quiet" style="text-align: center">
          {description}
        </p>
        {children && (
          <div class="wa-stack wa-gap-s" style="margin-top: var(--wa-space-s)">
            {children}
          </div>
        )}
      </div>
    </wa-card>
  )
}
