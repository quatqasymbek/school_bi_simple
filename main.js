// main.js
console.log("JS Loaded: main.js executing");

const fileInput = document.getElementById("excelUpload");

SBI.setStatus("Please upload Excel file.");

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

    // ----------------- ASSESSMENTS -----------------
    if (!workbook.Sheets["ASSESSMENTS"]) {
        SBI.log("❌ 'ASSESSMENTS' sheet not found.");
        SBI.setStatus("ASSESSMENTS sheet not found in Excel.");
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
    state.allClasses = SBI.unique(state.allRows.map(r => r.class));

    SBI.log("Terms: " + state.allTerms.join(", "));
    SBI.log("Subjects: " + state.allSubjects.join(", "));
    SBI.log("Classes: " + state.allClasses.join(", "));

    // ----------------- TEACHERS -----------------
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

    // ----------------- ATTENDANCE (optional) -----------------
    state.attendanceRows = [];
    state.attendanceTerms = [];
    state.attendanceClasses = [];

    if (workbook.Sheets["ATTENDANCE"]) {
        const rawAtt = XLSX.utils.sheet_to_json(
            workbook.Sheets["ATTENDANCE"],
            { defval: null }
        );
        // Expecting columns: date, term, class, student_id, present OR absent
        state.attendanceRows = rawAtt.map(r => ({
            date: r.date,
            term: r.term,
            class: r.class,
            student_id: r.student_id,
            present: r.present !== undefined ? Number(r.present) : null,
            absent: r.absent !== undefined ? Number(r.absent) : null
        }));

        state.attendanceTerms = SBI.unique(state.attendanceRows.map(r => r.term));
        state.attendanceClasses = SBI.unique(state.attendanceRows.map(r => r.class));
        SBI.log("Attendance rows loaded: " + state.attendanceRows.length);
    } else {
        SBI.log("ATTENDANCE sheet not found (attendance dashboard limited).");
    }

    SBI.setStatus("Data loaded successfully.");

    // Notify each dashboard
    if (window.SBI_Overview) SBI_Overview.onDataLoaded();
    if (window.SBI_Class) SBI_Class.onDataLoaded();
    if (window.SBI_Subject) SBI_Subject.onDataLoaded();
    if (window.SBI_Teacher) SBI_Teacher.onDataLoaded();
    if (window.SBI_Attendance) SBI_Attendance.onDataLoaded();
    if (window.SBI_Trends) SBI_Trends.onDataLoaded();
});

// Initialize dashboards and overview
if (!window.SBI_Overview) {
    // Simple overview dashboard inside trends.js or here
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
                title: "School-wide average grade by term",
                xaxis: { title: "Term" },
                yaxis: { title: "Average grade" }
            });
        }
    };
}

SBI.setStatus("App initialized. Upload an Excel file to start.");
SBI.log("App initialized. Upload an Excel file to start.");
