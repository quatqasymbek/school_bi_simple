console.log("JS Loaded: main.js executing");

const logBox = document.getElementById("log");
const fileInput = document.getElementById("excelUpload");

function log(msg) {
    console.log(msg);
    logBox.innerText += msg + "\n";
}

// Load Pyodide
log("Loading Pyodide...");
let pyodideReady = loadPyodide();

fileInput.addEventListener("change", async () => {
    log("Upload event fired.");

    const file = fileInput.files[0];
    if (!file) return;

    log("File selected: " + file.name);

    // Read Excel via SheetJS
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const sheets = workbook.SheetNames;
    log("Sheets found: " + sheets.join(", "));

    // Only process ASSESSMENTS for now
    const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["ASSESSMENTS"],
        { defval: null }
    );

    log("Rows loaded from ASSESSMENTS: " + rawRows.length);

    // Data processing (JS only)
    const jsCleaned = rawRows.map(r => ({
        student_id: r.student_id,
        student_name: r.student_name,
        class: r.class,
        subject: r.subject,
        term: r.term,
        FA: Number(r.FA ?? 0),
        SAU: Number(r.SAU ?? 0),
        SAT: Number(r.SAT ?? 0),
        final_percent: Number(r.final_percent ?? 0),
        final_5scale: Number(r.final_5scale ?? 0)
    }));

    // Group by class
    const classGroups = {};
    for (const row of jsCleaned) {
        if (!classGroups[row.class]) classGroups[row.class] = [];
        classGroups[row.class].push(row.final_percent);
    }

    const summary = Object.entries(classGroups).map(([cls, arr]) => ({
        class: cls,
        avg: arr.reduce((a, b) => a + b, 0) / arr.length
    }));

    log("Computed averages for " + summary.length + " classes");

    // Plot
    Plotly.newPlot("chart", [{
        x: summary.map(r => r.class),
        y: summary.map(r => r.avg),
        type: "bar"
    }], {
        title: "Average Final Grade by Class"
    });

    // Python insight (optional)
    let pyodide = await pyodideReady;

    pyodide.globals.set("summary", summary);

    const pyResult = pyodide.runPython(`
best = max(summary, key=lambda x: x["avg"])
f"Best class: {best['class']} with avg {best['avg']:.1f}"
    `);

    log("Python insight: " + pyResult);
});
