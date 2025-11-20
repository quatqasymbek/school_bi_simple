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
    // NEW: Add storage for dictionary data
    dictionaries: {},
    teacherQuals: []
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
    // If input is a ratio (0-1), convert to 0-100.
    if (n <= 1.0 && n > 0) return n * 100; 
    return n;
}

// Convert 0-100 score to 5-point scale based on rules
function convertTo5Scale(score, scaleRules) {
    if (score == null || score < 0) return null;
    // Ensure scaleRules are sorted DESC by grade_5pt for correct matching
    const rule = scaleRules.find(r => score >= r.pct_min && score <= r.pct_max);
    return rule ? rule.grade_5pt : null;
}

// Global logger
SBI.log = console.log;

// Unique array helper (assumed to be in utils.js, but defined here for safety)
SBI.unique = (arr) => [...new Set(arr)];

// Mean helper (assumed to be in utils.js)
SBI.mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;


/**
 * Core function to load and parse a specific sheet's data from uploaded files.
 * @param {string} sheetName - The name of the sheet/file to find (e.g., 'ОЦЕНКИ').
 * @param {FileList | Array<File>} files - The list of files uploaded by the user.
 */
async function loadFile(sheetName, files) {
    // Normalize sheetName for robust, case-insensitive comparison
    const normalizedSheetName = sheetName.toUpperCase().replace(/_/g, '').trim();

    // Look for a file whose name contains the sheetName, case-insensitive
    const file = Array.from(files).find(f => 
        String(f.name).toUpperCase().includes(normalizedSheetName)
    );

    if (!file) {
        // This is the source of the repeated warnings, now with robust matching
        SBI.log(`main.js:89 File for sheet '${sheetName}' not found.`); 
        return;
    }

    SBI.log(`main.js:93 Reading file: ${file.name} for sheet '${sheetName}'`);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse the sheet data into JSON array of objects
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    
    // Map data to state based on sheetName
    switch (sheetName) {
        case 'УЧАЩИЕСЯ':
            SBI.state.students = json;
            break;
        case 'УЧИТЕЛЯ':
            SBI.state.teachers = json;
            break;
        case 'КЛАССЫ':
            SBI.state.classes = json;
            break;
        case 'ПРЕДМЕТЫ':
            SBI.state.subjects = json;
            break;
        case 'ЧЕТВЕРТИ':
            SBI.state.terms = json;
            break;
        case 'ШКАЛА_5Б':
            // Grading scale rules
            SBI.state.gradingScale = json.map(r => ({
                grade_5pt: Number(r.grade_5pt),
                pct_min: Number(r.pct_min),
                pct_max: Number(r.pct_max),
                description: r.description
            })).sort((a, b) => b.grade_5pt - a.grade_5pt); // Sort desc
            break;
        case 'ВЕСА_ОЦЕНОК':
            // Weights map: key is work_type, value is weight_pct/100
            SBI.state.weights = json.reduce((acc, row) => {
                if (row.work_type && row.weight_pct != null) {
                    acc[row.work_type.trim()] = Number(row.weight_pct) / 100;
                }
                return acc;
            }, {});
            break;
        case 'СОСТАВ_КЛАССА':
            SBI.state.enrollments = json;
            break;
        case 'НАЗНАЧЕНИЯ_ПРЕПОД':
            SBI.state.assignments = json;
            break;
        case 'ПОСЕЩАЕМОСТЬ':
            SBI.state.attendance = json;
            break;
        case 'ОЦЕНКИ':
            SBI.state.rawGrades = json;
            break;
        case 'СПРАВОЧНИКИ':
            // Dictionary data (Gender, Attendance Status, etc.)
            if (json.length > 0) {
                const keys = Object.keys(json[0]);
                keys.forEach(key => {
                    SBI.state.dictionaries[key] = json
                        .map(r => r[key])
                        .filter(v => v != null && v !== '');
                });
            }
            break;
        case 'TEACHER_QUALS':
            // Teacher qualifications (used in teacher dashboard)
            SBI.state.teacherQuals = json;
            break;
        default:
            SBI.log(`main.js: Not saving data for sheet: ${sheetName}`);
    }
}

/**
 * Loads all data from the uploaded files.
 */
SBI.loadData = async function (files) {
    if (!files || files.length === 0) {
        console.error("No files selected.");
        return;
    }
    
    // Updated list of expected sheets, including the new dictionary files
    const SHEETS = [
        'УЧАЩИЕСЯ', 'УЧИТЕЛЯ', 'КЛАССЫ', 'ПРЕДМЕТЫ', 'ЧЕТВЕРТИ', 
        'ШКАЛА_5Б', 'ВЕСА_ОЦЕНОК', 'СОСТАВ_КЛАССА', 
        'НАЗНАЧЕНИЯ_ПРЕПОД', 'ПОСЕЩАЕМОСТЬ', 'ОЦЕНКИ',
        'СПРАВОЧНИКИ', 'TEACHER_QUALS' // Added new lookup sheets
    ];

    SBI.log(`main.js:134 Starting data load for ${SHEETS.length} sheets...`);

    // Use Promise.all to load sheets concurrently for better performance
    const loadPromises = SHEETS.map(sheet => loadFile(sheet, files));
    await Promise.all(loadPromises);

    processAllData();
    
    // Notify all dashboard modules that data is ready
    if (window.SBI_Overview && window.SBI_Overview.onDataLoaded) {
        window.SBI_Overview.onDataLoaded();
    }
    if (window.SBI_Attendance && window.SBI_Attendance.onDataLoaded) {
        window.SBI_Attendance.onDataLoaded();
    }
    if (window.SBI_Class && window.SBI_Class.onDataLoaded) {
        window.SBI_Class.onDataLoaded();
    }
    if (window.SBI_Subject && window.SBI_Subject.onDataLoaded) {
        window.SBI_Subject.onDataLoaded();
    }
    if (window.SBI_Teacher && window.SBI_Teacher.onDataLoaded) {
        window.SBI_Teacher.onDataLoaded();
    }
    if (window.SBI_Students && window.SBI_Students.onDataLoaded) {
        window.SBI_Students.onDataLoaded();
    }
};

/**
 * Processes raw grades into final analytic rows (Student x Subject x Term).
 */
function processAllData() {
    // Check for essential data
    if (!SBI.state.rawGrades || SBI.state.rawGrades.length === 0) {
        // main.js:192 (The source of the "No grades to process." warning)
        SBI.log("main.js:192 No grades to process. (Skipping final row creation)");
        SBI.state.allRows = [];
        SBI.state.allTerms = [];
        return; // Gracefully exit if no grades
    }

    const { rawGrades, gradingScale, weights } = SBI.state;
    
    // 1. Group raw grades by Student, Subject, and Term (The key for a final mark)
    const gradeGroups = {}; // Key: student_id|subject_id|term_id
    rawGrades.forEach(r => {
        const key = `${r.student_id}|${r.subject_id}|${r.term_id}`;
        if (!gradeGroups[key]) {
            gradeGroups[key] = {
                sid: r.student_id,
                sub: r.subject_id,
                term: r.term_id,
                class_id: r.class_id, // Use class_id from grade row (approximate)
                grades: []
            };
        }
        gradeGroups[key].grades.push(r);
    });

    // 2. Calculate the final percent for each group
    const finalRows = [];
    
    Object.values(gradeGroups).forEach(group => {
        let totalWeightedScore = 0;
        let totalWeight = 0;
        
        // Group by Work Type (ФО, СОР, СОЧ)
        const gradesByType = group.grades.reduce((acc, r) => {
            const type = r.work_type ? r.work_type.trim() : 'OTHER';
            if (!acc[type]) acc[type] = [];
            acc[type].push(r);
            return acc;
        }, {});
        
        // Calculate average percentage score for each work type
        let avgFO = null, avgSOR = null, avgSOCH = null;
        
        Object.entries(gradesByType).forEach(([workType, grades]) => {
            const weight = weights[workType] || 0; // Get weight from 'ВЕСА_ОЦЕНОК'
            
            // Calculate the average percentage for this work type
            const sumPercent = grades.reduce((sum, g) => sum + (parsePercent(g.percent || (g.score/g.max_score)*100) || 0), 0);
            const avgPercent = grades.length > 0 ? sumPercent / grades.length : 0;
            
            // Assign to specific average vars for detail in finalRows
            if (workType === 'ФО') avgFO = avgPercent.toFixed(1);
            else if (workType === 'СОР') avgSOR = avgPercent.toFixed(1);
            else if (workType === 'СОЧ') avgSOCH = avgPercent.toFixed(1);

            // Apply weighting only if weight is defined
            if (weight > 0 && avgPercent > 0) {
                totalWeightedScore += avgPercent * weight;
                totalWeight += weight;
            }
        });
        
        // The final percentage is the sum of weighted scores divided by the sum of weights
        const totalPct = totalWeight > 0 ? (totalWeightedScore / totalWeight).toFixed(2) : null;
        const grade5 = totalPct != null ? convertTo5Scale(Number(totalPct), gradingScale) : null;

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

    SBI.state.allRows = finalRows;
    SBI.state.allTerms = SBI.unique(finalRows.map(r => r.term));
    
    console.log(`Data Processed: ${finalRows.length} analytic rows created.`);
}

// Add file listener
document.addEventListener('DOMContentLoaded', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'fileLoader';
    input.addEventListener('change', (e) => SBI.loadData(e.target.files));
    document.body.appendChild(input);

    // Temporary Trigger for UI (Auto-click if needed, or add button in header)
    const header = document.querySelector('header div:last-child');
    const btn = document.createElement('button');
    btn.innerText = '📂 Загрузить Excel';
    btn.style.background = 'rgba(255,255,255,0.2)';
    btn.style.border = '1px solid rgba(255,255,255,0.4)';
    btn.style.color = '#fff';
    btn.style.padding = '5px 10px';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background 0.3s';
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.3)';
    btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.2)';

    btn.addEventListener('click', () => {
        document.getElementById('fileLoader').click();
    });

    if (header) {
        header.appendChild(btn);
    }
});
