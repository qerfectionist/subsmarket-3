import { useState } from "react";
import { resolveServiceBrand, serviceIconUrl } from "./serviceBranding";
import { CategoryGlyph } from "./CategoryGlyph";

export function ServiceLogo({
  serviceSlug,
  serviceName,
  familyType,
  size = 44,
  loading = "lazy",
  decoding = "async"
}: {
  serviceSlug?: string | null;
  serviceName?: string | null;
  familyType?: "subscription" | "tariff";
  size?: number;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
}) {
  const brand = resolveServiceBrand({ serviceSlug, serviceName, familyType });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isMonochrome = Boolean(
    brand.monochrome ||
      ["#000000", "#111111", "#FFFFFF"].includes(brand.color.toUpperCase())
  );
  const isYoutube = Boolean(
    serviceSlug?.trim().toLowerCase().includes("youtube") ||
      serviceName?.trim().toLowerCase().includes("youtube")
  );
  const logoSrc = brand.logoPath ?? (brand.iconSlug ? serviceIconUrl(brand.iconSlug, isMonochrome ? "ffffff" : brand.color) : null);

  return (
    <span
      className={`service-logo service-logo-plain${isMonochrome ? " service-logo-monochrome" : ""}${isYoutube ? " service-logo-youtube" : ""}`}
      data-monochrome={isMonochrome ? "true" : undefined}
      data-monochrome-source={isMonochrome ? "dark" : undefined}
      style={{
        backgroundColor: "transparent",
        height: size,
        width: size
      }}
      aria-hidden
    >
      {logoSrc && failedSrc !== logoSrc ? (
        <img
          className="service-logo-image"
          src={logoSrc}
          alt=""
          loading={loading}
          decoding={decoding}
          onError={() => setFailedSrc(logoSrc)}
        />
      ) : brand.monogram === "📱" ? (
        <CategoryGlyph category="mobile_tariffs" />
      ) : (
        <span className="service-logo-monogram">{brand.monogram || serviceName?.slice(0, 1)}</span>
      )}
    </span>
  );
}
