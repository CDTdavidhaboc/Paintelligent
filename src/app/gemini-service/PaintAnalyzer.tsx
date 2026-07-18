import Papa from "papaparse";
import * as XLSX from "xlsx";

const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

// Helper function to convert values to numbers
const toNumber = (value: unknown, fallback = 0) => {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
};

// Process file based on extension (CSV or Excel)
const processFileData = (fileData: any, fileExtension: string) => {
    if (fileExtension === 'csv') {
        // Parse CSV data
        const result = Papa.parse(fileData, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
        });
        return result.data;
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Parse Excel data
        const workbook = XLSX.read(fileData, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json(firstSheet);
    }
    throw new Error("Unsupported file format. Please upload CSV or Excel files.");
};

// Updated: Now uses user-uploaded CSV/Excel data, no default fallback
const loadInventory = (uploadedData: any[] | null) => {
    // Check if user uploaded data is provided
    if (!uploadedData || uploadedData.length === 0) {
        throw new Error("Please upload a CSV or Excel inventory file first.");
    }

    console.log("Using user-uploaded data:", uploadedData.length, "rows");
    console.log("Sample data:", uploadedData[0]);
    
    // Parse and normalize the user-uploaded data
    return uploadedData
        .filter((item) => item.Product || item.Brand || item.Category || item.product || item.brand || item.category)
        .map((item) => ({
            no: item["No."] || item["No"] || item["no"] || null,
            brand: item.Brand || item.brand || "",
            product: item.Product || item.product || "",
            category: item.Category || item.category || "",
            standardSize: item["Standard Size"] || item["standardSize"] || "",
            stockLevel: toNumber(item.Stocks || item.stocks || item["Stocks"]),
            volumeL: toNumber(item["Volume (L)"] || item["volumeL"] || item["Volume"]),
            weightKg: toNumber(item["Weight (kg)"] || item["weightKg"] || item["Weight"]),
            estPricePHP: toNumber(item["Est. Price (PHP)"] || item["estPricePHP"] || item["Price"]),
            availability: item.Availability || item.availability || "Active",
        }));
};

// Function to read file and return parsed data
const readInventoryFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        
        if (!fileExtension || !['csv', 'xlsx', 'xls'].includes(fileExtension)) {
            reject(new Error("Please upload a valid CSV or Excel (.xlsx, .xls) file."));
            return;
        }

        const reader = new FileReader();

        // Handle CSV files
        if (fileExtension === 'csv') {
            reader.onload = (ev) => {
                try {
                    const csvText = ev.target?.result as string;
                    const result = Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: true,
                        trimHeaders: true,
                    });

                    if (result.errors.length > 0) {
                        console.warn("CSV parse warnings:", result.errors);
                    }

                    const data = result.data.filter((item: any) => 
                        item.Product || item.product || item.Brand || item.brand || 
                        item.Category || item.category
                    );

                    if (data.length === 0) {
                        reject(new Error("CSV file appears empty or invalid. Make sure it has headers like Product, Brand, Category, etc."));
                        return;
                    }

                    resolve(data);
                } catch (err: any) {
                    reject(new Error(`Failed to process CSV: ${err.message}`));
                }
            };
            reader.onerror = () => {
                reject(new Error("Failed to read CSV file."));
            };
            reader.readAsText(file);
            return;
        }

        // Handle Excel files (.xlsx, .xls)
        reader.onload = (ev) => {
            try {
                const data = ev.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                if (jsonData.length === 0) {
                    reject(new Error("Excel file appears empty. Make sure it has data."));
                    return;
                }

                // Check if the data has the required headers
                const hasRequiredHeaders = jsonData.some((item: any) => 
                    item.Product || item.product || item.Brand || item.brand || 
                    item.Category || item.category
                );

                if (!hasRequiredHeaders) {
                    reject(new Error("Excel file doesn't have required headers. Make sure it has columns like Product, Brand, Category, etc."));
                    return;
                }

                resolve(jsonData);
            } catch (err: any) {
                reject(new Error(`Failed to process Excel file: ${err.message}`));
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read Excel file."));
        };
        reader.readAsArrayBuffer(file);
    });
};

export { loadInventory, readInventoryFile, processFileData };