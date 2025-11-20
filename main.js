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
    gradingScale: [] // 5-point scale rules
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
    if (score == null || score === "" || !scaleRules || scaleRules.length === 0) return null;
    const rule = scaleRules.find(r => score >= r.pct_min && score <= r.pct_max);
    return rule ? parseInt(rule.grade_5pt) : null;
}

// Helper for calculating mean, ignoring nulls/NaNs
SBI.mean = function (arr) {
    if (!arr || arr.length === 0) return null;
    const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
    if (valid.length === 0) return null;
    const sum = valid.reduce((a, b) => a + b, 0);
    return sum / valid.length;
};

// Helper for calculating unique values
SBI.unique = function (arr) {
    return Array.from(new Set(arr));
}

SBI.log = console.log;

// ==========================================
// 3. DATA LOADING
// ==========================================

// Main function to load and parse files
SBI.loadData = async function (files) {
    SBI.state.isProcessing = true;
    console.log(`Starting data load for ${files.length} files...`);

    const fileMap = {};
    for (const file of files) {
        // Filenames are typically "example_excel.xlsx - SHEET_NAME.csv"
        // We only care about the SHEET_NAME part.
        let sheetName = file.name.split('-').pop().trim().replace(/\.csv$/i, '').toUpperCase();
        
        // Handle names that don't follow the convention perfectly, e.g., 'УЧАЩИЕСЯ.csv'
        if (sheetName.includes('УЧАЩИЕСЯ') && !sheetName.includes('УЧИТЕЛЯ')) sheetName = 'УЧАЩИЕСЯ';
        else if (sheetName.includes('ОЦЕНКИ')) sheetName = 'ОЦЕНКИ';
        else if (sheetName.includes('КЛАССЫ')) sheetName = 'КЛАССЫ';
        // Add other simple mapping rules if needed

        fileMap[sheetName] = file;
    }

    // 1. Load data from files
    const loadFile = (key, sheetName) => {
        const file = fileMap[key];
        if (!file) {
            console.warn(`File for sheet '${sheetName}' not found.`);
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const csv = e.target.result;
                const workbook = XLSX.read(csv, { type: 'string', raw: true });
                // Assuming it's a single sheet inside the CSV
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                // Assuming first row is header
                if (data.length > 0) {
                    const headers = data[0].map(h => String(h).trim().toLowerCase());
                    const rows = data.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((h, i) => {
                            obj[h] = row[i];
                        });
                        return obj;
                    });
                    console.log(`Loaded ${rows.length} rows for sheet: ${sheetName}`);
                    resolve(rows);
                } else {
                    resolve([]);
                }
            };
            reader.readAsText(file, 'UTF-8');
        });
    };

    const [
        students,
        teachers,
        classes,
        subjects,
        terms,
        gradingScale,
        weightsRaw,
        enrollments,
        assignments,
        attendance,
        grades
    ] = await Promise.all([
        loadFile('УЧАЩИЕСЯ', 'УЧАЩИЕСЯ'),
        loadFile('УЧИТЕЛЯ', 'УЧИТЕЛЯ'),
        loadFile('КЛАССЫ', 'КЛАССЫ'),
        loadFile('ПРЕДМЕТЫ', 'ПРЕДМЕТЫ'),
        loadFile('ЧЕТВЕРТИ', 'ЧЕТВЕРТИ'),
        loadFile('ШКАЛА_5Б', 'ШКАЛА_5Б'),
        loadFile('ВЕСА_ОЦЕНОК', 'ВЕСА_ОЦЕНОК'),
        loadFile('СОСТАВ_КЛАССА', 'СОСТАВ_КЛАССА'),
        loadFile('НАЗНАЧЕНИЯ_ПРЕПОД', 'НАЗНАЧЕНИЯ_ПРЕПОД'),
        loadFile('ПОСЕЩАЕМОСТЬ', 'ПОСЕЩАЕМОСТЬ'),
        loadFile('ОЦЕНКИ', 'ОЦЕНКИ')
    ]);

    // 2. Map data to state
    SBI.state.students = students;
    SBI.state.teachers = teachers;
    SBI.state.classes = classes;
    SBI.state.subjects = subjects;
    SBI.state.terms = terms;

    // Convert grading scale to numbers
    SBI.state.gradingScale = gradingScale.map(r => ({
        grade_5pt: parseInt(r.grade_5pt),
        pct_min: parseInt(r.pct_min),
        pct_max: parseInt(r.pct_max)
    }));

    // Convert weights to an easy lookup map
    SBI.state.weights = weightsRaw.reduce((map, row) => {
        map[String(row.work_type).toUpperCase().trim()] = parseInt(row.weight_pct) / 100;
        return map;
    }, {});
    
    // Store raw data for later processing/lookups
    SBI.state.raw = { enrollments, assignments, attendance, grades };
    
    // 3. Process grades into analytic rows
    processGrades(grades);

    // 4. Trigger dashboards to update
    // Call onDataLoaded on all registered modules
    if (window.SBI_Overview && window.SBI_Overview.onDataLoaded) window.SBI_Overview.onDataLoaded();
    if (window.SBI_Attendance && window.SBI_Attendance.onDataLoaded) window.SBI_Attendance.onDataLoaded();
    if (window.SBI_Class && window.SBI_Class.onDataLoaded) window.SBI_Class.onDataLoaded();
    if (window.SBI_Subject && window.SBI_Subject.onDataLoaded) window.SBI_Subject.onDataLoaded();
    if (window.SBI_Teacher && window.SBI_Teacher.onDataLoaded) window.SBI_Teacher.onDataLoaded();
    if (window.SBI_Students && window.SBI_Students.onDataLoaded) window.SBI_Students.onDataLoaded();

    SBI.state.isProcessing = false;
    console.log("All data loaded and dashboards updated.");
};

// ==========================================
// 4. ANALYTIC ROW CREATION
// ==========================================

function processGrades(grades) {
    if (!grades || grades.length === 0) {
        console.log("No grades to process.");
        SBI.state.allRows = [];
        return;
    }

    const weights = SBI.state.weights;
    const scale = SBI.state.gradingScale;

    // 1. Group grades by (Student x Subject x Term)
    const gradeGroups = {};
    grades.forEach(g => {
        const key = `${g.student_id}|${g.subject_id}|${g.term_id}`;
        if (!gradeGroups[key]) {
            gradeGroups[key] = {
                sid: g.student_id,
                sub: g.subject_id,
                term: g.term_id,
                class_id: g.class_id,
                fo_scores: [],
                sor_scores: [],
                soch_scores: []
            };
        }
        
        const type = String(g.work_type).toUpperCase().trim();
        const percent = parsePercent(g.percent || (Number(g.score) / Number(g.max_score)));
        
        if (percent == null) return;

        if (type === 'ФО') gradeGroups[key].fo_scores.push(percent);
        else if (type === 'СОР') gradeGroups[key].sor_scores.push(percent);
        else if (type === 'СОЧ') gradeGroups[key].soch_scores.push(percent);
        // Note: The input data uses 'percent', so we rely on that. If not present, we use score/max_score.
    });

    // 2. Calculate final weighted score for each group
    const finalRows = [];
    Object.values(gradeGroups).forEach(group => {
        const avgFO = SBI.mean(group.fo_scores);
        const avgSOR = SBI.mean(group.sor_scores);
        const avgSOCH = SBI.mean(group.soch_scores);

        let totalPct = 0;
        let totalWeight = 0;

        if (avgFO != null && weights['ФО']) {
            totalPct += avgFO * weights['ФО'];
            totalWeight += weights['ФО'];
        }
        if (avgSOR != null && weights['СОР']) {
            totalPct += avgSOR * weights['СОР'];
            totalWeight += weights['СОР'];
        }
        if (avgSOCH != null && weights['СОЧ']) {
            totalPct += avgSOCH * weights['СОЧ'];
            totalWeight += weights['СОЧ'];
        }
        
        if (totalWeight === 0) return; // Skip if no weighted scores found

        // Normalize if total weight is not 100% (shouldn't happen with given data, but for safety)
        if (totalWeight < 1) {
             totalPct = (totalPct / totalWeight);
        }

        const grade5 = convertTo5Scale(totalPct, scale);

        // Create the final analytic row
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

    // Add Upload Button to the header controls
    const headerControls = document.getElementById('header-controls');
    const btn = document.createElement('button');
    btn.innerText = '📂 Загрузить Excel';
    btn.style.background = 'rgba(255,255,255,0.2)';
    btn.style.border = '1px solid rgba(255,255,255,0.4)';
    btn.style.color = 'white';
    btn.style.padding = '8px 15px';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background 0.3s';
    btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.3)';
    btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.2)';
    btn.onclick = () => document.getElementById('fileLoader').click();

    if (headerControls) {
        headerControls.appendChild(btn);
    } else {
        console.warn("Could not find '#header-controls' to attach the upload button. Please check index.html structure.");
    }
});
