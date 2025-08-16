/// <reference path="../types/webawesome.d.ts" />

interface SkeletonLoaderProps {
  variant?: "card" | "list" | "table" | "text" | "avatar" | "pipeline"
  count?: number
  height?: string
  width?: string
  className?: string
}

export default function SkeletonLoader({
  variant = "text",
  count = 1,
  height = "1rem",
  width = "100%",
  className = "",
}: SkeletonLoaderProps) {
  const baseStyle = {
    background:
      "linear-gradient(90deg, var(--wa-color-neutral-fill-subtle) 25%, var(--wa-color-neutral-fill) 50%, var(--wa-color-neutral-fill-subtle) 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: "var(--wa-border-radius-s)",
  }

  const getVariantContent = () => {
    switch (variant) {
      case "card":
        return (
          <div className={`skeleton-card ${className}`} style={{ padding: "var(--wa-space-m)" }}>
            <div class="wa-stack wa-gap-s">
              <div class="wa-flank wa-gap-s">
                <div style={{ ...baseStyle, width: "40px", height: "40px", borderRadius: "50%" }}></div>
                <div class="wa-stack wa-gap-xs" style={{ flex: 1 }}>
                  <div style={{ ...baseStyle, height: "1.2rem", width: "60%" }}></div>
                  <div style={{ ...baseStyle, height: "0.9rem", width: "40%" }}></div>
                </div>
              </div>
              <div style={{ ...baseStyle, height: "2rem", width: "30%" }}></div>
              <div class="wa-stack wa-gap-2xs">
                <div style={{ ...baseStyle, height: "0.8rem", width: "80%" }}></div>
                <div style={{ ...baseStyle, height: "0.8rem", width: "60%" }}></div>
              </div>
            </div>
          </div>
        )

      case "pipeline":
        return (
          <div
            className={`skeleton-pipeline ${className}`}
            style={{
              padding: "var(--wa-space-m)",
              border: "1px solid var(--wa-color-border-subtle)",
              borderRadius: "var(--wa-border-radius-s)",
            }}
          >
            <div class="wa-stack wa-gap-s">
              <div class="wa-flank wa-gap-s">
                <div style={{ ...baseStyle, width: "24px", height: "24px", borderRadius: "50%" }}></div>
                <div style={{ ...baseStyle, height: "1.2rem", width: "50%" }}></div>
              </div>
              <div style={{ ...baseStyle, height: "1rem", width: "35%" }}></div>
              <div style={{ ...baseStyle, height: "2rem", width: "25%" }}></div>
              <div class="wa-cluster wa-gap-xs">
                <div style={{ ...baseStyle, height: "1.5rem", width: "60px" }}></div>
                <div style={{ ...baseStyle, height: "1.5rem", width: "40px" }}></div>
              </div>
              <div class="wa-flank">
                <div class="wa-stack wa-gap-2xs">
                  <div style={{ ...baseStyle, height: "0.8rem", width: "60px" }}></div>
                  <div style={{ ...baseStyle, height: "1rem", width: "80px" }}></div>
                </div>
                <div style={{ ...baseStyle, height: "0.8rem", width: "100px" }}></div>
              </div>
            </div>
          </div>
        )

      case "list":
        return (
          <div className={`skeleton-list ${className}`}>
            <div class="wa-stack wa-gap-s">
              {Array.from(
                { length: count },
                (_, i) => (
                  <div key={i} class="wa-flank wa-gap-s" style={{ padding: "var(--wa-space-s)" }}>
                    <div style={{ ...baseStyle, width: "20px", height: "20px", borderRadius: "50%" }}></div>
                    <div class="wa-stack wa-gap-2xs" style={{ flex: 1 }}>
                      <div style={{ ...baseStyle, height: "1rem", width: "70%" }}></div>
                      <div style={{ ...baseStyle, height: "0.8rem", width: "50%" }}></div>
                    </div>
                    <div style={{ ...baseStyle, height: "1.5rem", width: "60px" }}></div>
                  </div>
                ),
              )}
            </div>
          </div>
        )

      case "table":
        return (
          <div className={`skeleton-table ${className}`}>
            {Array.from(
              { length: count },
              (_, i) => (
                <div
                  key={i}
                  class="wa-cluster wa-gap-m"
                  style={{ padding: "var(--wa-space-s)", borderBottom: "1px solid var(--wa-color-border-subtle)" }}
                >
                  <div style={{ ...baseStyle, height: "1rem", width: "15%" }}></div>
                  <div style={{ ...baseStyle, height: "1rem", width: "25%" }}></div>
                  <div style={{ ...baseStyle, height: "1rem", width: "20%" }}></div>
                  <div style={{ ...baseStyle, height: "1rem", width: "15%" }}></div>
                  <div style={{ ...baseStyle, height: "1rem", width: "10%" }}></div>
                </div>
              ),
            )}
          </div>
        )

      case "avatar":
        return (
          <div className={`skeleton-avatar ${className}`}>
            <div style={{ ...baseStyle, width: height, height: height, borderRadius: "50%" }}></div>
          </div>
        )

      default: // text
        return (
          <div className={`skeleton-text ${className}`}>
            {Array.from({ length: count }, (_, i) => (
              <div
                key={i}
                style={{
                  ...baseStyle,
                  height,
                  width: i === count - 1 ? "60%" : width,
                  marginBottom: count > 1 ? "var(--wa-space-2xs)" : 0,
                }}
              >
              </div>
            ))}
          </div>
        )
    }
  }

  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% {
              background-position: -200% 0;
            }
            100% {
              background-position: 200% 0;
            }
          }
          
          .skeleton-card,
          .skeleton-pipeline,
          .skeleton-list,
          .skeleton-table,
          .skeleton-text,
          .skeleton-avatar {
            pointer-events: none;
            user-select: none;
          }
        `}
      </style>
      {getVariantContent()}
    </>
  )
}
