import React, { createContext, useContext, ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useMemoryStore } from '../hooks/useMemoryStore';
import type { MemoryStore } from '../stores/MemoryStore';

const MemoryContext = createContext<MemoryStore | null>(null);

interface MemoryProviderProps {
  userId: string;
  children: ReactNode;
}

export const MemoryProvider: React.FC<MemoryProviderProps> = observer(({ userId, children }) => {
  const store = useMemoryStore(userId);
  
  return (
    <MemoryContext.Provider value={store}>
      {children}
    </MemoryContext.Provider>
  );
});

export function useMemory() {
  const context = useContext(MemoryContext);
  const fallback = useMemoryStore('demo');
  return context ?? fallback;
}
