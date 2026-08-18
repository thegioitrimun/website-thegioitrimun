import React from 'react';
import { getFallbackBlogImage } from '../types';

interface FallbackBlogImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  slug: string;
}

const FallbackBlogImage: React.FC<FallbackBlogImageProps> = ({ src, slug, alt, ...props }) => {
  const fallbackSrc = React.useMemo(() => getFallbackBlogImage(slug), [slug]);
  const [currentSrc, setCurrentSrc] = React.useState(src || fallbackSrc);

  React.useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [src, fallbackSrc]);

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
};

export default FallbackBlogImage;
