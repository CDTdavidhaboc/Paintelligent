import Papa from "papaparse";

const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

const loadInventory = async () => {
    const response = await fetch("/public/GPC_Products.csv");

    const csv = await response.text();

    const result = Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
    });

    return result.data;
};

