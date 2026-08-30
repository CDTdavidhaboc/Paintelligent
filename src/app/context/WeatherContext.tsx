// src/context/WeatherContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { WeatherData, getWeatherWithFallback } from '../lib/weather';

interface WeatherContextType {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  refreshWeather: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    console.log('🔄 WeatherProvider: fetchWeather called');
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWeatherWithFallback();
      if (data) {
        console.log('✅ WeatherProvider: Weather data set successfully');
        setWeather(data);
        setError(null);
      } else {
        console.log('❌ WeatherProvider: No data received');
        setError('Failed to fetch weather data');
        setWeather(null);
      }
    } catch (err) {
      console.error('❌ WeatherProvider: Error fetching weather:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setWeather(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log('🚀 WeatherProvider: Initializing');
    fetchWeather();
    
    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    
    return () => {
      console.log('🧹 WeatherProvider: Cleaning up');
      clearInterval(interval);
    };
  }, [fetchWeather]);

  return (
    <WeatherContext.Provider value={{ weather, isLoading, error, refreshWeather: fetchWeather }}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (context === undefined) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
}