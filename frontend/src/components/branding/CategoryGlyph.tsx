import type { ServiceCategory } from "./serviceBranding";

export function CategoryGlyph({ category }: { category: ServiceCategory }) {
  if (category === "music_audio") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M9 18V6l10-2v12"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="7" cy="18" r="3" fill="currentColor" />
        <circle cx="17" cy="16" r="3" fill="currentColor" />
      </svg>
    );
  }

  if (category === "education_books") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M6.5 3v16" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (category === "cloud_productivity") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6-1.4A3.5 3.5 0 0 0 7 18Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (category === "security_utilities") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 3 19 6v6c0 4.2-2.9 7.4-7 9-4.1-1.6-7-4.8-7-9V6l7-3Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (category === "mobile_tariffs") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect
          x="7"
          y="3"
          width="10"
          height="18"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M11 18h2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="m8 6 8 4-8 4V6Z"
        fill="currentColor"
      />
      <rect
        x="4"
        y="5"
        width="14"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}