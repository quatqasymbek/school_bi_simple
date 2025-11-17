// utils.js
console.log("utils.js loaded");

window.SBI = window.SBI || {};
SBI.state = {
    // Core analytics rows: one per student × subject × term
    allRows: [],
    allTerms: [],
    allSubjects: [],
    allClasses: [],

    // Dimension / DB tables from the new Excel template
    students: [],        // УЧАЩИЕСЯ
    classesTable: [],    // КЛАССЫ
    subjectsTable: [],   // ПРЕДМЕТЫ
    termsTable: [],      // ЧЕТВЕРТИ
    teachers: [],        // УЧИТЕЛЯ
    assignments: [],     // НАЗНАЧЕНИЯ_ПРЕПОД

    // Quick lookup indexes (filled in main.js)
    idx_students: {},
    idx_classes: {},
    idx_subjects: {},
    idx_terms: {},
    idx_teachers: {},

    // Teacher-centric helpers (for the dashboard)
    allTeachers: [],         // [{ teacher_id, teacher_name, qualification_* }]
    teacherAssignments: [],  // alias of assignments, for convenience

    // Attendance (optional / future)
    attendanceRows: [],      // if you still keep an ATTENDANCE sheet
    attendanceTerms: [],
    attendanceClasses: []
};

const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");

SBI.log = function (msg) {
    console.log(msg);
    if (logEl) {
        logEl.textContent += msg + "\n";
        logEl.scrollTop = logEl.scrollHeight;
    }
};

SBI.setStatus = function (msg) {
    console.log("STATUS:", msg);
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

// Simple page switching
function switchPage(pageId) {
    console.log("Switching to page:", pageId);
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(pageId);
    if (target) target.classList.add("active");
}
