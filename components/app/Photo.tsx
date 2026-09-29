"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { localPreviews } from "@/lib/client/store";
import type { ItemPhoto } from "@/lib/types";

export function photoSrc(photo: ItemPhoto) {
  return localPreviews.get(photo.id) ?? `/api/photos/${photo.id}`;
}

export function PhotoThumb({
  photo,
  size,
  width,
  height,
  onClick,
  radius = 10,
}: {
  photo: ItemPhoto;
  size?: number;
  width?: number;
  height?: number;
  onClick?: () => void;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const w = width ?? size ?? 56;
  const h = height ?? size ?? 56;
  const box = { width: w, height: h, borderRadius: radius };
  const content = failed ? (
    <span className="flex h-full w-full items-center justify-center bg-sunken text-ink-3" style={box}>
      <Icon.Photo size={20} />
    </span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoSrc(photo)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full bg-sunken object-cover"
      style={box}
    />
  );
  if (!onClick) return <span className="block shrink-0" style={box}>{content}</span>;
  return (
    <button type="button" onClick={onClick} className="block shrink-0 overflow-hidden" style={box} aria-label="Open item">
      {content}
    </button>
  );
}
