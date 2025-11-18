// utils.js
console.log("utils.js загружен");

window.SBI = window.SBI || {};

SBI.state = {
    // агрегированные оценки: одна строка = ученик × предмет × четверть
    allRows: [],
    allTerms: [],
    allSubjects: [],
    allClasses: [],

    // таблицы из Excel
    students: [],
    classesTable: [],
    subjectsTable: [],
    termsTable: [],
    teachers: [],
    assignments: [],

    // индексы
    idx_students: {},
    idx_classes: {},
    idx_subjects: {},
    idx_terms: {},
    idx_teachers: {},

    // учителя
    allTeachers: [],
    teacherAssignments: [],

    // исходные оценки (ОЦЕНКИ)
    gradesRaw: [],

    // посещаемость
    attendanceRows: [],
    attendanceTerms: [],
    attendanceClasses: []
};

const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");

SBI.log = function (msg) {
    console.log(msg);
    if (!logEl) return;
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
};

SBI.setStatus = function (msg) {
    console.log("СТАТУС:", msg);
    if (statusEl) statusEl.textContent = msg;
};

SBI.unique = function (arr) {
    return Array.from(new Set(arr)).filter(
        v => v !== null && v !== undefined && v !== ""
    );
};

SBI.mean = function (arr) {
    const vals = arr.filter(v => typeof v === "number" && !Number.isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
};

SBI.std = function (arr) {
    const vals = arr.filter(v => typeof v === "number" && !Number.isNaN(v));
    if (!vals.length) return null;
    const m = SBI.mean(vals);
    const variance = vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length;
    return Math.sqrt(variance);
};

SBI.groupBy = function (rows, keyFn, valueFn) {
    const map = {};
    rows.forEach(r => {
        const key = keyFn(r);
        if (key == null) return;
        if (!map[key]) map[key] = [];
        map[key].push(valueFn ? valueFn(r) : r);
    });
    return map;
};

// Качество знаний: доля оценок 4–5
SBI.knowledgeRatio = function (rows) {
    if (!rows || !rows.length) return null;

    const vals = rows.map(r => {
        if (r.knowledge_quality != null) {
            return Number(r.knowledge_quality);
        }
        const g = Number(r.final_5scale);
        if (!Number.isNaN(g)) return g >= 4 ? 1 : 0;
        return null;
    }).filter(v => v != null && !Number.isNaN(v));

    if (!vals.length) return null;
    return SBI.mean(vals);
};

// универсальный парсер чисел из Excel (поддержка "0,81")
SBI.toNumber = function (val) {
    if (val == null) return null;
    if (typeof val === "number") {
        return Number.isNaN(val) ? null : val;
    }
    let s = String(val).trim();
    if (!s) return null;
    s = s.replace(",", "."); // 0,81 → 0.81
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
};

// Переключение страниц
function switchPage(pageId) {
    console.log("Переключение страницы:", pageId);
    const pages = document.querySelectorAll(".page");
    pages.forEach(p => p.classList.remove("active"));
    const target = document.getElementById(pageId);
    if (target) target.classList.add("active");
}
