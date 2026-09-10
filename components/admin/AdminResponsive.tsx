import React from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
export function AdminDesktopOnly({children,className}: {children:React.ReactNode;className?:string}) {
  const desktop = useMediaQuery('(min-width:1024px)');
  return desktop ? <div className={className}>{children}</div> : null;
}
