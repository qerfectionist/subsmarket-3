import { resolveServiceBrand, serviceIconUrl } from "./serviceBranding";
import { CategoryGlyph } from "./CategoryGlyph";

export function ServiceLogo({
  serviceSlug,
  serviceName,
  familyType,
  size = 44
}: {
  serviceSlug?: string | null;
  serviceName?: string | null;
  familyType?: "subscription" | "tariff";
  size?: number;
}) {
  const brand = resolveServiceBrand({ serviceSlug, serviceName, familyType });

  return (
    <span
      className="service-logo"
      style={{
        backgroundColor: brand.color,
        height: size,
        width: size
      }}
      aria-hidden
    >
      {brand.iconSlug ? (
        <img
          className="service-logo-image"
          src={serviceIconUrl(brand.iconSlug)}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : brand.monogram === "📱" ? (
        <CategoryGlyph category="mobile_tariffs" />
      ) : (
        <span className="service-logo-monogram">{brand.monogram || serviceName?.slice(0, 1)}</span>
      )}
    </span>
  );
}