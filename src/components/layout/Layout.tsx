import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import HeroLevelBar from './HeroLevelBar';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

const Layout = ({ children, title }: LayoutProps) => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto">
          <HeroLevelBar />
          <div className="px-6 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
