// ===============================
//  main.js (FULL + STUDENTS HOOK)
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
    if (v == null) return null;
    if (typeof v === "number") return v;
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
    const rawGrades = [];
    const rawWeights = [];
    const rawScale = [];

    for (const file of files) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);

        function load(sheetKey) {
            const sheetName = wb.SheetNames.find(name => name.toLowerCase().includes(sheetKey));
            if (!sheetName) return [];
            return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        }

        SBI.state.students.push(...load("учащ"));
        SBI.state.teachers.push(...load("учител"));
        SBI.state.classes.push(...load("класс"));
        SBI.state.subjects.push(...load("предмет"));
        SBI.state.terms.push(...load("четвер"));
        SBI.state.teacherQuals.push(...load("qual"));
        SBI.state.assignments.push(...load("назнач"));
        SBI.state.attendanceRows.push(...load("посещ"));

        rawGrades.push(...load("оцен"));
        rawWeights.push(...load("вес"));
        rawScale.push(...load("шкал"));
    }

    SBI.processAnalytics(rawGrades, rawWeights, rawScale);

    // Trigger all dashboards
    if (window.SBI_Overview?.onDataLoaded) SBI_Overview.onDataLoaded();
    if (window.SBI_Class?.onDataLoaded)    SBI_Class.onDataLoaded();
    if (window.SBI_Attendance?.onDataLoaded) SBI_Attendance.onDataLoaded();

    // ⭐ NEW — Students dashboard
    if (window.SBI_Students?.onDataLoaded) SBI_Students.onDataLoaded();
};

SBI.processAnalytics = function(grades, weightRows, scaleRows) {
    const scaleRules = scaleRows.map(r => ({
        grade: Number(r.grade_5pt),
        min: Number(r.pct_min),
        max: Number(r.pct_max)
    })).sort((a,b)=>b.min-a.min);

    SBI.state.gradingScale = scaleRules;

    const weights = {};
    weightRows.forEach(r => {
        const t = r.term_id;
        const s = r.subject_id;
        if (!weights[t]) weights[t] = {};
        if (!weights[t][s]) weights[t][s] = {};
        weights[t][s][r.work_type] = Number(r.weight_pct)/100;
    });

    function getW(term, subj, type) {
        return weights[term]?.[subj]?.[type] ??
               weights[term]?.default?.[type] ??
               weights.default?.default?.[type] ??
               (type === "СОЧ" ? 0.5 : type==="СОР" ? 0.25 : 0.25);
    }

    const groups = {};
    grades.forEach(r => {
        const key = `${r.student_id}|${r.subject_id}|${r.term_id}`;
        if (!groups[key]) {
            groups[key] = {
                student_id: r.student_id,
                subject_id: r.subject_id,
                term: r.term_id,
                class_id: r.class_id,
                scores: { "ФО": [], "СОР": [], "СОЧ": [] }
            };
        }
        const type = (r.work_type || "ФО").toUpperCase();
        let pct = parsePercent(r.percent);
        if (!pct && r.score && r.max_score)
            pct = 100 * Number(r.score) / Number(r.max_score);
        if (pct != null) groups[key].scores[type].push(pct);
    });

    SBI.state.allRows = [];

    Object.values(groups).forEach(g => {
        const avg = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;

        const total =
            avg(g.scores["ФО"])  * getW(g.term, g.subject_id, "ФО") +
            avg(g.scores["СОР"]) * getW(g.term, g.subject_id, "СОР") +
            avg(g.scores["СОЧ"]) * getW(g.term, g.subject_id, "СОЧ");

        SBI.state.allRows.push({
            student_id: g.student_id,
            subject_id: g.subject_id,
            term: g.term,
            class_id: g.class_id,
            final_percent: total,
            final_5scale: convertTo5Scale(total, scaleRules)
        });
    });

    SBI.state.allTerms = [...new Set(SBI.state.allRows.map(r => r.term))];
};

// File upload
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("statusBar");
    btn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = ".xlsx,.xls";
        input.onchange = () => SBI.loadData(input.files);
        input.click();
    });
});
