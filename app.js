console.log("JS Loaded: app.js executing");

// Simple logger to the page
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
        // We are NOT loading pandas here to avoid its bugs.
        pyodideReady = true;
    } catch (err) {
        console.error("❌ Pyodide load error:", err);
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

    // Read Excel
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    log("Sheets found: " + workbook.SheetNames.join(", "));

    if (!workbook.Sheets["ASSESSMENTS"]) {
        document.getElementById("log").textContent +=
            "ERROR: Sheet 'ASSESSMENTS' missing.\nSheets:\n" +
            workbook.SheetNames.join("\n");
        return;
    }

    // Convert Excel → JSON rows
    let sheetRaw = XLSX.utils.sheet_to_json(workbook.Sheets["ASSESSMENTS"], {
        defval: null,
        raw: true  // keep numbers as numbers
    });

    log("Rows loaded from ASSESSMENTS: " + sheetRaw.length);

    // Polars is available as global "pl"
    const pl = window.polars || window.pl;
    if (!pl) {
        log("❌ Polars (pl) is not available");
        return;
    }

    // Build Polars DataFrame directly from JS objects
    let df;
    try {
        df = pl.DataFrame(sheetRaw);
        log("Polars DataFrame created. Columns: " + df.columns.join(", "));
    } catch (err) {
        console.error("Polars error:", err);
        log("❌ Polars DataFrame error: " + err);
        return;
    }

    // Ensure final_5scale is numeric
    if (!df.columns.includes("final_5scale")) {
        log("❌ Column 'final_5scale' not found in ASSESSMENTS.");
        return;
    }

    df = df.withColumn(pl.col("final_5scale").cast(pl.Float64));

    // --------------------------
    // Compute BI summary in Polars:
    // Average final_5scale per class
    // --------------------------
    let grouped = df
        .groupBy("class")
        .agg(pl.col("final_5scale").mean().alias("avg_final_5"))
        .sort("avg_final_5", false);  // descending

    const records = grouped.toRecords();  // [{class: '1A', avg_final_5: 4.12}, ...]

    log("Grouped records (first 5): " +
        JSON.stringify(records.slice(0, 5), null, 2));

    // --------------------------
    // Plot with Plotly
    // --------------------------
    const classes = records.map(r => r.class);
    const avgValues = records.map(r => r.avg_final_5);

    const dataPlot = [{
        x: classes,
        y: avgValues,
        type: "bar"
    }];

    const layout = {
        title: "Average final grade (5-point scale) by class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average grade (5-point scale)", range: [2, 5] }
    };

    Plotly.newPlot("chart", dataPlot, layout);

    // --------------------------
    // Optional: use Pyodide for a tiny Python insight
    // --------------------------
    if (pyodideReady) {
        try {
            // Pass the small summary (records) to Python
            pyodide.globals.set("summary_js", records);

            const insight = pyodide.runPython(`
summary = summary_js  # list of dicts
best = max(summary, key=lambda x: x["avg_final_5"])
worst = min(summary, key=lambda x: x["avg_final_5"])
f"Best class: {best['class']} ({best['avg_final_5']:.2f}), " \
f"Worst class: {worst['class']} ({worst['avg_final_5']:.2f})"
            `);

            log("Python insight via Pyodide: " + insight);
        } catch (err) {
            console.error("Pyodide Python error:", err);
            log("Pyodide Python error: " + err);
        }
    } else {
        log("Pyodide not ready yet, skipping Python insight.");
    }
});
