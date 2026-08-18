import React from 'react';

interface AdminShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

const AdminShell: React.FC<AdminShellProps> = ({ sidebar, children }) => {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_hsl(var(--background))_0%,_rgba(244,241,233,0.82)_100%)] text-foreground">
      <div className="mx-auto max-w-[1680px] px-3 pb-24 pt-3 sm:px-4 md:px-6 lg:py-6">
        <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)] xl:gap-7 2xl:grid-cols-[268px_minmax(0,1fr)]">
          <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start transition-all duration-700 ease-custom-bezier opacity-100 translate-y-0">
            {sidebar}
          </div>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default AdminShell;
