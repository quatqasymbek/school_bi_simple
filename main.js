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
    if (score == null) return null;
    // Find the matching rule: pct_min <= score <= pct_max
    const rule = scaleRules.find(r => score >= r.pct_min && score <= r.pct_max);
    return rule ? rule.grade_5pt : null;
}

// A simple utility to calculate the mean of an array of numbers
SBI.mean = function(arr) {
    if (!arr || arr.length === 0) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    return sum / arr.length;
};

// Simple utility to get unique values from an array
SBI.unique = function(arr) {
    return Array.from(new Set(arr));
};

// Central Log Function
SBI.log = function() {
    console.log.apply(console, arguments);
};

// ==========================================
// 3. XLSX/FILE LOADING
// ==========================================

SBI.loadData = function(files) {
    // Clear previous data
    SBI.state.allRows = [];
    SBI.state.students = [];
    SBI.state.teachers = [];
    SBI.state.classes = [];
    SBI.state.subjects = [];
    SBI.state.terms = [];
    SBI.state.weights = {};
    SBI.state.gradingScale = [];

    let allLoadedSheets = {};
    let filesToProcess = Array.from(files).filter(f => f.name.endsWith('.xlsx'));

    if (filesToProcess.length === 0) {
        console.warn("No .xlsx files selected.");
        return;
    }

    const loadPromises = filesToProcess.map(file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    workbook.SheetNames.forEach(sheetName => {
                        const ws = workbook.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(ws);
                        allLoadedSheets[sheetName] = json;
                    });
                    resolve();
                } catch (error) {
                    console.error("Error reading workbook:", error);
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    });

    Promise.all(loadPromises)
        .then(() => {
            console.log("All sheets loaded:", Object.keys(allLoadedSheets));
            processRawData(allLoadedSheets);
            calculateFinalGrades();
            
            // Notify all dashboards that data is ready
            if (window.SBI_Overview && window.SBI_Overview.onDataLoaded) SBI_Overview.onDataLoaded();
            if (window.SBI_Teacher && window.SBI_Teacher.onDataLoaded) SBI_Teacher.onDataLoaded();
            if (window.SBI_Subject && window.SBI_Subject.onDataLoaded) SBI_Subject.onDataLoaded();
            if (window.SBI_Students && window.SBI_Students.onDataLoaded) SBI_Students.onDataLoaded();
            if (window.SBI_Attendance && window.SBI_Attendance.onDataLoaded) SBI_Attendance.onDataLoaded();

            // Switch to the Overview tab
            document.querySelector('.tab-link[data-page="page-overview"]').click();

        })
        .catch(error => {
            console.error("Failed to load or process files:", error);
            document.getElementById('overview-summary').textContent = `Ошибка загрузки данных: ${error.message}`;
        });
};


// ==========================================
// 4. RAW DATA MAPPING
// ==========================================

function processRawData(sheets) {
    console.log("Processing raw data...");

    // Map: Grading Scale (ШКАЛА_5Б)
    const scale = sheets['ШКАЛА_5Б'] || [];
    SBI.state.gradingScale = scale.map(r => ({
        grade_5pt: Number(r.grade_5pt),
        pct_min: Number(r.pct_min),
        pct_max: Number(r.pct_max)
    })).filter(r => !isNaN(r.grade_5pt));
    console.log(`Grading Scale loaded: ${SBI.state.gradingScale.length} rules.`);

    // Map: Weights (ВЕСА_ОЦЕНОК)
    const weights = sheets['ВЕСА_ОЦЕНОК'] || [];
    SBI.state.weights = weights.reduce((acc, row) => {
        if (row.work_type && row.weight_pct != null) {
            acc[row.work_type] = Number(row.weight_pct) / 100;
        }
        return acc;
    }, {});
    console.log("Weights loaded:", SBI.state.weights);

    // Map: Core Data (УЧАЩИЕСЯ, УЧИТЕЛЯ, КЛАССЫ, ПРЕДМЕТЫ, ЧЕТВЕРТИ)
    SBI.state.students = sheets['УЧАЩИЕСЯ'] || [];
    SBI.state.teachers = sheets['УЧИТЕЛЯ'] || [];
    SBI.state.classes  = sheets['КЛАССЫ'] || [];
    SBI.state.subjects = sheets['ПРЕДМЕТЫ'] || [];
    SBI.state.terms    = (sheets['ЧЕТВЕРТИ'] || []).map(r => r.term_id); // Only term IDs needed
    
    // Map: Raw Grades (ОЦЕНКИ)
    SBI.state.rawGrades = (sheets['ОЦЕНКИ'] || []).map(r => ({
        ...r,
        score: parsePercent(r.score), // Standardize to 0-100 scale
        max_score: Number(r.max_score) || 100,
        percent: parsePercent(r.percent) || (r.score != null ? Number(r.score) / (Number(r.max_score) || 100) * 100 : null),
        grade_5pt: Number(r.grade_5pt), // Keep existing 5-scale grade if present
        knowledge_quality: Number(r.knowledge_quality) // Keep existing knowledge quality
    })).filter(r => r.student_id && r.term_id && r.subject_id && r.work_type);

    // Map: Raw Attendance (ПОСЕЩАЕМОСТЬ)
    SBI.state.rawAttendance = (sheets['ПОСЕЩАЕМОСТЬ'] || []).map(r => ({
        ...r,
        total_classes: Number(r.total_classes) || 0,
        present_classes: Number(r.present_classes) || 0,
        absent_excused_classes: Number(r.absent_excused_classes) || 0,
        absent_unexcused_classes: Number(r.absent_unexcused_classes) || 0,
        late_classes: Number(r.late_classes) || 0,
    })).filter(r => r.student_id && r.term_id && r.subject_id);
    
    console.log(`Raw Data: ${SBI.state.rawGrades.length} grades, ${SBI.state.rawAttendance.length} attendance rows.`);
}

// ==========================================
// 5. ANALYTIC ROW CALCULATION
// ==========================================

function calculateFinalGrades() {
    const grades = SBI.state.rawGrades;
    const scale = SBI.state.gradingScale;
    const weights = SBI.state.weights;

    // Group grades by (Student x Subject x Term)
    const groupedGrades = grades.reduce((acc, row) => {
        const key = `${row.student_id}|${row.subject_id}|${row.term_id}`;
        if (!acc[key]) {
            acc[key] = {
                sid: row.student_id,
                sub: row.subject_id,
                term: row.term_id,
                class_id: row.class_id,
                grades: []
            };
        }
        acc[key].grades.push(row);
        return acc;
    }, {});

    const finalRows = [];

    // Calculate weighted final percentage for each group
    Object.values(groupedGrades).forEach(group => {
        let totalWeightedScore = 0;
        let totalWeight = 0;
        let foScores = [], sorScores = [], sochScores = [];

        group.grades.forEach(g => {
            const weight = weights[g.work_type] || 0;
            if (weight > 0 && g.percent != null) {
                totalWeightedScore += g.percent * weight;
                totalWeight += weight;
            }
            
            // Collect scores for intermediate averages (used in LLM context)
            if (g.percent != null) {
                if (g.work_type === 'ФО') foScores.push(g.percent);
                if (g.work_type === 'СОР') sorScores.push(g.percent);
                if (g.work_type === 'СОЧ') sochScores.push(g.percent);
            }
        });

        // Final weighted percentage
        const totalPct = totalWeight > 0 ? (totalWeightedScore / totalWeight) : null;
        
        // Final 5-point grade
        const grade5 = totalPct != null ? convertTo5Scale(totalPct, scale) : null;

        // Intermediate Averages
        const avgFO = SBI.mean(foScores);
        const avgSOR = SBI.mean(sorScores);
        const avgSOCH = SBI.mean(sochScores);

        // Push the final analytic row
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
    SBI.state.allSubjects = SBI.unique(finalRows.map(r => r.subject_id));
    
    console.log(`Data Processed: ${finalRows.length} analytic rows created.`);
}

// Add file listener
document.addEventListener('DOMContentLoaded', () => {
    // 1. Create the hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'fileLoader';
    input.addEventListener('change', (e) => SBI.loadData(e.target.files));
    document.body.appendChild(input);

    // 2. Add 'Upload Excel' button to the header controls area
    // This now targets the ID 'header-controls' which we added to index.html
    const controls = document.getElementById('header-controls');
    const btn = document.createElement('button');
    btn.innerText = '📂 Загрузить Excel';
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '6px';
    btn.style.background = 'rgba(255,255,255,0.2)';
    btn.style.color = '#fff';
    btn.style.border = '1px solid rgba(255,255,255,0.4)';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background 0.2s';
    
    // 3. Link the button click to the hidden file input
    btn.addEventListener('click', () => {
        document.getElementById('fileLoader').click();
    });
    
    if (controls) {
        controls.appendChild(btn);
    } else {
        // This should no longer happen after updating index.html
        console.warn("Could not find '#header-controls' to attach the upload button. Please check index.html structure.");
    }
});
