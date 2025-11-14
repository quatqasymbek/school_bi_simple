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

// Global storage
let allRows = [];

// UI helper
function log(msg) {
    console.log(msg);
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
}

// Navigation
function showSection(sectionKey) {
    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.section === sectionKey);
    });
    for (const [key, el] of Object.entries(sections)) {
        el.classList.toggle("active", key === sectionKey);
    }
}

navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.section;
        showSection(target);
        log(`Switched to page: ${target}`);
        if (target === "by-class" && allRows.length > 0) {
            updateDashboardByClass();
        }
    });
});

// Helpers
function unique(arr) {
    return Array.from(new Set(arr)).filter(
        v => v !== null && v !== undefined && v !== ""
    );
}

function getFilteredRowsByClass() {
    const term = termSelect.value;
    const subject = subjectSelect.value;

    return allRows.filter(row =>
        (term === "all" || row.term === term) &&
        (subject === "all" || row.subject === subject)
    );
}

function computeClassAverages(rows) {
    const groups = {};
    for (const r of rows) {
        if (!r.class) continue;
        if (!groups[r.class]) groups[r.class] = { sum: 0, count: 0 };

        const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
        if (!Number.isNaN(val)) {
            groups[r.class].sum += val;
            groups[r.class].count += 1;
        }
    }
    return Object.entries(groups)
        .map(([cls, { sum, count }]) => ({
            class: cls,
            avg: count ? sum / count : null
        }))
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
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

    Plotly.newPlot(chartDiv, [{
        x: summary.map(r => r.class),
        y: summary.map(r => r.avg),
        type: "bar"
    }], {
        title: "Average final grade by class",
        xaxis: { title: "Class" },
        yaxis: { title: "Average grade" }
    });
}

function updateDashboardByClass() {
    if (!allRows.length) return;

    const filtered = getFilteredRowsByClass();
    const summary = computeClassAverages(filtered);
    log(`By Class → filtered rows: ${filtered.length}, classes: ${summary.length}`);

    renderClassChart(summary);
}

// Filter listeners
termSelect.addEventListener("change", updateDashboardByClass);
subjectSelect.addEventListener("change", updateDashboardByClass);

// Excel upload
fileInput.addEventListener("change", async () => {
    log("Upload event fired.");
    const file = fileInput.files[0];
    if (!file) return;

    log("File selected: " + file.name);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    log("Sheets found: " + workbook.SheetNames.join(", "));

    if (!workbook.Sheets["ASSESSMENTS"]) {
        log("❌ 'ASSESSMENTS' sheet not found.");
        return;
    }

    const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["ASSESSMENTS"],
        { defval: null }
    );

    log("Rows loaded from ASSESSMENTS: " + rawRows.length);

    // Normalize
    allRows = rawRows.map(r => ({
        student_id: r.student_id,
        student_name: r.student_name,
        class: r.class,
        subject: r.subject,
        term: r.term,
        FA: Number(r.FA ?? null),
        SAU: Number(r.SAU ?? null),
        SAT: Number(r.SAT ?? null),
        final_percent: Number(r.final_percent ?? null),
        final_5scale: Number(r.final_5scale ?? null)
    }));

    log("Rows normalized: " + allRows.length);

    // Populate filters
    const terms = unique(allRows.map(r => r.term));
    const subjects = unique(allRows.map(r => r.subject));

    termSelect.innerHTML = '<option value="all">All terms</option>';
    terms.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        termSelect.appendChild(opt);
    });

    subjectSelect.innerHTML = '<option value="all">All subjects</option>';
    subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s; opt.textContent = s;
        subjectSelect.appendChild(opt);
    });

    log("Terms: " + terms.join(", "));
    log("Subjects: " + subjects.join(", "));

    if (sections["by-class"].classList.contains("active")) {
        updateDashboardByClass();
    }
});

// Initial state
showSection("overview");
log("App initialized. Upload an Excel file to start.");
