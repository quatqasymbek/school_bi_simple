console.log("JS Loaded: app.js executing");

// Simple logger to on-page log panel
function log(msg) {
    console.log(msg);
    const logEl = document.getElementById("log");
    logEl.textContent += msg + "\n";
}

// --------------------------
// 1. Pyodide initialization
// --------------------------

let pyodideReady = false;

async function initPyodide() {
    log("Loading Pyodide (without pandas)...");
    try {
        window.pyodide = await loadPyodide();
        log("Pyodide loaded.");
        // No pandas inside Pyodide — we avoid the bugs
        pyodideReady = true;
    } catch (err) {
        log("❌ Pyodide load error: " + err);
    }
}

initPyodide();

// --------------------------
// 2. Excel upload + Polars
// --------------------------

const uploadElement = document.getElementById("excelUpload");
log("Upload element found: " + uploadElement);

uploadElement.addEventListener("change", async (e) => {
    log("Upload event fired");

    const file = e.target.files[0];
    if (!file) {
        log("No file selected");
        return;
    }

    log("File selected: " + file.name);

    // Read Excel into ArrayBuffer
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    log("Sheets found: " + workbook.SheetNames.join(", "));

    if (!workbook.Sheets["ASSESSMENTS"]) {
        log("ERROR: Sheet 'ASSESSMENTS' not found.");
        return;
    }

    // Parse Excel -> JS objects
    let sheetRaw = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,
        raw: true
    });

    log("Rows loaded from ASSESSMENTS: " + sheetRaw.length);

    // ---- Load Polars ----
    const pl = window.polars || window.pl;
    if (!pl) {
        log("❌ Polars not available.");
        return;
    }

    // Create Polars DataFrame
    let df;
    try {
        df = pl.DataFrame(sheetRaw);
        log("Polars DataFrame created. Columns: " + df.columns.join(", "));
    } catch (err) {
        log("❌ Polars DataFrame error: " + err);
        return;
    }

    // Make sure final_5scale is numeric
    df = df.withColumn(pl.col("final_5scale").cast(pl.Float64));

    // GROUP BY class and compute avg final grade
    let grouped = df
        .groupBy("class")
        .agg(pl.col("final_5scale").mean().alias("avg_final_5"))
        .sort("avg_final_5", false);

    const records = grouped.toRecords();
    log("Grouped records (first 5):\n" +
        JSON.stringify(records.slice(0, 5), null, 2));

    // Prepare data for Plotly
    const classes = records.map(r => r.class);
    const avgValues = records.map(r => r.avg_final_5);

    Plotly.newPlot("chart", [{
        x: classes,
        y: avgValues,
        type: "bar"
    }], {
        title: "Average final grade (5-point scale) by class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average grade", range: [2, 5] }
    });

    // ---- Optional Pyodide: Insight ----
    if (pyodideReady) {
        try {
            pyodide.globals.set("summary_js", records);

            const insight = pyodide.runPython(`
summary = summary_js
best = max(summary, key=lambda x: x["avg_final_5"])
worst = min(summary, key=lambda x: x["avg_final_5"])
f"Best class: {best['class']} ({best['avg_final_5']:.2f}) | "
f"Worst class: {worst['class']} ({worst['avg_final_5']:.2f})"
            `);

            log("Python insight: " + insight);

        } catch (err) {
            log("Pyodide Python error: " + err);
        }
    } else {
        log("Pyodide not ready; skipping Python insight.");
    }
});
