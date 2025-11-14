let pyodideReady = false;

async function initPyodide() {
    window.pyodide = await loadPyodide();
    await pyodide.loadPackage("pandas");
    pyodideReady = true;
    console.log("Pyodide loaded.");
}

initPyodide();

document.getElementById("excelUpload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Read Excel with SheetJS
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    // Convert first sheet to JSON
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Pass to Pyodide
    pyodide.globals.set("sheet_js", sheet);

    // Run Python
    const result = pyodide.runPython(`
import pandas as pd
df = pd.DataFrame(sheet_js)
df.head().to_string()
    `);

    document.getElementById("output").innerText = result;
});
