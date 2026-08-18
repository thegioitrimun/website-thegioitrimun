import React from 'react';
import { normalizeExternalUrl } from '../src/socialLinks';

interface AccessibleSocialLinkProps {
  href?: string | null;
  network: string;
  siteName: string;
  className?: string;
  children: React.ReactNode;
}

const AccessibleSocialLink: React.FC<AccessibleSocialLinkProps> = ({
  href,
  network,
  siteName,
  className = '',
  children,
}) => {
  const normalizedHref = normalizeExternalUrl(href);
  if (!normalizedHref) return null;

  const accessibleName = `${network} của ${siteName}`;

  return (
    <a
      href={normalizedHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={accessibleName}
      title={accessibleName}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </a>
  );
};

export default AccessibleSocialLink;
