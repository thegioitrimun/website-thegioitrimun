import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ADMIN_PORTAL_CONTAINER_ID = 'admin-portal-root';

export function getOrCreateAdminPortalHost(): HTMLElement {
  let host = document.getElementById(ADMIN_PORTAL_CONTAINER_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = ADMIN_PORTAL_CONTAINER_ID;
    host.className = 'admin-theme-root font-sans';
    document.body.appendChild(host);
  }
  return host;
}

export interface AdminPortalProps {
  children: React.ReactNode;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ children }) => {
  const [hostElement, setHostElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const host = getOrCreateAdminPortalHost();
    setHostElement(host);
  }, []);

  if (!hostElement) {
    return null;
  }

  return createPortal(children, hostElement);
};

export default AdminPortal;
