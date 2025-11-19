// ================================================
// utils.js  (FINAL – REQUIRED FUNCTIONS INCLUDED)
// ================================================

console.log("utils.js loaded");

// Ensure SBI namespace exists
window.SBI = window.SBI || {};

/* ================================================
   BASIC ARRAY HELPERS
================================================ */

// Return unique values from array
SBI.unique = function(arr) {
    try {
        return [...new Set(arr)];
    } catch (e) {
        console.error("SBI.unique error:", e);
        return [];
    }
};

// Average of array
SBI.mean = function(arr) {
    if (!arr || arr.length === 0) return 0;
    let sum = 0;
    for (let x of arr) sum += Number(x) || 0;
    return sum / arr.length;
};

// Sum of array
SBI.sum = function(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + (Number(b) || 0), 0);
};

// Safe percent (avoid division by zero)
SBI.safePercent = function(n, d) {
    if (!d) return 0;
    return (100 * n / d).toFixed(1);
};


/* =====================================================
   MISC HELPERS (used by dashboards)
===================================================== */

SBI.formatGrade = function(g) {
    if (g == null || g === "-") return "-";
    const n = Number(g);
    if (n >= 4.5) return `<span class="grade-good">${n.toFixed(2)}</span>`;
    if (n < 3)    return `<span class="grade-bad">${n.toFixed(2)}</span>`;
    return n.toFixed(2);
};

SBI.formatPercent = function(v) {
    if (v == null) return "-";
    return Number(v).toFixed(1) + "%";
};
