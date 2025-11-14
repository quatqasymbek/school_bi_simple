// main.js
console.log("JS Loaded: main.js executing");

const fileInput = document.getElementById("excelUpload");
SBI.setStatus("Please upload Excel file.");

/* ===========================================
   MAIN FILE READER
=========================================== */
fileInput.addEventListener("change", async () => {
    SBI.log("Upload event fired.");
    const file = fileInput.files[0];
    if (!file) {
        SBI.log("No file selected.");
        SBI.setStatus("No file selected.");
        return;
    }

    SBI.log("File selected: " + file.name);
    SBI.setStatus("Reading Excel file…");

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    SBI.log("Sheets found: " + workbook.SheetNames.join(", "));

    const state = SBI.state;

    /* ===========================================
       ASSESSMENTS
    ========================================== */
    if (!workbook.Sheets["ASSESSMENTS"]) {
        SBI.setStatus("❌ ASSESSMENTS sheet missing.");
        return;
    }

    const rawAssess = XLSX.utils.sheet_to_json(
        workbook.Sheets["ASSESSMENTS"],
        { defval: null }
    );

    SBI.log("Rows loaded from ASSESSMENTS: " + rawAssess.length);

    state.allRows = rawAssess.map(r => ({
        student_id: r.student_id,
        student_name: r.student_name,
        class: String(r.class || "").trim(),
        subject: String(r.subject || "").trim(),
        term: String(r.term || "").trim(),
        FA: r.FA !== undefined ? Number(r.FA) : null,
        SAU: r.SAU !== undefined ? Number(r.SAU) : null,
        SAT: r.SAT !== undefined ? Number(r.SAT) : null,
        final_percent: r.final_percent !== undefined ? Number(r.final_percent) : null,
        final_5scale: r.final_5scale !== undefined ? Number(r.final_5scale) : null
    }));

    state.allTerms = SBI.unique(state.allRows.map(r => r.term));
    state.allSubjects = SBI.unique(state.allRows.map(r => r.subject));
    state.allClasses = SBI.unique(state.allRows.map(r => r.class));

    SBI.log("Rows normalized: " + state.allRows.length);
    SBI.log("Terms: " + state.allTerms.join(", "));
    SBI.log("Subjects: " + state.allSubjects.join(", "));
    SBI.log("Classes: " + state.allClasses.join(", "));

    /* ===========================================
       TEACHERS (NEW LOGIC)
    ========================================== */
    state.allTeachers = [];
    state.teacherAssignments = {};

    if (workbook.Sheets["TEACHERS"]) {
        const rawTeachers = XLSX.utils.sheet_to_json(
            workbook.Sheets["TEACHERS"],
            { defval: null }
        );

        // Normalize teacher list
        state.allTeachers = rawTeachers.map(t => ({
            teacher_id: String(t.teacher_id || "").trim(),
            teacher_name: String(t.teacher_name || "").trim(),
            subject: String(t.subject || "").trim(),
            category: t.category,
            term: String(t.term || "").trim()
        }));

        SBI.log("Teachers loaded: " + state.allTeachers.length);

        // Build mapping: teacher -> class based on ASSESSMENTS
        if (window.buildTeacherAssignments) {
            buildTeacherAssignments(state.allTeachers, state.allRows);
        } else {
            SBI.log("WARNING: buildTeacherAssignments() missing.");
        }
    } else {
        SBI.log("⚠️ TEACHERS sheet not found. Teacher dashboard limited.");
    }

    /* ===========================================
       ATTENDANCE (FIXED)
    ========================================== */
    state.attendanceRows = [];
    state.attendanceTerms = [];
    state.attendanceClasses = [];

    if (workbook.Sheets["ATTENDANCE"]) {
        const rawAtt = XLSX.utils.sheet_to_json(
            workbook.Sheets["ATTENDANCE"],
            { defval: null }
        );

        // Normalize attendance
        state.attendanceRows = rawAtt.map(r => ({
            term: String(r.term || "").trim(),
            class: String(r.class || "").trim(),
            abs_total: Number(r.abs_total ?? 0)
        }));

        state.attendanceTerms = SBI.unique(state.attendanceRows.map(r => r.term));
        state.attendanceClasses = SBI.unique(state.attendanceRows.map(r => r.class));

        SBI.log("Attendance rows loaded: " + state.attendanceRows.length);
    } else {
        SBI.log("⚠️ ATTENDANCE sheet not found.");
    }

    SBI.setStatus("Data loaded successfully.");

    /* ===========================================
       Notify dashboards
    ========================================== */
    if (window.SBI_Overview) SBI_Overview.onDataLoaded();
    if (window.SBI_Class) SBI_Class.onDataLoaded();
    if (window.SBI_Subject) SBI_Subject.onDataLoaded();
    if (window.SBI_Teacher) SBI_Teacher.onDataLoaded();
    if (window.SBI_Attendance) SBI_Attendance.onDataLoaded();
    if (window.SBI_Trends) SBI_Trends.onDataLoaded();
});

/* ===========================================
   Overview mini-module (simple)
=========================================== */
if (!window.SBI_Overview) {
    window.SBI_Overview = {
        onDataLoaded: function () {
            const state = SBI.state;
            const el = document.getElementById("chart-overview-school");
            if (!el || !state.allRows.length) return;

            const byTerm = SBI.groupBy(
                state.allRows,
                r => r.term,
                r => Number(r.final_percent ?? r.final_5scale ?? NaN)
            );

            const terms = state.allTerms;
            const avg = terms.map(t => SBI.mean(byTerm[t] || []));

            Plotly.newPlot(el, [{
                x: terms,
                y: avg,
                mode: "lines+markers"
            }], {
                title: "School-wide Average Grade by Term",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
        }
    };
}

/* Initialize */
SBI.setStatus("App initialized. Upload an Excel file to start.");
SBI.log("App initialized. Upload an Excel file to start.");
