import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import { pageTransition } from '@/lib/animations';

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
        <main className="flex-1 overflow-y-auto relative">
          {/* Subtle background glow */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[120px]" />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/[0.02] blur-[120px]" />
          </div>
          <motion.div
            className="px-6 py-6 relative z-10"
            variants={pageTransition}
            initial="hidden"
            animate="show"
            exit="exit"
            key={title}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
