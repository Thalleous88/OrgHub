import type { ReactNode } from 'react';
import Sidebar from '../Sidebar';
import TopBar from './TopBar';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="appshell">
      <Sidebar />
      <main className="appshell__main">
        <TopBar />
        <div className="appshell__content">{children}</div>
      </main>
    </div>
  );
}
