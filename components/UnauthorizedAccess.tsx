/// <reference path="../types/webawesome.d.ts" />
import type { ComponentChildren } from "preact"

export interface UnauthorizedAccessProps {
  title?: string
  description?: string
  children?: ComponentChildren
  t?: (id: string, args?: Record<string, unknown>) => string
}

export default function UnauthorizedAccess({
  title,
  description,
  children,
  t,
}: UnauthorizedAccessProps) {
  // Use translation function if provided, otherwise fallback to defaults
  const translate = t || ((id: string) => id)
  const finalTitle = title || translate("access-denied")
  const finalDescription = description || translate("unauthorized-description")
  return (
    <wa-card style="margin: var(--wa-space-l) auto;">
      <div class="wa-stack wa-gap-m" style="padding: var(--wa-space-l)">
        <div class="wa-stack wa-gap-s wa-align-items-center">
          <wa-icon
            name="shield-exclamation"
            style="font-size: 3rem; color: var(--wa-color-warning-fill-loud)"
          />
          <h2 class="wa-heading-l">{finalTitle}</h2>
          <p class="wa-body-m wa-color-text-quiet" style="text-align: center">
            {finalDescription}
          </p>
        </div>

        <wa-divider />

        <div class="wa-stack wa-gap-s">
          <h3 class="wa-heading-s">{translate("what-you-can-do")}</h3>
          <ul class="wa-stack wa-gap-xs" style="padding-left: var(--wa-space-m)">
            <li class="wa-body-s">{translate("contact-admin")}</li>
            <li class="wa-body-s">{translate("verify-account")}</li>
            <li class="wa-body-s">{translate("accept-invitation")}</li>
          </ul>
        </div>

        {children && (
          <div style="margin-top: var(--wa-space-s)">
            {children}
          </div>
        )}

        <div class="wa-cluster wa-gap-s">
          <wa-button>
            <wa-icon slot="prefix" name="arrow-left" />
            <a href="/" style="text-decoration: none; color: inherit">
              {translate("return-to-dashboard")}
            </a>
          </wa-button>
          <wa-button variant="brand" appearance="outlined">
            <wa-icon slot="prefix" name="log-out" />
            <a href="/auth/logout" style="text-decoration: none; color: inherit">
              {translate("sign-out")}
            </a>
          </wa-button>
        </div>
      </div>
    </wa-card>
  )
}
