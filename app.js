console.log("JS Loaded: app.js executing");

let pyodideReady = false;

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

    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"]);
    console.log("Rows loaded:", sheet.length);

    if (!pyodideReady) {
        console.log("ERROR: Pyodide not ready");
        return;
    }

    try {
        pyodide.globals.set("assess_js", sheet);

        const result = pyodide.runPython(`
import pandas as pd
df = pd.DataFrame(assess_js)
df.head().to_string()
        `);

        console.log("Python result:", result);
        document.getElementById("output").innerText = result;

    } catch (err) {
        console.error("Python error:", err);
    }
});
