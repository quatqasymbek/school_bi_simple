// main.js
console.log("JS Loaded: main.js executing");

const logEl = document.getElementById("log");
const fileInput = document.getElementById("excelUpload");
const navButtons = document.querySelectorAll(".nav-btn");

const sections = {
    overview: document.getElementById("section-overview"),
    "by-class": document.getElementById("section-by-class"),
    "by-subject": document.getElementById("section-by-subject"),
    "by-teacher": document.getElementById("section-by-teacher"),
    attendance: document.getElementById("section-attendance"),
    trends: document.getElementById("section-trends"),
};

SBI.log = function (msg) {
    console.log(msg);
    if (!logEl) return;
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
};

// Navigation
function showSection(sectionKey) {
    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.section === sectionKey);
    });
    for (const [key, el] of Object.entries(sections)) {
        if (!el) continue;
        el.classList.toggle("active", key === sectionKey);
    }

    // Trigger updates when switching pages
    if (sectionKey === "by-class" && window.SBI_Class) SBI_Class.update();
    if (sectionKey === "by-subject" && window.SBI_Subject) SBI_Subject.update();
    if (sectionKey === "by-teacher" && window.SBI_Teacher) SBI_Teacher.update();
}

navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.section;
        showSection(target);
        SBI.log(`Switched to page: ${target}`);
    });
});

// Excel upload & data loading
fileInput.addEventListener("change", async () => {
    SBI.log("Upload event fired.");
    const file = fileInput.files[0];
    if (!file) {
        SBI.log("No file selected.");
        return;
    }

    SBI.log("File selected: " + file.name);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    SBI.log("Sheets found: " + workbook.SheetNames.join(", "));

    const state = SBI.state;

    // ========== ASSESSMENTS ==========
    if (!workbook.Sheets["ASSESSMENTS"]) {
        SBI.log("❌ 'ASSESSMENTS' sheet not found.");
        return;
    }

    const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets["ASSESSMENTS"],
        { defval: null }
    );

    SBI.log("Rows loaded from ASSESSMENTS: " + rawRows.length);

    state.allRows = rawRows.map(r => ({
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

    SBI.log("Rows normalized: " + state.allRows.length);

    state.allTerms = SBI.unique(state.allRows.map(r => r.term));
    state.allSubjects = SBI.unique(state.allRows.map(r => r.subject));

    SBI.log("Terms: " + state.allTerms.join(", "));
    SBI.log("Subjects: " + state.allSubjects.join(", "));

    // ========== TEACHERS (optional) ==========
    state.allTeachers = [];
    state.teacherAssignments = {};

    if (workbook.Sheets["TEACHERS"]) {
        const rawTeachers = XLSX.utils.sheet_to_json(
            workbook.Sheets["TEACHERS"],
            { defval: null }
        );

        state.allTeachers = rawTeachers.map(t => ({
            teacher_id: t.teacher_id,
            teacher_name: t.teacher_name,
            subject: t.subject,
            classes: t.classes
                ? String(t.classes).split(",").map(s => s.trim())
                : []
        }));

        state.teacherAssignments = {};
        state.allTeachers.forEach(t => {
            if (!state.teacherAssignments[t.teacher_id]) {
                state.teacherAssignments[t.teacher_id] = {
                    name: t.teacher_name,
                    subjects: new Set(),
                    classes: new Set()
                };
            }
            if (t.subject) state.teacherAssignments[t.teacher_id].subjects.add(t.subject);
            t.classes.forEach(c => state.teacherAssignments[t.teacher_id].classes.add(c));
        });

        SBI.log("Teachers loaded: " + state.allTeachers.length);
    } else {
        SBI.log("TEACHERS sheet not found (teacher dashboard limited).");
    }

    // Notify dashboards
    if (window.SBI_Class) SBI_Class.onDataLoaded();
    if (window.SBI_Subject) SBI_Subject.onDataLoaded();
    if (window.SBI_Teacher) SBI_Teacher.onDataLoaded();
});

// Initialize dashboards & default view
if (window.SBI_Class) SBI_Class.init();
if (window.SBI_Subject) SBI_Subject.init();
if (window.SBI_Teacher) SBI_Teacher.init();

showSection("overview");
SBI.log("App initialized. Upload an Excel file to start.");
