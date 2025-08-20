import { useLocalization } from "~/utils/localization-context.tsx"

interface LoginRequiredProps {
  resource: "logs" | "private-pipeline" | "admin"
  returnUrl?: string
}

export default function LoginRequired({ resource, returnUrl }: LoginRequiredProps) {
  const { t } = useLocalization()
  
  // Build login URL with return parameter
  const loginUrl = returnUrl 
    ? `/auth/login?return=${encodeURIComponent(returnUrl)}`
    : "/auth/login"
  
  return (
    <wa-card>
      <div class="wa-stack wa-gap-m wa-align-items-center" style="padding: var(--wa-space-l); text-align: center;">
        <wa-icon 
          name="lock" 
          style="font-size: 3rem; color: var(--wa-color-neutral-fill-loud)"
        />
        
        <h3 class="wa-heading-m">
          {t(`login-required-${resource}-title`)}
        </h3>
        
        <p class="wa-body-m wa-color-text-quiet" style="max-width: 400px">
          {t(`login-required-${resource}-description`)}
        </p>
        
        <wa-button 
          href={loginUrl}
          variant="brand" 
          size="large"
        >
          <wa-icon slot="prefix" name="github" />
          {t("sign-in-with-github")}
        </wa-button>
        
        <p class="wa-caption-s wa-color-text-quiet">
          {t("login-secure-note")}
        </p>
      </div>
    </wa-card>
  )
}