console.log("JS Loaded: main.js executing");

// --------------------------
// Utility logger
// --------------------------
function log(msg) {
    console.log(msg);
    const el = document.getElementById("log");
    el.textContent += msg + "\n";
}

// Test Polars immediately after page load
console.log("Polars UMD exists on load?", window.polars);

// --------------------------
// 1. Initialize Pyodide (NO pandas)
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
// 2. Excel Upload Handler
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

    // Read Excel as ArrayBuffer
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    log("Sheets found: " + workbook.SheetNames.join(", "));

    if (!workbook.Sheets["ASSESSMENTS"]) {
        log("❌ 'ASSESSMENTS' sheet missing.");
        return;
    }

    // Convert sheet to JS objects
    let jsRows = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,
        raw: true
    });

    log("Rows loaded from ASSESSMENTS: " + jsRows.length);

    // --------------------------
    // Polars DataFrame
    // --------------------------

    const pl = window.polars;
    if (!pl) {
        log("❌ Polars not loaded yet. Check console and ensure polars.umd.js is reachable.");
        return;
    }

    log("Polars detected. Creating DataFrame...");

    let df;
    try {
        df = pl.DataFrame(jsRows);
        log("Polars DataFrame created. Columns: " + df.columns.join(", "));
    } catch (err) {
        log("❌ Polars DataFrame error: " + err);
        return;
    }

    // Determine grade column
    let gradeCol = null;

    if (df.columns.includes("final_5scale")) {
        gradeCol = "final_5scale";
        df = df.withColumn(pl.col("final_5scale").cast(pl.Float64));
    } else if (df.columns.includes("final_grade")) {
        gradeCol = "final_grade";
        df = df.withColumn(pl.col("final_grade").cast(pl.Float64));
    } else {
        log("❌ No recognized grade column found.");
        return;
    }

    // --------------------------
    // Compute aggregation
    // --------------------------

    let grouped = df
        .groupBy("class")
        .agg(pl.col(gradeCol).mean().alias("avg_grade"))
        .sort("avg_grade", false);

    const records = grouped.toRecords();

    log("Grouped sample:\n" + JSON.stringify(records.slice(0, 5), null, 2));

    // --------------------------
    // Plotly chart
    // --------------------------

    Plotly.newPlot("chart", [{
        x: records.map(r => r.class),
        y: records.map(r => r.avg_grade),
        type: "bar"
    }], {
        title: "Average Final Grade by Class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average Grade (2–5)", range: [2, 5] }
    });

    log("Plotly chart rendered.");

    // --------------------------
    // 3. Python insight via Pyodide
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
