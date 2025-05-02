"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface SearchContextType {
  isSearchExpanded: boolean;
  toggleSearchExpanded: () => void;
  expandSearch: () => void;
  collapseSearch: () => void;
}

const SearchContext = createContext<SearchContextType>({
  isSearchExpanded: false,
  toggleSearchExpanded: () => {},
  expandSearch: () => {},
  collapseSearch: () => {},
});

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Using useCallback to prevent unnecessary re-renders
  const toggleSearchExpanded = useCallback(() => {
    setIsSearchExpanded((prev) => !prev);
  }, []);

  const expandSearch = useCallback(() => {
    setIsSearchExpanded(true);
  }, []);

  const collapseSearch = useCallback(() => {
    setIsSearchExpanded(false);
  }, []);

  return (
    <SearchContext.Provider
      value={{
        isSearchExpanded,
        toggleSearchExpanded,
        expandSearch,
        collapseSearch,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export const useSearch = () => useContext(SearchContext);
