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
    // Default rules if CSV missing
    if (!scaleRules || scaleRules.length === 0) {
        if (score >= 85) return 5;
        if (score >= 70) return 4;
        if (score >= 55) return 3;
        if (score >= 0) return 2;
        return 0;
    }

    // Find matching rule
    // Assuming rules have min_pct and max_pct
    for (let rule of scaleRules) {
        if (score >= rule.min && score <= rule.max) {
            return rule.grade;
        }
    }
    return 2; // Default fallback
}

// ==========================================
// 3. LOAD & PROCESS EXCEL FILES
// ==========================================

SBI.loadData = async function(files) {
    SBI.setStatus("Чтение файлов...");
    const state = SBI.state;
    
    // Temporary raw storage
    let rawGrades = [];
    let rawWeights = [];
    let rawScale = [];

    for (let file of files) {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            
            // Helper to get sheet data
            const getSheet = (name) => {
                const sn = workbook.SheetNames.find(n => n.toUpperCase().includes(name.toUpperCase()));
                if (!sn) return [];
                return XLSX.utils.sheet_to_json(workbook.Sheets[sn]);
            };

            // Accumulate Data
            state.students = state.students.concat(getSheet("УЧАЩИЕСЯ"));
            state.teachers = state.teachers.concat(getSheet("УЧИТЕЛЯ"));
            state.classes = state.classes.concat(getSheet("КЛАССЫ"));
            state.subjects = state.subjects.concat(getSheet("ПРЕДМЕТЫ"));
            state.terms = state.terms.concat(getSheet("ЧЕТВЕРТИ"));
            
            rawGrades = rawGrades.concat(getSheet("ОЦЕНКИ"));
            rawWeights = rawWeights.concat(getSheet("ВЕСА")); // ВЕСА_ОЦЕНОК
            rawScale = rawScale.concat(getSheet("ШКАЛА")); // ШКАЛА_5Б

            // Attendance handled separately usually, but let's ensure we have it
            state.attendanceRows = (state.attendanceRows || []).concat(getSheet("ПОСЕЩАЕМОСТЬ"));

        } catch (e) {
            console.error("Error reading file:", file.name, e);
        }
    }

    SBI.setStatus("Обработка оценок...");
    processAnalytics(rawGrades, rawWeights, rawScale);
    
    SBI.setStatus("Готово.");
    
    // Notify Dashboards
    if (window.SBI_Overview && window.SBI_Overview.update) window.SBI_Overview.update();
    if (window.SBI_Class && window.SBI_Class.onDataLoaded) window.SBI_Class.onDataLoaded();
    if (window.SBI_Attendance && window.SBI_Attendance.onDataLoaded) window.SBI_Attendance.onDataLoaded();
};

function processAnalytics(grades, weightsRaw, scaleRaw) {
    // 1. Parse Scale
    const scaleRules = scaleRaw.map(r => ({
        grade: parseInt(r.grade_5pt),
        min: parseFloat(r.pct_min),
        max: parseFloat(r.pct_max)
    })).sort((a,b) => b.min - a.min); // Sort desc (5, 4, 3...)

    // 2. Parse Weights into a Map: Term -> Subject -> WorkType -> Weight
    // Map structure: weights[termId || 'default'][subjectId || 'default'][workType] = 0.25
    const weightMap = {};
    weightsRaw.forEach(w => {
        const t = w.term_id || 'default';
        const s = w.subject_id || 'default';
        const type = (w.work_type || "").toUpperCase().trim();
        const val = parseFloat(w.weight_pct) / 100.0;

        if (!weightMap[t]) weightMap[t] = {};
        if (!weightMap[t][s]) weightMap[t][s] = {};
        weightMap[t][s][type] = val;
    });

    // Helper to get weight
    const getWeight = (term, subj, type) => {
        type = type.toUpperCase();
        // Try specific Term+Subj
        if (weightMap[term] && weightMap[term][subj] && weightMap[term][subj][type]) return weightMap[term][subj][type];
        // Try specific Term, default Subj
        if (weightMap[term] && weightMap[term]['default'] && weightMap[term]['default'][type]) return weightMap[term]['default'][type];
        // Try default Term, default Subj (Global defaults)
        if (weightMap['default'] && weightMap['default']['default'] && weightMap['default']['default'][type]) return weightMap['default']['default'][type];
        
        // Fallbacks if CSV missing
        if (type === 'СОЧ') return 0.5;
        if (type === 'СОР') return 0.25;
        if (type === 'ФО') return 0.25;
        return 0; 
    };

    // 3. Aggregate Grades by Student-Subject-Term
    const grouped = {}; // Key: "student|subject|term"
    
    grades.forEach(row => {
        const sid = row.student_id;
        const sub = row.subject_id;
        const term = row.term_id;
        if(!sid || !sub || !term) return;

        const key = `${sid}|${sub}|${term}`;
        if (!grouped[key]) {
            grouped[key] = {
                sid, sub, term, class_id: row.class_id,
                scores: { 'ФО': [], 'СОР': [], 'СОЧ': [] }
            };
        }

        const type = (row.work_type || "ФО").toUpperCase().trim();
        
        // Calculate percentage for this specific assessment
        let pct = null;
        if (row.percent != null) pct = parsePercent(row.percent);
        else if (row.score != null && row.max_score != null) {
            pct = (parseFloat(row.score) / parseFloat(row.max_score)) * 100;
        }

        if (pct != null) {
            if (grouped[key].scores[type]) {
                grouped[key].scores[type].push(pct);
            } else {
                 // Handle unexpected types
                 grouped[key].scores['ФО'].push(pct);
            }
        }
    });

    // 4. Calculate Final Grades
    const finalRows = [];
    
    Object.values(grouped).forEach(group => {
        // Average per category
        const avgFO = SBI.mean(group.scores['ФО']);
        const avgSOR = SBI.mean(group.scores['СОР']);
        const avgSOCH = SBI.mean(group.scores['СОЧ']);

        // Get Weights
        const wFO = getWeight(group.term, group.sub, 'ФО');
        const wSOR = getWeight(group.term, group.sub, 'СОР');
        const wSOCH = getWeight(group.term, group.sub, 'СОЧ');

        // Total Grade Calculation
        // Logic: If a category is missing (e.g. student missed SOCH), what do we do?
        // Usually strictly 0. But for BI, if score is null, treat as 0.
        
        const valFO = (avgFO || 0) * wFO;
        const valSOR = (avgSOR || 0) * wSOR;
        const valSOCH = (avgSOCH || 0) * wSOCH;

        const totalPct = valFO + valSOR + valSOCH;
        
        // Convert to 5 scale
        const grade5 = convertTo5Scale(totalPct, scaleRules);

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
    btn.onclick = () => input.click();
    header.prepend(btn);
});

// Helper for status
SBI.setStatus = (msg) => {
    const el = document.getElementById('statusBar');
    if(el) el.innerText = msg;
    console.log(`[STATUS] ${msg}`);
};
