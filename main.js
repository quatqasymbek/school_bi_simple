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
    classes: [], // THIS MUST BE POPULATED for Classes tab to work
    subjects: [],
    terms: [],
    attendanceRows: [],
    weights: {}, 
    gradingScale: [] 
};

// ==========================================
// 2. DATA PROCESSING HELPERS
// ==========================================

function parsePercent(val) {
    if (val == null || val === "") return null;
    let s = String(val).replace(",", ".").replace("%", "").trim();
    let n = parseFloat(s);
    if (isNaN(n)) return null;
    if (n <= 1.0 && n > 0) return n * 100; 
    return n;
}

function convertTo5Scale(score, scaleRules) {
    if (score == null) return null;
    if (!scaleRules || scaleRules.length === 0) {
        if (score >= 85) return 5;
        if (score >= 70) return 4;
        if (score >= 55) return 3;
        if (score >= 0) return 2;
        return 0;
    }
    for (let rule of scaleRules) {
        if (score >= rule.min && score <= rule.max) {
            return rule.grade;
        }
    }
    return 2; 
}

// ==========================================
// 3. LOAD & PROCESS EXCEL FILES
// ==========================================

SBI.loadData = async function(files) {
    SBI.setStatus("Чтение файлов...");
    const state = SBI.state;
    
    // Reset state to avoid duplicates on re-upload
    state.allRows = [];
    state.students = [];
    state.teachers = [];
    state.classes = [];
    state.subjects = [];
    state.terms = [];
    state.attendanceRows = [];

    let rawGrades = [];
    let rawWeights = [];
    let rawScale = [];

    for (let file of files) {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            
            const getSheet = (name) => {
                const sn = workbook.SheetNames.find(n => n.toUpperCase().includes(name.toUpperCase()));
                if (!sn) return [];
                return XLSX.utils.sheet_to_json(workbook.Sheets[sn]);
            };

            // Accumulate Data
            state.students = state.students.concat(getSheet("УЧАЩИЕСЯ"));
            state.teachers = state.teachers.concat(getSheet("УЧИТЕЛЯ"));
            state.classes = state.classes.concat(getSheet("КЛАССЫ")); // Critical for Classes Page
            state.subjects = state.subjects.concat(getSheet("ПРЕДМЕТЫ"));
            state.terms = state.terms.concat(getSheet("ЧЕТВЕРТИ"));
            
            rawGrades = rawGrades.concat(getSheet("ОЦЕНКИ"));
            rawWeights = rawWeights.concat(getSheet("ВЕСА")); 
            rawScale = rawScale.concat(getSheet("ШКАЛА")); 
            state.attendanceRows = state.attendanceRows.concat(getSheet("ПОСЕЩАЕМОСТЬ"));

        } catch (e) {
            console.error("Error reading file:", file.name, e);
        }
    }

    SBI.setStatus("Обработка оценок...");
    processAnalytics(rawGrades, rawWeights, rawScale);
    
    SBI.setStatus("Готово. Обновление дашбордов...");
    
    // Notify Dashboards
    if (window.SBI_Overview && window.SBI_Overview.update) window.SBI_Overview.update();
    if (window.SBI_Class && window.SBI_Class.onDataLoaded) window.SBI_Class.onDataLoaded();
    if (window.SBI_Attendance && window.SBI_Attendance.onDataLoaded) window.SBI_Attendance.onDataLoaded();
    if (window.SBI_Subject && window.SBI_Subject.onDataLoaded) window.SBI_Subject.onDataLoaded();
};

function processAnalytics(grades, weightsRaw, scaleRaw) {
    const scaleRules = scaleRaw.map(r => ({
        grade: parseInt(r.grade_5pt),
        min: parseFloat(r.pct_min),
        max: parseFloat(r.pct_max)
    })).sort((a,b) => b.min - a.min); 

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

    const getWeight = (term, subj, type) => {
        type = type.toUpperCase();
        if (weightMap[term] && weightMap[term][subj] && weightMap[term][subj][type]) return weightMap[term][subj][type];
        if (weightMap[term] && weightMap[term]['default'] && weightMap[term]['default'][type]) return weightMap[term]['default'][type];
        if (weightMap['default'] && weightMap['default']['default'] && weightMap['default']['default'][type]) return weightMap['default']['default'][type];
        
        if (type === 'СОЧ') return 0.5;
        if (type === 'СОР') return 0.25;
        if (type === 'ФО') return 0.25;
        return 0; 
    };

    const grouped = {}; 
    
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
        
        let pct = null;
        if (row.percent != null) pct = parsePercent(row.percent);
        else if (row.score != null && row.max_score != null) {
            pct = (parseFloat(row.score) / parseFloat(row.max_score)) * 100;
        }

        if (pct != null) {
            if (grouped[key].scores[type]) {
                grouped[key].scores[type].push(pct);
            } else {
                 grouped[key].scores['ФО'].push(pct);
            }
        }
    });

    const finalRows = [];
    
    Object.values(grouped).forEach(group => {
        const avgFO = SBI.mean(group.scores['ФО']);
        const avgSOR = SBI.mean(group.scores['СОР']);
        const avgSOCH = SBI.mean(group.scores['СОЧ']);

        const wFO = getWeight(group.term, group.sub, 'ФО');
        const wSOR = getWeight(group.term, group.sub, 'СОР');
        const wSOCH = getWeight(group.term, group.sub, 'СОЧ');

        const valFO = (avgFO || 0) * wFO;
        const valSOR = (avgSOR || 0) * wSOR;
        const valSOCH = (avgSOCH || 0) * wSOCH;

        const totalPct = valFO + valSOR + valSOCH;
        const grade5 = convertTo5Scale(totalPct, scaleRules);

        finalRows.push({
            student_id: group.sid,
            subject_id: group.sub,
            term: group.term, 
            class_id: group.class_id,
            final_percent: totalPct,
            final_5scale: grade5
        });
    });

    SBI.state.allRows = finalRows;
    SBI.state.allTerms = SBI.unique(finalRows.map(r => r.term));
    
    console.log(`Data Processed: ${finalRows.length} rows, ${SBI.state.classes.length} classes.`);
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'fileLoader';
    input.addEventListener('change', (e) => SBI.loadData(e.target.files));
    document.body.appendChild(input);

    const header = document.querySelector('header div:last-child');
    // Remove old button if exists to prevent duplicates
    const oldBtn = document.getElementById('uploadBtn');
    if(oldBtn) oldBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'uploadBtn';
    btn.innerText = '📂 Загрузить Excel';
    btn.style.background = 'rgba(255,255,255,0.2)';
    btn.style.border = '1px solid rgba(255,255,255,0.4)';
    btn.onclick = () => input.click();
    if(header) header.prepend(btn);
});

SBI.setStatus = (msg) => {
    const el = document.getElementById('statusBar');
    if(el) el.innerText = msg;
    console.log(`[STATUS] ${msg}`);
};
