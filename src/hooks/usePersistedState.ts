import { useState, useEffect, useCallback } from 'react';
import { getStoredData, storeData } from '../services/storageService';
import { KnowledgePointItem } from '../types';

function usePersistedState<T>(key: string, defaultValue: T): [T, (newValue: T) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = getStoredData<T>(key, defaultValue);
      if (key === 'knowledgePoints' || key === 'newKnowledgeKnowledgePoints') {
        return (storedValue as KnowledgePointItem[]).map(kp => ({
          ...kp,
          masterId: kp.masterId || kp.id
        })) as T;
      }
      return storedValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  });

  const setPersistedState = useCallback((newValue: T) => {
    setState(newValue);
    storeData(key, newValue);
  }, [key]);

  useEffect(() => {
    try {
      const storedValue = getStoredData<T>(key, defaultValue);
      let processedValue = storedValue;
      if (key === 'knowledgePoints' || key === 'newKnowledgeKnowledgePoints') {
        processedValue = (storedValue as KnowledgePointItem[]).map(kp => ({
          ...kp,
          masterId: kp.masterId || kp.id
        })) as T;
      }
      if (JSON.stringify(processedValue) !== JSON.stringify(state)) {
        setState(processedValue);
      }
    } catch (error) {
      console.error('Error re-syncing from localStorage:', error);
    }
  }, [key, defaultValue, state]);

  return [state, setPersistedState];
}

export default usePersistedState; 