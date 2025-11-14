console.log("dashboard_teacher.js loaded");

// teacherAssignments = {
//   "Teacher 1": [
//       { subject: "...", term: "...", class: "1A" },
//       ...
//   ]
// }

let teacherAssignments = {};
let teacherList = [];

// Build mapping between teachers and the classes they teach
function buildTeacherAssignments(teachers, assessmentRows) {
    teacherAssignments = {};
    teacherList = [];

    if (!teachers || teachers.length === 0) {
        console.warn("No TEACHERS sheet data available");
        return;
    }

    teachers.forEach(t => {
        const teacher = String(t.name).trim();
        const subject = String(t.subject).trim();
        const term = String(t.term).trim();

        // Initialize teacher container
        if (!teacherAssignments[teacher]) teacherAssignments[teacher] = [];

        // Add to teacher list
        if (!teacherList.includes(teacher)) teacherList.push(teacher);

        // Now match to ASSESSMENTS (find classes taught in that subject+term)
        assessmentRows.forEach(r => {
            if (r.subject === subject && r.term === term) {
                teacherAssignments[teacher].push({
                    subject: subject,
                    term: term,
                    class: r.class
                });
            }
        });
    });

    console.log("Computed teacherAssignments:", teacherAssignments);
}


function renderTeacherDashboard(rows) {
    const teacherSelect = document.getElementById("teacherSelect");
    const subjectSelect = document.getElementById("teacherSubjectSelect");

    const teacher = teacherSelect.value;
    if (!teacher) return;

    const mapping = teacherAssignments[teacher] || [];

    // Get unique subjects taught by this teacher
    const subjects = [...new Set(mapping.map(m => m.subject))];

    // Fill subject dropdown
    subjectSelect.innerHTML = "";
    subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        subjectSelect.appendChild(opt);
    });

    const subject = subjectSelect.value || subjects[0];
    if (!subject) return;

    // Find classes taught by teacher for this subject
    const classes = mapping
        .filter(m => m.subject === subject)
        .map(m => m.class);

    console.log("By Teacher → classes matched:", classes);

    // Filter the rows for these classes + this subject
    const filtered = rows.filter(r =>
        classes.includes(r.class) && r.subject === subject
    );

    console.log(`By Teacher → filtered rows: ${filtered.length}`);

    // If no data — show message
    if (filtered.length === 0) {
        document.getElementById("chart-teacher-performance").innerHTML =
            "<p>No data for this teacher/subject.</p>";
        return;
    }

    // -----------------------------
    // Performance Boxplot
    // -----------------------------
    Plotly.newPlot("chart-teacher-performance", [{
        x: filtered.map(r => r.term),
        y: filtered.map(r => r.final_percent),
        type: "box"
    }], {
        title: `${teacher} — Performance (${subject})`
    });

    // -----------------------------
    // Subject Load Chart
    // -----------------------------
    const loadCounts = {};
    classes.forEach(c => {
        loadCounts[c] = filtered.filter(r => r.class === c).length;
    });

    Plotly.newPlot("chart-teacher-subjects", [{
        x: Object.keys(loadCounts),
        y: Object.values(loadCounts),
        type: "bar"
    }], {
        title: "Class Load (how many marks the teacher gave)"
    });

    // -----------------------------
    // Trend Chart
    // -----------------------------
    const trend = {};
    filtered.forEach(r => {
        if (!trend[r.term]) trend[r.term] = [];
        trend[r.term].push(r.final_percent);
    });

    const termList = Object.keys(trend);
    const avgList = termList.map(t => trend[t].reduce((a,b)=>a+b,0)/trend[t].length);

    Plotly.newPlot("chart-teacher-trend", [{
        x: termList,
        y: avgList,
        mode: "lines+markers"
    }], {
        title: "Average Grade Trend"
    });
}
