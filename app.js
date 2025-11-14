console.log("JS Loaded: app.js executing");

let pyodideReady = false;

// Load Pyodide
async function initPyodide() {
    console.log("Loading Pyodide...");
    try {
        window.pyodide = await loadPyodide();
        console.log("Pyodide loaded.");

        await pyodide.loadPackage("pandas");
        console.log("pandas loaded.");

        pyodideReady = true;

    } catch (err) {
        console.error("❌ Pyodide load error:", err);
    }
}

initPyodide();

const uploadElement = document.getElementById("excelUpload");
console.log("Upload element found:", uploadElement);

// Upload handler
uploadElement.addEventListener("change", async (e) => {
    console.log("Upload event fired");

    const file = e.target.files[0];
    if (!file) {
        console.log("No file selected");
        return;
    }

    console.log("File selected:", file.name);

    // Read Excel
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    console.log("Sheets found:", workbook.SheetNames);

    if (!workbook.Sheets["ASSESSMENTS"]) {
        document.getElementById("output").innerText =
            "ERROR: Sheet 'ASSESSMENTS' missing.\nSheets:\n" +
            workbook.SheetNames.join("\n");
        return;
    }

    // Convert Excel → raw JSON
    let sheetRaw = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,
        raw: true
    });

    console.log("Rows loaded:", sheetRaw.length);

    // Convert ALL values to strings/null (safe for JSON)
    let cleaned = sheetRaw.map(row => {
        const cleanedRow = {};
        for (const key in row) {
            let val = row[key];
            cleanedRow[key] = (val === undefined || val === null) ? null : String(val);
        }
        return cleanedRow;
    });

    console.log("Cleaned rows:", cleaned.length);

    if (!pyodideReady) {
        document.getElementById("output").innerText =
            "ERROR: Pyodide not ready.";
        return;
    }

    try {
        // Pass as JSON STRING instead of JS objects
        const jsonString = JSON.stringify(cleaned);
        pyodide.globals.set("assess_json", jsonString);

        // Load JSON in Python, then construct pandas DF
        const result = pyodide.runPython(`
import json
import pandas as pd

# Load from JSON
data = json.loads(assess_json)

# Construct DataFrame
df = pd.DataFrame(data)

# Convert numeric columns
num_cols = ["FA", "SAU", "SAT", "final_percent", "final_5scale"]
for col in num_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

df.head().to_string()
        `);

        console.log("Python result:", result);
        document.getElementById("output").innerText = result;

    } catch (err) {
        console.error("❌ Python error:", err);
        document.getElementById("output").innerText =
            "Python error:\n" + err;
    }
});
