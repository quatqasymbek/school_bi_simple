console.log("MAIN.JS: Initializing...");

window.SBI = window.SBI || {};
const SBI = window.SBI;

// STATE
SBI.state = {
    isLoaded: false,
    students: [], teachers: [], classes: [], subjects: [], terms: [],
    gradesRaw: [], attendanceRaw: [], enrollments: [], assignments: [],
    weights: {}, scale: [], processedGrades: [], studentStatuses: {}
};

// UTILS
SBI.mean = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
SBI.uniq = arr => [...new Set(arr)];

// FILE LOADING
SBI.loadData = async function(fileList) {
    if(!fileList.length) return;
    console.log(`Processing ${fileList.length} files...`);

    // Configuration mapping
    const mappings = [
        { key: 'УЧАЩИЕСЯ', prop: 'students' },
        { key: 'УЧИТЕЛЯ', prop: 'teachers' },
        { key: 'КЛАССЫ', prop: 'classes' },
        { key: 'ПРЕДМЕТЫ', prop: 'subjects' },
        { key: 'ЧЕТВЕРТИ', prop: 'terms' },
        { key: 'ОЦЕНКИ', prop: 'gradesRaw' },
        { key: 'ПОСЕЩАЕМОСТЬ', prop: 'attendanceRaw' },
        { key: 'СОСТАВ_КЛАССА', prop: 'enrollments' },
        { key: 'НАЗНАЧЕНИЯ_ПРЕПОД', prop: 'assignments' },
        { key: 'ШКАЛА_5Б', prop: 'scale' },
        { key: 'ВЕСА_ОЦЕНОК', prop: 'weights' },
        { key: 'TEACHER_QUALS', prop: 'teacherQuals' }
    ];

    const files = Array.from(fileList);

    // Load files one by one based on substring match
    for (let m of mappings) {
        // Case-insensitive search for keyword in filename
        const file = files.find(f => f.name.toUpperCase().includes(m.key));
        if (file) {
            console.log(`Loaded: ${m.key}`);
            const data = await readFile(file);
            
            if (m.prop === 'weights') {
                // Parse weights into object { 'ФО': 0.25 }
                SBI.state.weights = data.reduce((acc, r) => {
                    if (r.work_type) acc[r.work_type.trim()] = (parseFloat(r.weight_pct)||0)/100;
                    return acc;
                }, {});
            } else {
                SBI.state[m.prop] = data;
            }
        } else {
            console.warn(`Missing file for: ${m.key}`);
        }
    }

    processData();
};

function readFile(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, {type: 'array'});
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                resolve(json);
            } catch (err) {
                console.error("Error reading file:", err);
                resolve([]);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

// DATA PROCESSING
function processData() {
    const { gradesRaw, weights } = SBI.state;
    if (!gradesRaw.length) {
        alert("Ошибка: Данные оценок не найдены. Загрузите файлы снова.");
        return;
    }

    console.log("Calculating Grades...");
    const groups = {};

    // Group by Student-Subject-Term
    gradesRaw.forEach(r => {
        if(!r.student_id || !r.subject_id || !r.term_id) return;
        const key = `${r.student_id}|${r.subject_id}|${r.term_id}`;
        
        if (!groups[key]) groups[key] = { 
            sid: r.student_id, sub: r.subject_id, term: r.term_id, class_id: r.class_id,
            fo: [], sor: [], soch: [] 
        };

        // Normalize score
        let val = parseFloat(r.percent);
        if (isNaN(val) && r.score && r.max_score) val = r.score / r.max_score;
        if (val > 1) val = val / 100; // Handle 85 vs 0.85

        const type = (r.work_type||'').toUpperCase();
        if (type.includes('ФО')) groups[key].fo.push(val);
        else if (type.includes('СОР')) groups[key].sor.push(val);
        else if (type.includes('СОЧ')) groups[key].soch.push(val);
    });

    const processed = [];
    const wFO = weights['ФО'] || 0.25;
    const wSOR = weights['СОР'] || 0.25;
    const wSOCH = weights['СОЧ'] || 0.50;

    Object.values(groups).forEach(g => {
        const avgFO = SBI.mean(g.fo);
        const avgSOR = SBI.mean(g.sor);
        const avgSOCH = SBI.mean(g.soch);

        // Formula: Weighted Sum
        let total = 0, wTotal = 0;
        if (g.fo.length) { total += avgFO * wFO; wTotal += wFO; }
        if (g.sor.length) { total += avgSOR * wSOR; wTotal += wSOR; }
        if (g.soch.length) { total += avgSOCH * wSOCH; wTotal += wSOCH; }

        const finalPct = wTotal > 0 ? (total / wTotal) * 100 : 0;
        
        // 5-Point Scale
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
    calculateStatuses();
    SBI.state.isLoaded = true;
    
    console.log("Data Ready.");
    updateAll();
}

function calculateStatuses() {
    const map = {};
    const termGrades = {};
    
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

function updateAll() {
    if(window.SBI_Overview) SBI_Overview.update();
    if(window.SBI_Class) SBI_Class.update();
    if(window.SBI_Student) SBI_Student.update();
    if(window.SBI_Teacher) SBI_Teacher.update();
    if(window.SBI_Subject) SBI_Subject.update();
    if(window.SBI_Attendance) SBI_Attendance.update();
    
    // Force click overview to refresh view
    document.querySelector('[data-target="page-overview"]').click();
}
