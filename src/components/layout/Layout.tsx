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
        <main className="flex-1 overflow-y-auto stadium-bg relative">
          {/* Stadium background image */}
          <div 
            className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?w=1920&q=80')` }}
          />
          {/* Stadium spotlight overlays */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[120px] animate-neon-pulse" />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-purple/[0.04] blur-[120px]" />
            <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-secondary/[0.02] blur-[100px]" />
            {/* Scan line effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.01] to-transparent" 
                 style={{ backgroundSize: '100% 4px', backgroundRepeat: 'repeat' }} />
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
