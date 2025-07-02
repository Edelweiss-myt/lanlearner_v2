export function getStoredData<T>(key: string, defaultValue: T): T {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

export function storeData<T>(key: string, value: T): void {
  try {
    const serializedValue = JSON.stringify(value);
    window.localStorage.setItem(key, serializedValue);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // This means localStorage is full
      console.error(`localStorage is full for key "${key}":`, error);
      throw new Error('LocalStorageQuotaExceeded'); // Throw a specific error for handling upstream
    } else {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }
}
