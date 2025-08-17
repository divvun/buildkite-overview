import { useLocalization } from "~/utils/localization-context.tsx"

interface LanguageSelectorProps {
  currentLocale: string
}

export default function LanguageSelector({ currentLocale }: LanguageSelectorProps) {
  const { t } = useLocalization()

  const languages = [
    { code: "en", name: t("language-english") },
    { code: "nb", name: t("language-norwegian-bokmal") },
    { code: "nn", name: t("language-norwegian-nynorsk") },
  ]

  const currentLanguage = languages.find((lang) => lang.code === currentLocale) || languages[0]

  const handleLanguageChange = (languageCode: string) => {
    // Set the language cookie and reload the page
    document.cookie = `lang=${languageCode}; path=/; max-age=${60 * 60 * 24 * 365}` // 1 year
    globalThis.location.reload()
  }

  return (
    <wa-dropdown>
      <wa-button
        slot="trigger"
        size="small"
        appearance="plain"
        with-caret
        aria-label={t("select-language")}
      >
        <wa-icon slot="prefix" name="globe"></wa-icon>
        {currentLanguage.name}
      </wa-button>

      {languages.map((language) => (
        <wa-dropdown-item
          key={language.code}
          onClick={() => handleLanguageChange(language.code)}
          aria-current={language.code === currentLocale ? "true" : undefined}
        >
          {language.name}
          {language.code === currentLocale && (
            <wa-icon slot="suffix" name="check" style="color: var(--wa-color-success-text-loud)"></wa-icon>
          )}
        </wa-dropdown-item>
      ))}
    </wa-dropdown>
  )
}
