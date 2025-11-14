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

    // Read Excel
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    console.log("Sheets found:", workbook.SheetNames);

    // Check for required sheet
    if (!workbook.Sheets["ASSESSMENTS"]) {
        document.getElementById("output").innerText =
            "ERROR: Sheet 'ASSESSMENTS' missing.\nSheets:\n" +
            workbook.SheetNames.join("\n");
        return;
    }

    // Convert Excel → JSON
    let sheetRaw = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,  // Replace undefined with null
        raw: true
    });

    console.log("Rows loaded:", sheetRaw.length);

    // CLEAN THE DATA (important for pandas in Pyodide)
    let cleaned = sheetRaw.map(row => {
        const cleanedRow = {};
        for (const key in row) {
            let val = row[key];

            // Replace undefined with null
            if (val === undefined) val = null;

            // Convert nested objects/arrays to strings
            if (typeof val === "object" && val !== null) {
                val = JSON.stringify(val);
            }

            cleanedRow[key] = val;
        }
        return cleanedRow;
    });

    console.log("Cleaned rows:", cleaned.length);

    // Check Pyodide state
    if (!pyodideReady) {
        document.getElementById("output").innerText =
            "ERROR: Pyodide not ready yet.";
        return;
    }

    try {
        // Pass cleaned JSON → Pyodide
        pyodide.globals.set("assess_js", cleaned);

        // Convert to pandas DataFrame
        const result = pyodide.runPython(`
import pandas as pd
df = pd.DataFrame(assess_js)
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
