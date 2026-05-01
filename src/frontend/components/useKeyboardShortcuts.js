/**
 * useKeyboardShortcuts — Sprint 7: Global Keyboard Shortcuts
 * Registers Ctrl+N, Ctrl+S, Ctrl+P, Ctrl+B, Ctrl+D, Ctrl+F
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useKeyboardShortcuts = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      // Only handle Ctrl/Cmd combos
      if (!(e.ctrlKey || e.metaKey)) return;

      switch (e.key.toLowerCase()) {
        case 'n': // New Transaction
          e.preventDefault();
          navigate('/transactions/new');
          break;

        case 'p': // Print
          e.preventDefault();
          window.print();
          break;

        case 'b': // Backup
          e.preventDefault();
          navigate('/backup');
          break;

        case 'd': // Dashboard
          e.preventDefault();
          navigate('/dashboard');
          break;

        case 'f': // Focus search (find first input[type=text] or input[placeholder*=search])
          e.preventDefault();
          {
            const searchInput =
              document.querySelector('input[placeholder*="earch"]') ||
              document.querySelector('input[placeholder*="ilter"]') ||
              document.querySelector('input[type="text"]');
            if (searchInput) searchInput.focus();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
};

export default useKeyboardShortcuts;
