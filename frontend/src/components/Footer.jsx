import React from 'react';

function Footer() {
  return (
    <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg text-center p-4 shadow-inner mt-auto">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Powered by IntervAI &copy; {new Date().getFullYear()}. Built for a better interview experience.
      </p>
    </footer>
  );
}

export default Footer;
