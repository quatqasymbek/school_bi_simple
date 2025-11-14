// utils.js
window.SBI = window.SBI || {};
SBI.state = {
    allRows: [],
    allTerms: [],
    allSubjects: [],
    allTeachers: [],
    teacherAssignments: {} // teacher_id -> { name, subjects:Set, classes:Set }
};

// Simple unique helper
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
    const m = SBI.mean(arr);
    if (m === null) return null;
    const vals = arr.filter(v => typeof v === "number" && !Number.isNaN(v));
    if (!vals.length) return null;
    const variance = vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length;
    return Math.sqrt(variance);
};
