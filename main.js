console.log("JS Loaded: main.js executing");

const logEl = document.getElementById("log");
const fileInput = document.getElementById("excelUpload");

// By Class filters
const termSelect = document.getElementById("termSelect");
const subjectSelect = document.getElementById("subjectSelect");

// By Subject filters
const termSelectSubject = document.getElementById("termSelectSubject");
const subjectSelectSubject = document.getElementById("subjectSelectSubject");

// Navigation + sections
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
let allTerms = [];
let allSubjects = [];

// ---------- UI helpers ----------

function log(msg) {
    console.log(msg);
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
}

function showSection(sectionKey) {
    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.section === sectionKey);
    });
    for (const [key, el] of Object.entries(sections)) {
        el.classList.toggle("active", key === sectionKey);
    }
}

// Navigation
navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.section;
        showSection(target);
        log(`Switched to page: ${target}`);

        if (target === "by-class" && allRows.length > 0) {
            updateDashboardByClass();
        }
        if (target === "by-subject" && allRows.length > 0) {
            updateDashboardBySubject();
        }
    });
});

// ---------- Generic helpers ----------

function unique(arr) {
    return Array.from(new Set(arr)).filter(
        v => v !== null && v !== undefined && v !== ""
    );
}

// ---------- BY CLASS ----------

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

// ---------- BY SUBJECT ----------

function getFilteredRowsBySubject() {
    const term = termSelectSubject.value;
    const subject = subjectSelectSubject.value;

    return allRows.filter(row =>
        (subject === "all" || row.subject === subject) &&
        (term === "all" || row.term === term)
    );
}

// Average by class for selected subject
function computeSubjectClassAverages(rows) {
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

function renderSubjectClassChart(summary) {
    const chartDiv = document.getElementById("chart-subject-class");

    if (!summary.length) {
        Plotly.newPlot(chartDiv, [], {
            title: "No data (class averages)",
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
        title: "Average grade by class (selected subject)",
        xaxis: { title: "Class" },
        yaxis: { title: "Average grade" }
    });
}

// Distribution chart
function renderSubjectDistributionChart(rows) {
    const chartDiv = document.getElementById("chart-subject-dist");

    const vals = rows
        .map(r => Number(r.final_percent ?? r.final_5scale ?? NaN))
        .filter(v => !Number.isNaN(v));

    if (!vals.length) {
        Plotly.newPlot(chartDiv, [], {
            title: "No data (distribution)",
            xaxis: { title: "Grade" },
            yaxis: { title: "Count" }
        });
        return;
    }

    Plotly.newPlot(chartDiv, [{
        x: vals,
        type: "histogram"
    }], {
        title: "Distribution of grades (selected subject)",
        xaxis: { title: "Grade" },
        yaxis: { title: "Number of students" }
    });
}

// Trend across terms
function computeSubjectTrend(allRowsForSubject) {
    // group by term across all classes
    const groups = {};
    for (const r of allRowsForSubject) {
        if (!r.term) continue;
        if (!groups[r.term]) groups[r.term] = { sum: 0, count: 0 };

        const val = Number(r.final_percent ?? r.final_5scale ?? NaN);
        if (!Number.isNaN(val)) {
            groups[r.term].sum += val;
            groups[r.term].count += 1;
        }
    }

    // keep consistent term order from allTerms
    return allTerms.map(term => {
        const g = groups[term];
        return {
            term,
            avg: g && g.count ? g.sum / g.count : null
        };
    });
}

function renderSubjectTrendChart(trend) {
    const chartDiv = document.getElementById("chart-subject-trend");

    const valid = trend.filter(r => r.avg !== null);
    if (!valid.length) {
        Plotly.newPlot(chartDiv, [], {
            title: "No data (trend)",
            xaxis: { title: "Term" },
            yaxis: { title: "Average grade" }
        });
        return;
    }

    Plotly.newPlot(chartDiv, [{
        x: trend.map(r => r.term),
        y: trend.map(r => r.avg),
        type: "scatter",
        mode: "lines+markers"
    }], {
        title: "Trend across terms (selected subject)",
        xaxis: { title: "Term" },
        yaxis: { title: "Average grade" }
    });
}

function updateDashboardBySubject() {
    if (!allRows.length) return;

    const filtered = getFilteredRowsBySubject();
    log(`By Subject → filtered rows: ${filtered.length}`);

    // Class averages
    const classSummary = computeSubjectClassAverages(filtered);
    renderSubjectClassChart(classSummary);

    // Distribution
    renderSubjectDistributionChart(filtered);

    // Trend (use all rows for selected subject, ignoring term filter)
    const subj = subjectSelectSubject.value;
    const rowsForTrend = allRows.filter(r =>
        (subj === "all" || r.subject === subj)
    );
    const trend = computeSubjectTrend(rowsForTrend);
    renderSubjectTrendChart(trend);
}

// ---------- Event listeners ----------

// By Class filters
termSelect.addEventListener("change", updateDashboardByClass);
subjectSelect.addEventListener("change", updateDashboardByClass);

// By Subject filters
termSelectSubject.addEventListener("change", updateDashboardBySubject);
subjectSelectSubject.addEventListener("change", updateDashboardBySubject);

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
        FA: r.FA !== undefined ? Number(r.FA) : null,
        SAU: r.SAU !== undefined ? Number(r.SAU) : null,
        SAT: r.SAT !== undefined ? Number(r.SAT) : null,
        final_percent: r.final_percent !== undefined ? Number(r.final_percent) : null,
        final_5scale: r.final_5scale !== undefined ? Number(r.final_5scale) : null
    }));

    log("Rows normalized: " + allRows.length);

    // Populate global terms/subjects
    allTerms = unique(allRows.map(r => r.term));
    allSubjects = unique(allRows.map(r => r.subject));

    // ----- Populate By Class filters -----
    termSelect.innerHTML = '<option value="all">All terms</option>';
    allTerms.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        termSelect.appendChild(opt);
    });

    subjectSelect.innerHTML = '<option value="all">All subjects</option>';
    allSubjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s; opt.textContent = s;
        subjectSelect.appendChild(opt);
    });

    // ----- Populate By Subject filters -----
    termSelectSubject.innerHTML = '<option value="all">All terms</option>';
    allTerms.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        termSelectSubject.appendChild(opt);
    });

    subjectSelectSubject.innerHTML = '<option value="all">All subjects</option>';
    allSubjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s; opt.textContent = s;
        subjectSelectSubject.appendChild(opt);
    });

    log("Terms: " + allTerms.join(", "));
    log("Subjects: " + allSubjects.join(", "));

    // If user is on By Class or By Subject, update charts
    if (sections["by-class"].classList.contains("active")) {
        updateDashboardByClass();
    }
    if (sections["by-subject"].classList.contains("active")) {
        updateDashboardBySubject();
    }
});

// Initial state
showSection("overview");
log("App initialized. Upload an Excel file to start.");
