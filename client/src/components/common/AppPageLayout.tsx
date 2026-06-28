import React from 'react';
import Header from './Header';

interface AppPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const AppPageLayout: React.FC<AppPageLayoutProps> = ({
  children,
  className = '',
  title,
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={title} />

      <main className={`w-full px-4 py-8 sm:px-6 lg:px-8 ${className}`}>
        {children}
      </main>
    </div>
  );
};

export default AppPageLayout;
