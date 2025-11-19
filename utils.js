window.SBI = window.SBI || {};

SBI.mean = function(arr) {
    if (!arr || arr.length === 0) return 0;
    const valid = arr.filter(n => n != null && !isNaN(n));
    if (valid.length === 0) return 0;
    return valid.reduce((a,b) => a+b, 0) / valid.length;
};

SBI.unique = function(arr) {
    return [...new Set(arr)].filter(x => x != null && x !== "");
};

SBI.groupBy = function(arr, keyFn) {
    return arr.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
};

// ================================
// Add missing helper function
// ================================
window.SBI = window.SBI || {};

SBI.unique = function(arr) {
    return [...new Set(arr)];
};

SBI.mean = function(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/* ================================
   REQUIRED HELPER FUNCTIONS
   Add to utils.js (copy–paste)
================================ */

window.SBI = window.SBI || {};

// Return unique values from array
SBI.unique = function(arr) {
    return [...new Set(arr)];
};

// Average of numeric array
SBI.mean = function(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
};
