// main.js - Core Data Processing & State
console.log("MAIN.JS: Initializing...");

window.SBI = window.SBI || {};
const SBI = window.SBI;

// Global State
SBI.state = {
    data: null, // Raw rows
    students: [],
    teachers: [],
    classes: [],
    subjects: [],
    terms: [],
    processedGrades: [], // Calculated term grades
    studentStatuses: {}, // { student_id|term_id : 'Отличник' }
    isLoaded: false
};

// Color Scales
SBI.colors = {
    grade5: '#2ecc71',
    grade4: '#3498db',
    grade3: '#f1c40f',
    grade2: '#e74c3c',
    mapHigh: '#27ae60',
    mapLow: '#c0392b'
};

// Helper: Parse Excel Files
SBI.loadData = function(files) {
    if (!files || files.length === 0) return;

    const readers = [];
    const rawData = {};

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        readers.push(new Promise(resolve => {
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                // Assume first sheet
                const sheetName = workbook.SheetNames[0];
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                // Normalize filename to key
                let key = file.name.split(' - ')[1] || file.name;
                key = key.replace('.csv', '').replace('.xlsx', '').trim().toUpperCase();
                rawData[key] = json;
                resolve();
            };
            reader.readAsArrayBuffer(file);
        }));
    });

    Promise.all(readers).then(() => {
        console.log("All files read. Processing...", Object.keys(rawData));
        processRawData(rawData);
    });
};

// Core Processing Logic
function processRawData(raw) {
    // Store reference entities
    SBI.state.students = raw['УЧАЩИЕСЯ'] || [];
    SBI.state.teachers = raw['УЧИТЕЛЯ'] || [];
    SBI.state.classes = raw['КЛАССЫ'] || [];
    SBI.state.subjects = raw['ПРЕДМЕТЫ'] || [];
    SBI.state.terms = raw['ЧЕТВЕРТИ'] || [];
    SBI.state.enrollments = raw['СОСТАВ_КЛАССА'] || [];
    SBI.state.assignments = raw['НАЗНАЧЕНИЯ_ПРЕПОД'] || [];
    SBI.state.attendance = raw['ПОСЕЩАЕМОСТЬ'] || [];
    SBI.state.teacherQuals = raw['TEACHER_QUALS'] || [];

    const grades = raw['ОЦЕНКИ'] || [];

    // 1. Calculate Subject Term Grades
    // Logic: Group by Student-Subject-Term. 
    // Formula: FO_avg * 0.25 + SOR_avg * 0.25 + SOCH * 0.50
    
    const groups = {}; 

    grades.forEach(r => {
        // Key: Student|Subject|Term
        const key = `${r.student_id}|${r.subject_id}|${r.term_id}`;
        if (!groups[key]) groups[key] = { fo: [], sor: [], soch: [] };

        // Detect type
        let val = parseFloat(r.percent); // Expecting 0.85 for 85%
        if (val > 1) val = val / 100; // Correction if 85 instead of 0.85

        if (r.work_type.includes('ФО')) groups[key].fo.push(val);
        else if (r.work_type.includes('СОР')) groups[key].sor.push(val);
        else if (r.work_type.includes('СОЧ')) groups[key].soch.push(val);
    });

    const processed = [];

    for (const [key, g] of Object.entries(groups)) {
        const [sid, sub, term] = key.split('|');
        
        // Averages
        const avgFO = g.fo.length ? g.fo.reduce((a,b)=>a+b,0)/g.fo.length : 0;
        const avgSOR = g.sor.length ? g.sor.reduce((a,b)=>a+b,0)/g.sor.length : 0;
        const valSOCH = g.soch.length ? g.soch[0] : 0; // Take first SOCH

        // Weights: 25% FO, 25% SOR, 50% SOCH
        // Note: If data is missing (e.g. no SOCH), strictly it's 0.
        const totalPct = (avgFO * 0.25) + (avgSOR * 0.25) + (valSOCH * 0.50);
        const totalScore = Math.round(totalPct * 100); // 0-100 scale

        // Convert to 5-point scale
        let grade5 = 2;
        if (totalScore >= 85) grade5 = 5;
        else if (totalScore >= 70) grade5 = 4;
        else if (totalScore >= 55) grade5 = 3;
        else grade5 = 2;

        // Find Class ID for this student in this term
        const enroll = SBI.state.enrollments.find(e => e.student_id === sid && e.term_id === term);
        const classId = enroll ? enroll.class_id : 'Unknown';

        // Find Teacher ID for this class/subject/term
        const assign = SBI.state.assignments.find(a => a.class_id === classId && a.subject_id === sub && a.term_id === term);
        const teacherId = assign ? assign.teacher_id : 'Unknown';

        processed.push({
            student_id: sid,
            subject_id: sub,
            term_id: term,
            class_id: classId,
            teacher_id: teacherId,
            pct: totalPct,
            score: totalScore,
            grade: grade5
        });
    }

    SBI.state.processedGrades = processed;

    // 2. Calculate Student Overall Status per Term
    // Отличник (All 5), Хорошист (4 or 5), Троечник (No 2, at least one 3), Двоечник (At least one 2)
    
    const studentTermGrades = {}; // { sid|term : [grades] }

    processed.forEach(p => {
        const key = `${p.student_id}|${p.term_id}`;
        if (!studentTermGrades[key]) studentTermGrades[key] = [];
        studentTermGrades[key].push(p.grade);
    });

    for (const [key, gradesList] of Object.entries(studentTermGrades)) {
        const has2 = gradesList.includes(2);
        const has3 = gradesList.includes(3);
        const has4 = gradesList.includes(4);
        const has5 = gradesList.includes(5); // Not strictly needed for logic but good to know

        let status = 'Двоечник';
        if (has2) {
            status = 'Двоечник';
        } else if (has3) {
            status = 'Троечник';
        } else if (has4) {
            status = 'Хорошист';
        } else {
            // Only 5s (and no 2,3,4)
            status = 'Отличник';
        }
        SBI.state.studentStatuses[key] = status;
    }

    SBI.state.isLoaded = true;
    console.log("Data Processing Complete.");
    
    // Trigger UI updates
    notifyModules();
}

function notifyModules() {
    if (window.SBI_Overview) window.SBI_Overview.update();
    if (window.SBI_Class) window.SBI_Class.update();
    if (window.SBI_Student) window.SBI_Student.update();
    if (window.SBI_Teacher) window.SBI_Teacher.update();
    if (window.SBI_Subject) window.SBI_Subject.update();
    if (window.SBI_Attendance) window.SBI_Attendance.update();
}

// Utils
SBI.getGradientColor = function(value, min, max) {
    // Returns Red->Green hex
    if (max === min) return '#3498db';
    const ratio = (value - min) / (max - min);
    // Simple transition from Red (0) to Green (120 hue)
    const hue = ratio * 120; 
    return `hsl(${hue}, 70%, 50%)`;
};

// DOM Setup for file loader
document.addEventListener('DOMContentLoaded', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'fileLoader';
    input.addEventListener('change', (e) => SBI.loadData(e.target.files));
    document.body.appendChild(input);
});
