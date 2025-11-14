console.log("JS Loaded: main.js executing");

const logEl = document.getElementById("log");
const fileInput = document.getElementById("excelUpload");
const termSelect = document.getElementById("termSelect");
const subjectSelect = document.getElementById("subjectSelect");
const navButtons = document.querySelectorAll(".nav-btn");
const sections = {
    overview: document.getElementById("section-overview"),
    "by-class": document.getElementById("section-by-class"),
    "by-subject": document.getElementById("section-by-subject"),
    "by-teacher": document.getElementById("section-by-teacher"),
    attendance: document.getElementById("section-attendance"),
    trends: document.getElementById("section-trends"),
};

// Global storage of all rows from ASSESSMENTS
let allRows = [];

// ---------- UI helpers ----------

function log(msg) {
    console.log(msg);
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
}

function showSection(sectionKey) {
    // toggle sidebar active
    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.section === sectionKey);
    });
    // toggle sections
    for (const [key, el] of Object.entries(sections)) {
        el.classList.toggle("active", key === sectionKey);
    }
}

// Navigation click handlers
navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.section;
        showSection(target);
        log(`Switched to page: ${target}`);
        // When user goes to "By Class", make sure chart matches current filters
        if (target === "by-class" && allRows.length > 0) {
            updateDashboardByClass();
        }
    });
});

// ---------- Data helpers ----------

function unique(arr) {
    return Array.from(new Set(arr)).filter(
        v => v !== null && v !== undefined && v !== ""
    );
}

function getFilteredRowsByClass() {
    const term = termSelect.value;
    const subject = subjectSelect.value;

    return allRows.filter(row => {
        const okTerm = (term === "all") || (row.term === term);
        const okSubject = (subject === "all") || (row.subject === subject);
        return okTerm && okSubject;
    });
}

function computeClassAverages(rows) {
    const groups = {}; // { className: { sum: ..., count: ... } }

    for (const r of rows) {
        const cls = r.class;
        if (!cls) continue;

        if (!groups[cls]) {
            groups[cls] = { sum: 0, count: 0 };
        }

        // Prefer final_percent, otherwise final_5scale
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

function renderClassChart(summary) {
    const chartDiv = document.getElementById("chart-class");

    if (!summary.length) {
        Plotly.newPlot(chartDiv, [], {
            title: "No data for selected filters",
            xaxis: { title: "Class" },
            yaxis: { title: "Average grade" }
        });
        return;
    }

    const x = summary.map(r => r.class);
    const y = summary.map(r => r.avg);

    Plotly.newPlot(chartDiv, [{
        x,
        y,
        type: "bar"
    }], {
        title: "Average final grade by class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average grade" }
    });
}

function updateDashboardByClass() {
    if (!allRows.length) {
        log("No data loaded yet, cannot update By Class dashboard.");
        return;
    }
    const filtered = getFilteredRowsByClass();
    const summary = computeClassAverages(filtered);
    log(`By Class → filtered rows: ${filtered.length}, classes: ${summary.length}`);
    renderClassChart(summary);
}

// ---------- Event handlers ----------

// Filters for By Class page
termSelect.addEventListener("change", updateDashboardByClass);
subjectSelect.addEventListener("change", updateDashboardByClass);

// Excel upload
fileInput.addEventListener("change", async () => {
    log("Upload event fired.");

    const file = fileInput.files[0];
    if (!file) {
        log("No file selected.");
        return;
    }

    log("File selected: " + file.name);

    // Read Excel
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    log("Sheets found: " + workbook.SheetNames.join(", "));

    if (!workbook.Sheets["ASSESSMENTS"]) {
        log("❌ 'ASSESSMENTS' sheet not found in workbook.");
        return;
    }

    // Parse ASSESSMENTS
    const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["ASSESSMENTS"],
        { defval: null }
    );

    log("Rows loaded from ASSESSMENTS: " + rawRows.length);

    // Normalize / clean
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

    // If user is already on By Class page, update chart
    if (sections["by-class"].classList.contains("active")) {
        updateDashboardByClass();
    }
});

// Initial state
showSection("overview");
log("App initialized. Please upload an Excel file.");
