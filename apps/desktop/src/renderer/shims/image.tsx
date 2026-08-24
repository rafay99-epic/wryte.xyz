import type { CSSProperties } from "react";

type NextImageProps = {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * Shim for `next/image` — plain <img>. Next-only props are accepted and
 * ignored; `fill` maps to absolute positioning like the Next behavior.
 */
export function Image({
  src,
  alt,
  width,
  height,
  fill,
  className,
  style,
  onLoad,
  onError,
}: NextImageProps) {
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={onLoad}
        onError={onError}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          ...style,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

export default Image;
