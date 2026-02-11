import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import HeroLevelBar from './HeroLevelBar';

interface LayoutProps {
  children: ReactNode;
  title: string;
  hideHeroLevelBar?: boolean;
}

const Layout = ({ children, title, hideHeroLevelBar }: LayoutProps) => {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto">
          {!hideHeroLevelBar && <HeroLevelBar />}
          <div className="px-6 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
