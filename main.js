console.log("JS Loaded: main.js executing");

const logEl = document.getElementById("log");
const fileInput = document.getElementById("excelUpload");
const termSelect = document.getElementById("termSelect");
const subjectSelect = document.getElementById("subjectSelect");

// Global storage of all rows from ASSESSMENTS
let allRows = [];

// Simple logger
function log(msg) {
    console.log(msg);
    logEl.textContent += msg + "\n";
}

// ---------- Helpers ----------

// Get unique values from an array
function unique(arr) {
    return Array.from(new Set(arr)).filter(v => v !== null && v !== undefined && v !== "");
}

// Filter data based on current UI selections
function getFilteredRows() {
    const term = termSelect.value;
    const subject = subjectSelect.value;

    return allRows.filter(row => {
        const okTerm = (term === "all") || (row.term === term);
        const okSubject = (subject === "all") || (row.subject === subject);
        return okTerm && okSubject;
    });
}

// Compute class-level averages
function computeClassAverages(rows) {
    const groups = {}; // { className: { sum: ..., count: ... } }

    for (const r of rows) {
        const cls = r.class;
        if (!cls) continue;

        if (!groups[cls]) {
            groups[cls] = { sum: 0, count: 0 };
        }

        // Prefer final_percent if exists, otherwise final_5scale
        const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
        if (!Number.isNaN(val)) {
            groups[cls].sum += val;
            groups[cls].count += 1;
        }
    }

    return Object.entries(groups).map(([cls, { sum, count }]) => ({
        class: cls,
        avg: count > 0 ? sum / count : null
    })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
}

// Render Plotly bar chart
function renderChart(summary) {
    if (summary.length === 0) {
        Plotly.newPlot("chart", [], {
            title: "No data for selected filters",
            xaxis: { title: "Class" },
            yaxis: { title: "Average grade" }
        });
        return;
    }

    const x = summary.map(r => r.class);
    const y = summary.map(r => r.avg);

    Plotly.newPlot("chart", [{
        x,
        y,
        type: "bar"
    }], {
        title: "Average final grade by class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average grade" }
    });
}

// Recompute + rerender dashboard based on current filters
function updateDashboard() {
    if (!allRows.length) {
        log("No data loaded yet.");
        return;
    }
    const filtered = getFilteredRows();
    const summary = computeClassAverages(filtered);
    log(`Filtered rows: ${filtered.length}, classes: ${summary.length}`);
    renderChart(summary);
}

// ---------- Event handlers ----------

// When user changes term or subject
termSelect.addEventListener("change", updateDashboard);
subjectSelect.addEventListener("change", updateDashboard);

// When user uploads Excel file
fileInput.addEventListener("change", async () => {
    log("Upload event fired.");

    const file = fileInput.files[0];
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
        log("❌ 'ASSESSMENTS' sheet not found in workbook.");
        return;
    }

    // Read ASSESSMENTS as array of JS objects
    const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["ASSESSMENTS"],
        { defval: null }
    );

    log("Rows loaded from ASSESSMENTS: " + rawRows.length);

    // Normalize / clean rows
    allRows = rawRows.map(r => ({
        student_id: r.student_id ?? r["student_id"] ?? null,
        student_name: r.student_name ?? r["student_name"] ?? null,
        class: r.class ?? r["class"] ?? null,
        subject: r.subject ?? r["subject"] ?? null,
        term: r.term ?? r["term"] ?? null,
        FA: r.FA !== undefined ? Number(r.FA) : null,
        SAU: r.SAU !== undefined ? Number(r.SAU) : null,
        SAT: r.SAT !== undefined ? Number(r.SAT) : null,
        final_percent: r.final_percent !== undefined ? Number(r.final_percent) : null,
        final_5scale: r.final_5scale !== undefined ? Number(r.final_5scale) : null
    }));

    log("Rows normalized: " + allRows.length);

    // Populate filters
    const terms = unique(allRows.map(r => r.term));
    const subjects = unique(allRows.map(r => r.subject));

    // Reset selects
    termSelect.innerHTML = '<option value="all">All terms</option>';
    for (const t of terms) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        termSelect.appendChild(opt);
    }

    subjectSelect.innerHTML = '<option value="all">All subjects</option>';
    for (const s of subjects) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        subjectSelect.appendChild(opt);
    }

    log("Terms: " + terms.join(", "));
    log("Subjects: " + subjects.join(", "));

    // Initial dashboard
    updateDashboard();
});
