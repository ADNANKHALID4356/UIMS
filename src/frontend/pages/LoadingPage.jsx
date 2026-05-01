import React from 'react';

const LoadingPage = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-primary to-secondary">
      <div className="text-center">
        {/* Spinner */}
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        
        {/* Loading Text */}
        <h2 className="text-2xl font-semibold text-white mb-2">
          Enterprise Inventory System
        </h2>
        <p className="text-white text-opacity-90">
          Initializing application...
        </p>
      </div>
    </div>
  );
};

export default LoadingPage;
