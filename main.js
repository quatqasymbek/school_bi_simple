// main.js — FULL FILE INCLUDING THE REQUIRED PATCH

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
    gradingScale: []
};

function parsePercent(val) {
    if (val == null) return null;
    if (typeof val === "number") return val;
    let s = String(val).replace(",", ".").replace("%", "").trim();
    const num = parseFloat(s);
    return isNaN(num) ? null : num;
}

function convertTo5Scale(score, rules) {
    if (!rules || rules.length === 0) {
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
    SBI.state.allRows = [];
    SBI.state.students = [];
    SBI.state.teachers = [];
    SBI.state.classes = [];
    SBI.state.subjects = [];
    SBI.state.terms = [];
    SBI.state.assignments = [];
    SBI.state.teacherQuals = [];
    SBI.state.attendanceRows = [];
    SBI.state.weights = {};
    SBI.state.gradingScale = [];

    const rawGrades = [];
    const rawWeights = [];
    const rawScale = [];

    for (const file of files) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);

        function getData(keyword) {
            const low = keyword.toLowerCase();
            let sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes(low));
            if (!sheetName) {
                if (file.name.toLowerCase().includes(low)) {
                    sheetName = workbook.SheetNames[0];
                }
            }
            if (!sheetName) return [];
            return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }

        SBI.state.students.push(...getData("УЧАЩ"));
        SBI.state.teachers.push(...getData("УЧИТ"));
        SBI.state.classes.push(...getData("КЛАСС"));
        SBI.state.subjects.push(...getData("ПРЕД"));
        SBI.state.terms.push(...getData("ЧЕТВ"));
        SBI.state.assignments.push(...getData("НАЗН"));
        SBI.state.teacherQuals.push(...getData("QUAL"));
        SBI.state.attendanceRows.push(...getData("ПОСЕЩ"));

        rawGrades.push(...getData("ОЦЕН"));
        rawWeights.push(...getData("ВЕС"));
        rawScale.push(...getData("ШКАЛ"));
    }

    SBI.processAnalytics(rawGrades, rawWeights, rawScale);

    // Trigger dashboards
    if (window.SBI_Overview?.onDataLoaded) SBI_Overview.onDataLoaded();
    if (window.SBI_Class?.onDataLoaded) SBI_Class.onDataLoaded();
    if (window.SBI_Attendance?.onDataLoaded) SBI_Attendance.onDataLoaded();

    // -----------------------------------------------
    // NEW REQUIRED ADDITION (Students dashboard)
    // -----------------------------------------------
    if (window.SBI_Students?.onDataLoaded) SBI_Students.onDataLoaded();
};

SBI.processAnalytics = function(grades, weightRows, scaleRows) {

    const scaleRules = scaleRows
        .filter(r => r.grade_5pt != null)
        .map(r => ({
            grade: Number(r.grade_5pt),
            min : Number(r.pct_min),
            max : Number(r.pct_max)
        }))
        .sort((a, b) => b.min - a.min);

    SBI.state.gradingScale = scaleRules;

    const weightMap = {};
    weightRows.forEach(r => {
        const t = r.term_id;
        const s = r.subject_id;
        const w = r.work_type;
        if (!weightMap[t]) weightMap[t] = {};
        if (!weightMap[t][s]) weightMap[t][s] = {};
        weightMap[t][s][w] = Number(r.weight_pct) / 100;
    });

    function getWeight(term, sub, type) {
        if (weightMap[term]?.[sub]?.[type]) return weightMap[term][sub][type];
        if (weightMap[term]?.default?.[type]) return weightMap[term].default[type];
        if (weightMap.default?.default?.[type]) return weightMap.default.default[type];

        if (type === "СОЧ") return 0.5;
        if (type === "СОР") return 0.25;
        return 0.25;
    }

    const groups = {};

    grades.forEach(r => {
        const sid = r.student_id;
        const sub = r.subject_id;
        const term = r.term_id;

        const key = `${sid}|${sub}|${term}`;
        if (!groups[key]) {
            groups[key] = {
                sid, sub, term,
                class_id: r.class_id,
                scores: { "ФО": [], "СОР": [], "СОЧ": [] }
            };
        }

        const type = (r.work_type || "ФО").toUpperCase().trim();
        let pct = null;

        if (r.percent != null) pct = parsePercent(r.percent);
        else if (r.score != null && r.max_score != null) {
            pct = (Number(r.score) / Number(r.max_score)) * 100;
        }

        if (pct != null) {
            if (!groups[key].scores[type]) groups[key].scores[type] = [];
            groups[key].scores[type].push(pct);
        }
    });

    SBI.state.allRows = [];

    Object.values(groups).forEach(g => {
        const avg = (arr) => {
            arr = arr.filter(a => a != null);
            if (arr.length === 0) return null;
            return arr.reduce((a, b) => a + b, 0) / arr.length;
        };

        const aFO = avg(g.scores["ФО"]) ?? 0;
        co
