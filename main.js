// main.js - Data Loading and Processing Core
console.log("MAIN.JS: Initializing...");

window.SBI = window.SBI || {};
const SBI = window.SBI;

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
SBI.state = {
    allRows: [], // The processed analytic rows (Student x Subject x Term)
    students: [],
    teachers: [],
    classes: [],
    subjects: [],
    terms: [],
    weights: {}, // Weights map
    gradingScale: [], // 5-point scale rules
    // Data from CSV
    rawGrades: [],
    rawAttendance: [],
    rawClasses: [],
    rawTerms: [],
    rawStudents: [],
    rawTeachers: [],
    rawTeacherAssignments: [],
    rawSubjects: [],
    rawEnrollments: [],
};

// ==========================================
// 2. DATA PROCESSING HELPERS
// ==========================================

// Parse "100" or "100%" or "0.85" to a float 0-100
function parsePercent(val) {
    if (val == null || val === "") return null;
    let s = String(val).replace(",", ".").replace("%", "").trim();
    let n = parseFloat(s);
    if (isNaN(n)) return null;
    // If small decimal like 0.85, treat as 85% unless it's clearly a low score out of 100
    // But context matters. Usually grades are 0-100.
    // If the input seems to be a ratio (0-1), convert to 0-100.
    if (n <= 1.0 && n > 0) return n * 100; 
    return n;
}

// Convert 0-100 score to 5-point scale based on rules
function convertTo5Scale(score, scaleRules) {
    if (score == null) return null;
    // Sort rules from highest pct_min to lowest to ensure correct mapping
    const sortedRules = scaleRules.slice().sort((a, b) => b.pct_min - a.pct_min);
    
    for (const rule of sortedRules) {
        if (score >= rule.pct_min) {
            return rule.grade_5pt;
        }
    }
    return null; // Should not happen if 0-54 rule is present
}

/**
 * Groups raw data by a key.
 * @param {Array<Object>} arr - Array of objects to group.
 * @param {string} key - The property key to group by.
 * @returns {Object<string, Array<Object>>} - Grouped object.
 */
function groupBy(arr, key) {
    return arr.reduce((acc, obj) => {
        const k = obj[key];
        if (!acc[k]) {
            acc[k] = [];
        }
        acc[k].push(obj);
        return acc;
    }, {});
}

/**
 * The main data processing pipeline. Calculates final marks.
 */
function processRawData() {
    console.log("Processing raw data...");
    const rawGrades = SBI.state.rawGrades;
    const weights = SBI.state.weights;
    const gradingScale = SBI.state.gradingScale;
    const rawEnrollments = SBI.state.rawEnrollments;

    if (!rawGrades.length) {
        console.warn("No raw grades found. Skipping final mark calculation.");
        return;
    }
    
    console.log(`Grading Scale loaded: ${gradingScale.length} rules.`);
    console.log(`Weights loaded: Object`); // Assuming weights is an object as per snippet
    
    // 1. Group grades by Student x Subject x Term (The core analytic unit)
    const allGroups = {};
    rawGrades.forEach(g => {
        // Create a unique key: StudentID|SubjectID|TermID
        const key = `${g.student_id}|${g.subject_id}|${g.term_id}`;
        
        if (!allGroups[key]) {
            allGroups[key] = {
                sid: g.student_id,
                sub: g.subject_id,
                term: g.term_id,
                class_id: g.class_id, // Use class_id from grade
                grades: []
            };
        }
        // Ensure percent is a number
        g.percent = parsePercent(g.percent);
        g.grade_5pt = convertTo5Scale(g.percent, gradingScale); // Recalculate based on scale for consistency

        allGroups[key].grades.push(g);
    });

    const finalRows = [];

    // 2. Calculate Final Mark for each group
    Object.values(allGroups).forEach(group => {
        const grades = group.grades;
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        let foGrades = [];
        let sorGrades = [];
        let sochGrades = [];

        // Group by work type
        const gradesByType = groupBy(grades, 'work_type');

        // Calculate average for each work type
        let avgFO = null;
        if (gradesByType['ФО'] && gradesByType['ФО'].length > 0) {
            foGrades = gradesByType['ФО'].map(g => g.percent).filter(p => p != null);
            avgFO = SBI.mean(foGrades);
            if (avgFO != null) {
                totalWeightedScore += avgFO * (weights['ФО'] || 0);
                totalWeight += (weights['ФО'] || 0);
            }
        }
        
        let avgSOR = null;
        if (gradesByType['СОР'] && gradesByType['СОР'].length > 0) {
            sorGrades = gradesByType['СОР'].map(g => g.percent).filter(p => p != null);
            avgSOR = SBI.mean(sorGrades);
            if (avgSOR != null) {
                totalWeightedScore += avgSOR * (weights['СОР'] || 0);
                totalWeight += (weights['СОР'] || 0);
            }
        }

        let avgSOCH = null;
        if (gradesByType['СОЧ'] && gradesByType['СОЧ'].length > 0) {
            sochGrades = gradesByType['СОЧ'].map(g => g.percent).filter(p => p != null);
            avgSOCH = SBI.mean(sochGrades);
            if (avgSOCH != null) {
                totalWeightedScore += avgSOCH * (weights['СОЧ'] || 0);
                totalWeight += (weights['СОЧ'] || 0);
            }
        }

        let totalPct = totalWeight > 0 ? totalWeightedScore / totalWeight : null;
        let grade5 = totalPct != null ? convertTo5Scale(totalPct, gradingScale) : null;

        // Final analytic row for this Student x Subject x Term
        finalRows.push({
            student_id: group.sid,
            subject_id: group.sub,
            term: group.term, // standardize property name
            class_id: group.class_id,
            final_percent: totalPct,
            final_5scale: grade5,
            avg_fo: avgFO,
            avg_sor: avgSOR,
            avg_soch: avgSOCH
        });
    });

    // Merge enrollment class info for non-graded terms/subjects (optional, but good practice)
    rawEnrollments.forEach(e => {
        const key = `${e.student_id}|${e.term_id}`; // Simpler key for enrollment
        const hasFinalRow = finalRows.some(r => r.student_id === e.student_id && r.term === e.term_id);
        
        if (!hasFinalRow) {
            // No grades but enrolled. Add a minimal row for counting/attendance analysis.
            // Note: This row will lack subject info, making it less useful for subject dashboards,
            // but confirms the student/term/class is known.
            // We'll rely more on rawEnrollments directly for basic student lists.
        }
    });

    SBI.state.allRows = finalRows;
    SBI.state.allTerms = SBI.unique(finalRows.map(r => r.term));
    SBI.state.allSubjects = SBI.unique(finalRows.map(r => r.subject_id))
        .map(subId => {
            const subject = SBI.state.rawSubjects.find(s => s.subject_id === subId);
            return subject ? subject.subject_name : subId;
        });
    
    console.log(`Data Processed: ${finalRows.length} analytic rows created.`);
}

// ==========================================
// 3. DASHBOARD UPDATE TRIGGER (THE FIX)
// ==========================================

/**
 * Triggers all dashboard components to load and render the new data.
 */
SBI.triggerDashboardUpdates = function() {
    console.log("Triggering Dashboard Updates...");

    // 1. Overview Dashboard (Overview.js/dashboard_overview.js)
    if (window.SBI_Overview && window.SBI_Overview.onDataLoaded) {
        window.SBI_Overview.onDataLoaded();
    }
    
    // 2. Class Dashboard (dashboard_class.js)
    if (window.SBI_Class && window.SBI_Class.onDataLoaded) {
        window.SBI_Class.onDataLoaded();
    }
    
    // 3. Subject Dashboard (dashboard_subject.js)
    if (window.SBI_Subject && window.SBI_Subject.onDataLoaded) {
        window.SBI_Subject.onDataLoaded();
    }

    // 4. Teacher Dashboard (dashboard_teacher.js)
    if (window.SBI_Teacher && window.SBI_Teacher.onDataLoaded) {
        window.SBI_Teacher.onDataLoaded();
    }

    // 5. Student Dashboard (dashboard_student.js)
    if (window.SBI_Students && window.SBI_Students.onDataLoaded) {
        // Must ensure it's initialized first (it wasn't self-initializing in its snippet)
        window.SBI_Students.init(); 
        window.SBI_Students.onDataLoaded();
    }

    // 6. Attendance Dashboard (attendance.js)
    if (window.SBI_Attendance && window.SBI_Attendance.onDataLoaded) {
        // attendance.js needs to know the enrollment data for total students
        window.SBI_Attendance.onDataLoaded();
    }
    
    // Also re-trigger the default active tab render
    const activeLink = document.querySelector('.tab-link.active');
    if (activeLink) {
        const pageId = activeLink.getAttribute('data-page');
        const event = new CustomEvent('DOMContentLoaded');
        document.dispatchEvent(event); // Reruns the tab activation logic
    }
};


// ==========================================
// 4. DATA LOADER (Simplified for CSV)
// ==========================================

const FILE_MAP = {
    // Grade and Weights
    'ОЦЕНКИ': 'rawGrades',
    'ВЕСА_ОЦЕНОК': 'weights',
    'ШКАЛА_5Б': 'gradingScale',
    // Reference Data
    'УЧАЩИЕСЯ': 'rawStudents',
    'УЧИТЕЛЯ': 'rawTeachers',
    'КЛАССЫ': 'rawClasses',
    'ПРЕДМЕТЫ': 'rawSubjects',
    'ЧЕТВЕРТИ': 'rawTerms',
    'СОСТАВ_КЛАССА': 'rawEnrollments',
    'НАЗНАЧЕНИЯ_ПРЕПОД': 'rawTeacherAssignments',
    // Other Data
    'ПОСЕЩАЕМОСТЬ': 'rawAttendance',
};

// Global loadData function exposed to button listener
SBI.loadData = async function (files) {
    console.log(`Attempting to load ${files.length} files...`);

    const promises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Assuming the file name includes the sheet name (e.g., 'example_excel.xlsx - ОЦЕНКИ.csv')
                    const fileNameBase = file.name.toUpperCase();
                    
                    let sheetName = null;
                    for (const key in FILE_MAP) {
                        if (fileNameBase.includes(key)) {
                            sheetName = key;
                            break;
                        }
                    }

                    if (!sheetName) {
                        console.warn(`File ${file.name} ignored: Sheet name not recognized.`);
                        return resolve(null);
                    }
                    
                    // Assume the first sheet is the one to use
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet);

                    console.log(`Sheet loaded: ${sheetName}`);
                    
                    resolve({ sheetName: sheetName, data: json });

                } catch (error) {
                    console.error(`Error processing file ${file.name}:`, error);
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                console.error(`File read error for ${file.name}:`, error);
                reject(error);
            };
            reader.readAsArrayBuffer(file);
        });
    });

    const results = await Promise.all(promises);
    let loadedCount = 0;

    results.filter(r => r).forEach(result => {
        loadedCount++;
        const key = FILE_MAP[result.sheetName];

        if (key === 'gradingScale' || key === 'rawClasses' || key === 'rawSubjects' || key === 'rawTerms' || key === 'rawTeacherAssignments' || key === 'rawEnrollments' || key === 'rawTeachers' || key === 'rawStudents' || key === 'rawAttendance' || key === 'rawGrades') {
            SBI.state[key] = result.data;
            if (key === 'rawStudents') SBI.state.students = result.data; // Alias
            if (key === 'rawClasses') SBI.state.classes = result.data; // Alias
            if (key === 'rawTeachers') SBI.state.teachers = result.data; // Alias
            if (key === 'rawSubjects') SBI.state.subjects = result.data; // Alias
            if (key === 'rawTerms') SBI.state.terms = result.data; // Alias
        } else if (key === 'weights') {
            // Convert weights array to a map { work_type: weight_pct }
            result.data.forEach(w => {
                if (w.work_type && w.weight_pct != null) {
                    // Convert weight_pct to a number (assuming it's a percentage value like 25, 50)
                    const weightNum = parseFloat(String(w.weight_pct).replace('%', ''));
                    if (!isNaN(weightNum)) {
                        SBI.state.weights[w.work_type] = weightNum;
                    }
                }
            });
        }
    });

    console.log(`All sheets loaded: Array(${loadedCount})`);
    
    // --- STEP 1: Process raw data ---
    processRawData();

    // --- STEP 2: Trigger UI update (THE FIX) ---
    SBI.triggerDashboardUpdates();

    console.log("Data loading complete. Dashboards updated.");
};


// Add file listener
document.addEventListener('DOMContentLoaded', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'fileLoader';
    input.addEventListener('change', (e) => SBI.loadData(e.target.files));
    document.body.appendChild(input);

    // Button in header
    const header = document.querySelector('header div:last-child');
    const btn = document.createElement('button');
    btn.innerText = '📂 Загрузить Excel';
    btn.style.background = 'rgba(255,255,255,0.2)';
    btn.style.border = '1px solid rgba(255,255,255,0.4)';
    btn.style.color = '#fff';
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => document.getElementById('fileLoader').click();
    header.appendChild(btn);
});

// Utility function (should be in utils.js, but duplicated for context)
SBI.unique = (arr) => Array.from(new Set(arr));
SBI.mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
SBI.log = console.log;
