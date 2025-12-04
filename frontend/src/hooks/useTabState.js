import { useState, useEffect } from 'react';

/**
 * Custom hook to persist tab state in sessionStorage
 * Remembers selected tab when user navigates away and comes back
 * 
 * @param {string} sectionKey - Unique identifier for the section (e.g., 'politics', 'movies')
 * @param {string} defaultTab - Default tab to show if no saved state exists
 * @returns {[string, function]} - [activeTab, setActiveTab]
 */
const useTabState = (sectionKey, defaultTab) => {
  // Create storage key with prefix
  const storageKey = `tadka_tab_${sectionKey}`;
  
  // Initialize state with saved value or default
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const savedTab = sessionStorage.getItem(storageKey);
      return savedTab || defaultTab;
    } catch (error) {
      console.error('Error reading tab state from sessionStorage:', error);
      return defaultTab;
    }
  });

  // Save to sessionStorage whenever tab changes
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, activeTab);
    } catch (error) {
      console.error('Error saving tab state to sessionStorage:', error);
    }
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab];
};

export default useTabState;
