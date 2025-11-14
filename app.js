console.log("JS Loaded: app.js executing");

// Flags
let pyodideReady = false;

// Initialize Pyodide
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

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    console.log("Sheets found:", workbook.SheetNames);

    if (!workbook.Sheets["ASSESSMENTS"]) {
        document.getElementById("output").innerText =
            "ERROR: Sheet 'ASSESSMENTS' missing.\nSheets:\n" +
            workbook.SheetNames.join("\n");
        return;
    }

    let sheetRaw = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,
        raw: true
    });

    console.log("Rows loaded:", sheetRaw.length);

    // FORCE ALL VALUES TO STRINGS (pandas-safe)
    let cleaned = sheetRaw.map(row => {
        const cleanedRow = {};
        for (const key in row) {
            let val = row[key];

            if (val === undefined || val === null) {
                cleanedRow[key] = null;
            } else {
                cleanedRow[key] = String(val);
            }
        }
        return cleanedRow;
    });

    console.log("Cleaned rows:", cleaned.length);

    if (!pyodideReady) {
        document.getElementById("output").innerText =
            "ERROR: Pyodide not ready yet.";
        return;
    }

    try {
        pyodide.globals.set("assess_js", cleaned);

        const result = pyodide.runPython(`
import pandas as pd

# Load DF with all strings
df = pd.DataFrame(assess_js)

# Convert numeric columns back where needed
for col in ["FA", "SAU", "SAT", "final_percent", "final_5scale"]:
    df[col] = pd.to_numeric(df[col], errors="coerce")

df.head().to_string()
        `);

        console.log("Python result:", result);
        document.getElementById("output").innerText = result;

    } catch (err) {
        console.error("❌ Python error:", err);
        document.getElementById("output").innerText = "Python error:\n" + err;
    }
});
