import React from 'react';

interface FallbackPublicImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackSrc?: string;
}

const DEFAULT_FALLBACK_PUBLIC_IMAGE = '/seo/og-default.jpg';

const FallbackPublicImage = React.forwardRef<HTMLImageElement, FallbackPublicImageProps>(({
  src,
  fallbackSrc = DEFAULT_FALLBACK_PUBLIC_IMAGE,
  alt,
  onError,
  decoding = 'async',
  ...props
}, ref) => {
  const resolvedFallbackSrc = String(fallbackSrc || DEFAULT_FALLBACK_PUBLIC_IMAGE).trim() || DEFAULT_FALLBACK_PUBLIC_IMAGE;
  const [currentSrc, setCurrentSrc] = React.useState(() => String(src || '').trim() || resolvedFallbackSrc);

  React.useEffect(() => {
    setCurrentSrc(String(src || '').trim() || resolvedFallbackSrc);
  }, [src, resolvedFallbackSrc]);

  return (
    <img
      {...props}
      ref={ref}
      src={currentSrc}
      alt={alt}
      decoding={decoding}
      onError={(event) => {
        if (currentSrc !== resolvedFallbackSrc) {
          setCurrentSrc(resolvedFallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
});

FallbackPublicImage.displayName = 'FallbackPublicImage';

export default FallbackPublicImage;
