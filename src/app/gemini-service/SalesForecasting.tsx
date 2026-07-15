import Papa from "papaparse";
import { GoogleGenAI } from "@google/genai";

export const salesForecastAI = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});


export const loadSalesData = async () => {
  const response = await fetch("/GPC_Sales.csv");

  if (!response.ok) {
    throw new Error("Failed to load GPC_Sales.csv");
  }

  const csv = await response.text();

  const result = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data;
};