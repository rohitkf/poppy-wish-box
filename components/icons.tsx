import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, strokeWidth = 1.8, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Pin: (p: P) => (
    <Svg {...p}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Svg>
  ),
  Bag: (p: P) => (
    <Svg {...p}>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </Svg>
  ),
  Heart: (p: P) => (
    <Svg {...p}>
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
    </Svg>
  ),
  Home: (p: P) => (
    <Svg {...p}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  ),
  Star: (p: P) => (
    <Svg {...p}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" />
    </Svg>
  ),
  Gift: (p: P) => (
    <Svg {...p}>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8c-2-3.5-5.5-3.5-5.5-1.5S9 8 12 8zM12 8c2-3.5 5.5-3.5 5.5-1.5S15 8 12 8z" />
    </Svg>
  ),
  Plane: (p: P) => (
    <Svg {...p}>
      <path d="M10.5 13.5L4 11l1.5-1.5 7 1 4-4c1-1 2.5-1.2 3-.7s.3 2-.7 3l-4 4 1 7L14.3 21l-2.5-6.5" />
    </Svg>
  ),
  Fork: (p: P) => (
    <Svg {...p}>
      <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10" />
      <path d="M17 21V3c-2 1-3.5 3.5-3.5 7 0 2 1.5 3 3.5 3" />
    </Svg>
  ),
  Film: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </Svg>
  ),
  Book: (p: P) => (
    <Svg {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </Svg>
  ),
  Plus: (p: P) => (
    <Svg strokeWidth={2.2} {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  Search: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  ),
  Back: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  ),
  Close: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  More: ({ size = 22, ...p }: P) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  Chevron: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  ChevronRight: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  Check: (p: P) => (
    <Svg strokeWidth={2.4} {...p}>
      <path d="M5 12l5 5 9-10" />
    </Svg>
  ),
  Eye: (p: P) => (
    <Svg {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  EyeOff: (p: P) => (
    <Svg {...p}>
      <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Svg>
  ),
  Lock: (p: P) => (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  ),
  Photo: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-9 8" />
    </Svg>
  ),
  Camera: (p: P) => (
    <Svg {...p}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  ),
  External: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <path d="M7 17L17 7M9 7h8v8" />
    </Svg>
  ),
  Grip: ({ size = 20, ...p }: P) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  ),
  Settings: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Svg>
  ),
  Trash: (p: P) => (
    <Svg {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Svg>
  ),
  Archive: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v11h14V9M10 13h4" />
    </Svg>
  ),
  CloudOff: (p: P) => (
    <Svg {...p}>
      <path d="M3 3l18 18M8.5 6.2A6 6 0 0 1 17.7 10h.3a4 4 0 0 1 2.3 7.3M17 18H7a4.5 4.5 0 0 1-1.2-8.8" />
    </Svg>
  ),
  Sort: (p: P) => (
    <Svg strokeWidth={2} {...p}>
      <path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" />
    </Svg>
  ),
};

export const LIST_ICONS: Record<string, (p: P) => React.ReactElement> = {
  "icon:pin": Icon.Pin,
  "icon:bag": Icon.Bag,
  "icon:heart": Icon.Heart,
  "icon:home": Icon.Home,
  "icon:star": Icon.Star,
  "icon:gift": Icon.Gift,
  "icon:plane": Icon.Plane,
  "icon:fork": Icon.Fork,
  "icon:film": Icon.Film,
  "icon:book": Icon.Book,
};

/** Renders a list's icon: a built-in line icon, or the emoji the couple picked. */
export function ListGlyph({ emoji, size = 24 }: { emoji: string; size?: number }) {
  // hasOwn: an "emoji" like "constructor" must not resolve to Object's built-ins.
  const Cmp = Object.hasOwn(LIST_ICONS, emoji) ? LIST_ICONS[emoji] : undefined;
  if (Cmp) return <Cmp size={size} />;
  return (
    <span style={{ fontSize: size * 0.9, lineHeight: 1 }} aria-hidden="true">
      {emoji}
    </span>
  );
}
