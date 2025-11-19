// ===============================
// main.js (FINAL)
// ===============================

console.log("main.js loaded");

window.SBI = {};
SBI.state = {
    allRows: [],
    students: [],
    teachers: [],
    teacherQuals: [],
    assignments: [],
    classes: [],
    subjects: [],
    terms: [],
    attendanceRows: [],
    weights: {},
    gradingScale: [],
};

function parsePercent(v) {
    if (typeof v === "number") return v;
    if (!v) return null;
    return parseFloat(String(v).replace(",", ".").replace("%", ""));
}

function convertTo5Scale(score, rules) {
    if (!rules.length) {
        if (score >= 85) return 5;
        if (score >= 70) return 4;
        if (score >= 55) return 3;
        return 2;
    }
    for (const r of rules) {
        if (score >= r.min && score <= r.max) return r.grade;
    }
    return 2;
}

SBI.loadData = async function(files) {
    console.log("Loading files...");

    const rawGrades = [];
    const rawWeights = [];
    const rawScale = [];

    for (const file of files) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);

        const load = key => {
            const name = wb.SheetNames.find(n => n.toLowerCase().includes(key));
            if (!name) return [];
            return XLSX.utils.sheet_to_json(wb.Sheets[name]);
        };

        SBI.state.students.push(...load("учащ"));
        SBI.state.teachers.push(...load("учител"));
        SBI.state.classes.push(...load("класс"));
        SBI.state.subjects.push(...load("предмет"));
        SBI.state.terms.push(...load("четвер"));
        SBI.state.attendanceRows.push(...load("посещ"));

        rawGrades.push(...load("оцен"));
        rawWeights.push(...load("вес"));
        rawScale.push(...load("шкал"));
    }

    SBI.processAnalytics(rawGrades, rawWeights, rawScale);

    // Trigger dashboards
    if (window.SBI_Overview?.onDataLoaded)  SBI_Overview.onDataLoaded();
    if (window.SBI_Class?.onDataLoaded)     SBI_Class.onDataLoaded();
    if (window.SBI_Attendance?.onDataLoaded) SBI_Attendance.onDataLoaded();

    // ⭐ NEW — Students dashboard
    if (window.SBI_Students?.onDataLoaded) SBI_Students.onDataLoaded();
};

SBI.processAnalytics = function(grades, weights, scale) {
    const scaleRules = scale.map(r => ({
        grade: Number(r.grade_5pt),
        min: Number(r.pct_min),
        max: Number(r.pct_max)
    })).sort((a,b)=>b.min-a.min);

    SBI.state.gradingScale = scaleRules;

    // Grouping
    const groups = {};
    grades.forEach(r => {
        const key = `${r.student_id}|${r.subject_id}|${r.term_id}`;
        if (!groups[key]) {
            groups[key] = {
                sid: r.student_id,
                sub: r.subject_id,
                term: r.term_id,
                class_id: r.class_id,
                scr: { "ФО":[], "СОР":[], "СОЧ":[] }
            };
        }
        let pct = parsePercent(r.percent);
        if (!pct && r.score && r.max_score)
            pct = 100*Number(r.score)/Number(r.max_score);
        if (pct != null) {
            const typ = (r.work_type || "ФО").toUpperCase();
            if (!groups[key].scr[typ]) groups[key].scr[typ] = [];
            groups[key].scr[typ].push(pct);
        }
    });

    SBI.state.allRows = [];

    Object.values(groups).forEach(g => {
        const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
        const total =
            avg(g.scr["ФО"]) +
            avg(g.scr["СОР"]) +
            avg(g.scr["СОЧ"]);

        SBI.state.allRows.push({
            student_id: g.sid,
            subject_id: g.sub,
            class_id: g.class_id,
            term: g.term,
            final_percent: total,
            final_5scale: convertTo5Scale(total, scaleRules)
        });
    });

    SBI.state.allTerms = [...new Set(SBI.state.allRows.map(r => r.term))];
};

// File Upload (Click on "Загрузить Excel")
document.addEventListener("DOMContentLoaded", () => {
    const bar = document.getElementById("statusBar");
    bar.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".xlsx,.xls";
        input.multiple = true;
        input.onchange = () => SBI.loadData(input.files);
        input.click();
    });
});
