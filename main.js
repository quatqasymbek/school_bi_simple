// main.js - The Brain
console.log("MAIN.JS: Loaded.");

window.SBI = window.SBI || {};
const SBI = window.SBI;

// 1. CENTRAL STATE
SBI.state = {
    isLoaded: false,
    students: [],
    teachers: [],
    classes: [],
    subjects: [],
    terms: [],
    gradesRaw: [],
    attendanceRaw: [],
    enrollments: [],
    assignments: [],
    weights: {},
    scale: [],
    // Processed Data
    processedGrades: [],
    studentStatuses: {} 
};

// 2. HELPERS
SBI.mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
SBI.uniq = arr => [...new Set(arr)];

// 3. FILE LOADING (ROBUST VERSION)
SBI.loadData = async function(fileList) {
    console.log(`Loading ${fileList.length} files...`);
    
    // Reset State
    SBI.state.gradesRaw = [];
    SBI.state.processedGrades = [];
    
    // Map simple keys to their data destination in state
    const fileMap = [
        { key: 'УЧАЩИЕСЯ', dest: 'students' },
        { key: 'УЧИТЕЛЯ', dest: 'teachers' },
        { key: 'КЛАССЫ', dest: 'classes' },
        { key: 'ПРЕДМЕТЫ', dest: 'subjects' },
        { key: 'ЧЕТВЕРТИ', dest: 'terms' },
        { key: 'ОЦЕНКИ', dest: 'gradesRaw' },
        { key: 'ПОСЕЩАЕМОСТЬ', dest: 'attendanceRaw' },
        { key: 'СОСТАВ_КЛАССА', dest: 'enrollments' },
        { key: 'НАЗНАЧЕНИЯ_ПРЕПОД', dest: 'assignments' },
        { key: 'ШКАЛА_5Б', dest: 'scale' },
        { key: 'ВЕСА_ОЦЕНОК', dest: 'weights' },
        { key: 'TEACHER_QUALS', dest: 'teacherQuals' }
    ];

    const files = Array.from(fileList);

    for (let mapItem of fileMap) {
        // Find file that CONTAINS the key (case insensitive)
        // e.g. "example_excel.xlsx - ОЦЕНКИ.csv" contains "ОЦЕНКИ"
        const file = files.find(f => f.name.toUpperCase().includes(mapItem.key));
        
        if (file) {
            console.log(`Found file for ${mapItem.key}: ${file.name}`);
            const data = await readFile(file);
            
            if (mapItem.dest === 'weights') {
                // Special parsing for weights
                SBI.state.weights = data.reduce((acc, r) => {
                    if (r.work_type) acc[r.work_type.trim()] = (parseFloat(r.weight_pct)||0)/100;
                    return acc;
                }, {});
            } else {
                SBI.state[mapItem.dest] = data;
            }
        } else {
            console.warn(`Missing file for: ${mapItem.key}`);
        }
    }

    processData();
};

function readFile(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const wb = XLSX.read(e.target.result, {type: 'array'});
            const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            resolve(json);
        };
        reader.readAsArrayBuffer(file);
    });
}

// 4. DATA PROCESSING
function processData() {
    console.log("Processing Data...");
    const { gradesRaw, weights, scale } = SBI.state;
    
    if (!gradesRaw || gradesRaw.length === 0) {
        console.error("No grades found! Cannot process.");
        alert("Ошибка: Файл ОЦЕНКИ не найден или пуст.");
        return;
    }

    // Group by Student-Subject-Term
    const groups = {};
    gradesRaw.forEach(r => {
        if (!r.student_id || !r.subject_id || !r.term_id) return;
        const key = `${r.student_id}|${r.subject_id}|${r.term_id}`;
        if (!groups[key]) groups[key] = { 
            sid: r.student_id, sub: r.subject_id, term: r.term_id, 
            class_id: r.class_id, // Try to keep class context
            fo: [], sor: [], soch: [] 
        };
        
        // Normalize score to 0-1 range (e.g. 85% -> 0.85)
        let val = parseFloat(r.percent); // 0.85
        if (isNaN(val) && r.score && r.max_score) val = r.score / r.max_score;
        if (val > 1) val = val / 100; // Fix if 85 instead of 0.85

        const type = (r.work_type||'').toUpperCase();
        if (type.includes('ФО')) groups[key].fo.push(val);
        else if (type.includes('СОР')) groups[key].sor.push(val);
        else if (type.includes('СОЧ')) groups[key].soch.push(val);
    });

    const processed = [];

    Object.values(groups).forEach(g => {
        const avgFO = SBI.mean(g.fo);
        const avgSOR = SBI.mean(g.sor);
        const avgSOCH = SBI.mean(g.soch);

        // Formula: 25% FO + 25% SOR + 50% SOCH
        const wFO = weights['ФО'] || 0.25;
        const wSOR = weights['СОР'] || 0.25;
        const wSOCH = weights['СОЧ'] || 0.50;

        let total = 0;
        let wTotal = 0;

        if (g.fo.length) { total += avgFO * wFO; wTotal += wFO; }
        if (g.sor.length) { total += avgSOR * wSOR; wTotal += wSOR; }
        if (g.soch.length) { total += avgSOCH * wSOCH; wTotal += wSOCH; }

        const finalPct = wTotal > 0 ? (total / wTotal) * 100 : 0; // 0-100
        
        // 5-Scale Conversion (Based on provided thresholds)
        let grade = 2;
        if (finalPct >= 85) grade = 5;
        else if (finalPct >= 70) grade = 4;
        else if (finalPct >= 55) grade = 3;

        processed.push({
            student_id: g.sid,
            subject_id: g.sub,
            term_id: g.term,
            class_id: g.class_id,
            percent: finalPct,
            grade: grade
        });
    });

    SBI.state.processedGrades = processed;
    
    // Calculate Student Statuses (Отличник etc)
    calcStudentStatuses();

    SBI.state.isLoaded = true;
    console.log(`Processed ${processed.length} final grades.`);
    
    // Trigger UI
    updateAllDashboards();
}

function calcStudentStatuses() {
    const map = {}; // student|term -> status
    const termGrades = {}; // student|term -> [grades]

    SBI.state.processedGrades.forEach(p => {
        const k = `${p.student_id}|${p.term_id}`;
        if (!termGrades[k]) termGrades[k] = [];
        termGrades[k].push(p.grade);
    });

    Object.entries(termGrades).forEach(([k, grades]) => {
        const has2 = grades.includes(2);
        const has3 = grades.includes(3);
        const has4 = grades.includes(4);
        
        if (has2) map[k] = 'Двоечник';
        else if (has3) map[k] = 'Троечник';
        else if (has4) map[k] = 'Хорошист';
        else map[k] = 'Отличник';
    });
    
    SBI.state.studentStatuses = map;
}

function updateAllDashboards() {
    if (window.SBI_Overview) SBI_Overview.update();
    if (window.SBI_Class) SBI_Class.update();
    if (window.SBI_Student) SBI_Student.update();
    if (window.SBI_Teacher) SBI_Teacher.update();
    if (window.SBI_Subject) SBI_Subject.update();
    if (window.SBI_Attendance) SBI_Attendance.update();
    
    // Switch to overview
    document.querySelector('.tab-btn[data-target="page-overview"]').click();
}
