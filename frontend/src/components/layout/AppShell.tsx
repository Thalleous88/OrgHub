import type { ReactNode } from 'react';
import Sidebar, { SidebarProvider, useSidebar } from './Sidebar';
import TopBar from './TopBar';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
}

function AppShellInner({ children }: AppShellProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="appshell">
      <Sidebar />
      <main
        className={`appshell__main${collapsed ? ' appshell__main--collapsed' : ''}`}
      >
        <TopBar />
        <div className="appshell__content">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}
