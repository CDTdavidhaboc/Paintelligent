// src/lib/weather.ts

// Log the API key to verify it's being loaded
console.log('🔑 VITE_OPENWEATHER_API_KEY from env:', import.meta.env.VITE_OPENWEATHER_API_KEY);
console.log('📂 All env vars starting with VITE:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export interface WeatherData {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  clouds: number;
  pressure: number;
  visibility: number;
}

export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
  console.log('🌤️ getCurrentWeather called with:', lat, lon);
  console.log('🔑 API Key value:', API_KEY);
  console.log('🔑 API Key exists?', API_KEY ? '✅ Yes' : '❌ No');
  
  if (!API_KEY) {
    console.error('❌ OpenWeather API key not found in environment variables');
    console.error('💡 Make sure you have VITE_OPENWEATHER_API_KEY in your .env file');
    console.error('💡 Also make sure .env file is in the root directory of your project');
    return null;
  }

  try {
    const url = `${BASE_URL}?lat=${lat}&lon=${lon}&units=metric&lang=en&appid=${API_KEY}`;
    console.log('🌐 Fetching URL (API key hidden):', url.replace(API_KEY, 'HIDDEN'));
    
    const response = await fetch(url);
    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      let errorMsg = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        console.log('❌ Error details:', errorData);
        if (errorData.message) {
          errorMsg += ` - ${errorData.message}`;
        }
      } catch (e) {
        console.log('Could not parse error response');
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log('📦 Weather data received successfully');

    const weatherData: WeatherData = {
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      wind_speed: data.wind.speed,
      weather: data.weather,
      clouds: data.clouds.all,
      pressure: data.main.pressure,
      visibility: data.visibility || 10000
    };

    console.log('✅ Weather data parsed:', weatherData.weather[0]?.description, `${Math.round(weatherData.temp)}°C`);
    return weatherData;
  } catch (error) {
    console.error('❌ Error fetching weather:', error);
    return null;
  }
}

// Get user's location using browser geolocation
export function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

// Get weather with fallback to default location
export async function getWeatherWithFallback(): Promise<WeatherData | null> {
  console.log('🌤️ getWeatherWithFallback called');
  
  // Default location (Warsaw, Poland)
  const DEFAULT_LAT = 13.944843;
  const DEFAULT_LON = 120.73852;

  try {
    // Try to get user's location
    try {
      const location = await getUserLocation();
      console.log('📍 User location detected:', location);
      const weather = await getCurrentWeather(location.lat, location.lon);
      if (weather) {
        console.log('✅ Weather from user location');
        return weather;
      }
    } catch (error) {
      console.log('📍 Geolocation failed or denied, using default location (Warsaw)');
    }

    // Fallback to default location
    console.log('📍 Fetching weather for default location');
    const weather = await getCurrentWeather(DEFAULT_LAT, DEFAULT_LON);
    if (weather) {
      console.log('✅ Weather from default location');
    } else {
      console.log('❌ Failed to get weather from default location');
    }
    return weather;
  } catch (error) {
    console.error('❌ Error in getWeatherWithFallback:', error);
    return null;
  }
}