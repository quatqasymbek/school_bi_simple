console.log("JS Loaded: main.js executing");

// --------------------------
// Utility: simple logger
// --------------------------
function log(msg) {
    console.log(msg);
    const el = document.getElementById("log");
    el.textContent += msg + "\n";
}

// --------------------------
// 1. Initialize Pyodide (NO pandas!)
// --------------------------

let pyodideReady = false;

async function initPyodide() {
    log("Loading Pyodide (without pandas)...");
    try {
        window.pyodide = await loadPyodide();
        log("Pyodide loaded.");
        pyodideReady = true;
    } catch (err) {
        log("❌ Pyodide load error: " + err);
    }
}

initPyodide();

// --------------------------
// 2. Excel upload + Polars processing
// --------------------------

const uploadElement = document.getElementById("excelUpload");
log("Upload element found.");

uploadElement.addEventListener("change", async (e) => {
    log("Upload event fired.");

    const file = e.target.files[0];
    if (!file) {
        log("No file selected.");
        return;
    }

    log("File selected: " + file.name);

    // Read Excel file
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    log("Sheets found: " + workbook.SheetNames.join(", "));

    if (!workbook.Sheets["ASSESSMENTS"]) {
        log("❌ Sheet 'ASSESSMENTS' not found.");
        return;
    }

    // Convert Excel sheet to JS objects
    let sheetData = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,
        raw: true
    });

    log("Rows loaded from ASSESSMENTS: " + sheetData.length);

    // --------------------------
    // Create Polars DataFrame
    // --------------------------
    const pl = window.polars || window.pl;
    if (!pl) {
        log("❌ Polars not available.");
        return;
    }

    let df;
    try {
        df = pl.DataFrame(sheetData);
        log("Polars DataFrame created. Columns: " + df.columns.join(", "));
    } catch (err) {
        log("❌ Polars DataFrame error: " + err);
        return;
    }

    // Convert final grade to float
    if (df.columns.includes("final_5scale")) {
        df = df.withColumn(pl.col("final_5scale").cast(pl.Float64));
    } else if (df.columns.includes("final_grade")) {
        df = df.withColumn(pl.col("final_grade").cast(pl.Float64));
    } else {
        log("❌ No final grade column found.");
        return;
    }

    // --------------------------
    // GROUP BY class → avg grade
    // --------------------------
    const gradeCol = df.columns.includes("final_5scale") ? "final_5scale" : "final_grade";

    let grouped = df
        .groupBy("class")
        .agg(pl.col(gradeCol).mean().alias("avg_grade"))
        .sort("avg_grade", false);

    const records = grouped.toRecords();

    log("Grouped sample:\n" +
        JSON.stringify(records.slice(0, 5), null, 2));

    // --------------------------
    // Plot with Plotly
    // --------------------------
    Plotly.newPlot("chart", [{
        x: records.map(r => r.class),
        y: records.map(r => r.avg_grade),
        type: "bar"
    }], {
        title: "Average Final Grade by Class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average Grade", range: [2, 5] }
    });

    log("Plotly chart rendered.");

    // --------------------------
    // 3. Optional: Python insight via Pyodide
    // --------------------------
    if (pyodideReady) {
        try {
            pyodide.globals.set("summary_js", records);

            const insight = pyodide.runPython(`
summary = summary_js
best = max(summary, key=lambda x: x["avg_grade"])
worst = min(summary, key=lambda x: x["avg_grade"])
f"Best class: {best['class']} ({best['avg_grade']:.2f}) | "
f"Worst class: {worst['class']} ({worst['avg_grade']:.2f})"
            `);

            log("Python insight: " + insight);

        } catch (err) {
            log("❌ Pyodide Python error: " + err);
        }
    } else {
        log("Pyodide not ready; skipping Python insight.");
    }
});
