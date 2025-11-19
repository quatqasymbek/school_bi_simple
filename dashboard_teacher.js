// dashboard_teacher.js - Teachers Analytics
console.log("DASHBOARD_TEACHER.JS: Loaded");

window.SBI_Teacher = (function() {
    const SBI = window.SBI;

    // DOM Elements
    let qualDonut, qualTermSelect;
    let teacherTableBody, teacherMetricSelect;
    let perfPie, perfTeacherSelect, perfTermSelect;

    function init() {
        // 1. Qual Donut
        qualDonut = document.getElementById("chart-teacher-qual");
        qualTermSelect = document.getElementById("teachQualTermSelect");

        // 2. Teacher Table
        teacherTableBody = document.getElementById("teachTableBody");
        teacherMetricSelect = document.getElementById("teachTableMetricSelect");

        // 3. Performance Pie
        perfPie = document.getElementById("chart-teacher-perf");
        perfTeacherSelect = document.getElementById("teachPerfTeacherSelect");
        perfTermSelect = document.getElementById("teachPerfTermSelect");

        // Listeners
        if(qualTermSelect) qualTermSelect.onchange = renderQualDonut;
        if(teacherMetricSelect) teacherMetricSelect.onchange = renderTeacherTable;
        if(perfTeacherSelect) perfTeacherSelect.onchange = renderPerformancePie;
        if(perfTermSelect) perfTermSelect.onchange = renderPerformancePie;
    }

    function onDataLoaded() {
        console.log("SBI_Teacher: Loading Data...");
        populateSelectors();
        renderQualDonut();
        renderTeacherTable();
        renderPerformancePie();
    }

    function populateSelectors() {
        const terms = SBI.state.allTerms ? [...SBI.state.allTerms].sort() : [];
        const teachers = SBI.state.teachers || [];
        
        console.log(`SBI_Teacher: Found ${teachers.length} teachers and ${terms.length} terms.`);

        // Sort teachers by name safely
        teachers.sort((a,b) => {
            const na = `${a.last_name||""} ${a.first_name||""}`.trim() || a.teacher_id;
            const nb = `${b.last_name||""} ${b.first_name||""}`.trim() || b.teacher_id;
            return na.localeCompare(nb);
        });

        // 1. Qual Term
        fillSelect(qualTermSelect, terms);
        
        // 2. Perf Term
        fillSelect(perfTermSelect, terms);

        // 3. Perf Teacher
        if (perfTeacherSelect) {
            perfTeacherSelect.innerHTML = "";
            if (teachers.length === 0) {
                const opt = document.createElement("option");
                opt.textContent = "Нет данных об учителях";
                perfTeacherSelect.appendChild(opt);
            } else {
                teachers.forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t.teacher_id;
                    const name = `${t.last_name||""} ${t.first_name||""}`.trim();
                    opt.textContent = name || t.teacher_id;
                    perfTeacherSelect.appendChild(opt);
                });
                // Select first teacher by default
                if(teachers.length > 0) perfTeacherSelect.value = teachers[0].teacher_id;
            }
        }
    }

    function fillSelect(select, values) {
        if (!select) return;
        const oldVal = select.value;
        select.innerHTML = "";
        values.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
        });
        
        // Restore selection if it still exists in new values, else pick first
        if (values.length > 0) {
            if(values.includes(oldVal)) select.value = oldVal;
            else select.value = values[0];
        }
    }

    // Helper: Find Teacher ID for a specific Class+Subject+Term
    function getTeacherForAssignment(classId, subjectId, termId) {
        const asg = SBI.state.assignments || [];
        // Robust check matching strings
        const found = asg.find(a => 
            String(a.class_id) === String(classId) && 
            String(a.subject_id) === String(subjectId) && 
            String(a.term_id) === String(termId)
        );
        return found ? found.teacher_id : null;
    }

    // ======================================================
    // 1. QUALIFICATION DONUT
    // ======================================================
    function renderQualDonut() {
        if(!qualDonut || !qualTermSelect) return;
        const term = qualTermSelect.value;
        const teachers = SBI.state.teachers || [];
        const assignments = SBI.state.assignments || [];

        // Filter teachers active in this term
        let activeTids = new Set();
        if(assignments.length > 0) {
            assignments.filter(a => a.term_id === term).forEach(a => activeTids.add(a.teacher_id));
        } else {
            // Fallback: show all if no assignment data loaded
            teachers.forEach(t => activeTids.add(t.teacher_id));
        }

        const activeTeachers = teachers.filter(t => activeTids.has(t.teacher_id));
        
        if(activeTeachers.length === 0) {
            qualDonut.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>Нет данных для отображения.</div>";
            Plotly.purge(qualDonut);
            return;
        }

        const qualMap = {};
        (SBI.state.teacherQuals || []).forEach(q => {
            qualMap[q.qual_code] = q.qual_name;
        });

        const counts = {};
        activeTeachers.forEach(t => {
            const code = t.qualification_code || "Unknown";
            const name = qualMap[code] || code;
            counts[name] = (counts[name] || 0) + 1;
        });

        const data = [{
            values: Object.values(counts),
            labels: Object.keys(counts),
            type: 'pie',
            hole: 0.4,
            textinfo: 'label+value'
        }];

        const layout = {
            title: `Квалификации (${term || 'Все'})`,
            margin: { t: 30, b: 10, l: 10, r: 10 },
            showlegend: true
        };

        Plotly.newPlot(qualDonut, data, layout, {displayModeBar:false});
    }

    // ======================================================
    // 2. TEACHER MATRIX TABLE
    // ======================================================
    function renderTeacherTable() {
        if(!teacherTableBody) return;
        const metric = teacherMetricSelect ? teacherMetricSelect.value : "quality";
        const teachers = SBI.state.teachers || [];
        const rows = SBI.state.allRows || [];
        const terms = SBI.state.allTerms ? [...SBI.state.allTerms].sort() : [];
        const subjects = SBI.state.subjects || [];

        teacherTableBody.innerHTML = "";

        if (teachers.length === 0) {
            teacherTableBody.innerHTML = "<tr><td colspan='10' style='text-align:center; color:#999'>Список учителей пуст. Проверьте загрузку файла 'УЧИТЕЛЯ'.</td></tr>";
            return;
        }

        // Pre-calculate rows map to avoid N*M filtering
        const teacherRows = {}; 
        rows.forEach(r => {
            const tid = getTeacherForAssignment(r.class_id, r.subject_id, r.term);
            if(!tid) return;
            if(!teacherRows[tid]) teacherRows[tid] = {};
            if(!teacherRows[tid][r.term]) teacherRows[tid][r.term] = [];
            teacherRows[tid][r.term].push(r);
        });

        // Helper for Subjects taught by teacher
        const teacherSubjects = {};
        (SBI.state.assignments || []).forEach(a => {
            if(!teacherSubjects[a.teacher_id]) teacherSubjects[a.teacher_id] = new Set();
            const subjObj = subjects.find(s => s.subject_id === a.subject_id);
            const sName = subjObj ? subjObj.subject_name : a.subject_id;
            teacherSubjects[a.teacher_id].add(sName);
        });

        // Helper for Quals
        const qualMap = {};
        (SBI.state.teacherQuals || []).forEach(q => { qualMap[q.qual_code] = q.qual_name; });

        teachers.forEach(t => {
            const tr = document.createElement("tr");
            
            // Name
            const tdName = document.createElement("td");
            const name = `${t.last_name||""} ${t.first_name||""}`.trim();
            tdName.textContent = name || t.teacher_id;
            tdName.style.textAlign = "left";
            tr.appendChild(tdName);

            // Subject
            const tdSubj = document.createElement("td");
            const sSet = teacherSubjects[t.teacher_id] || new Set();
            tdSubj.textContent = Array.from(sSet).join(", ") || "-";
            tr.appendChild(tdSubj);

            // Qual
            const tdQual = document.createElement("td");
            tdQual.textContent = qualMap[t.qualification_code] || t.qualification_code || "-";
            tr.appendChild(tdQual);

            // Terms
            terms.forEach(term => {
                const td = document.createElement("td");
                const tData = teacherRows[t.teacher_id] ? teacherRows[t.teacher_id][term] : null;
                if(!tData || tData.length === 0) {
                    td.textContent = "-";
                    td.style.color = "#ccc";
                } else {
                    const val = calculateMetric(tData, metric);
                    td.textContent = val;
                    colorCell(td, val, metric);
                }
                tr.appendChild(td);
            });

            teacherTableBody.appendChild(tr);
        });
    }

    function calculateMetric(rows, metric) {
        const grades = rows.map(r => r.final_5scale).filter(g => g != null);
        if(grades.length === 0) return "-";
        if (metric === 'average') {
            return SBI.mean(grades).toFixed(2);
        } else {
            const good = grades.filter(g => g >= 4).length;
            return ((good / grades.length) * 100).toFixed(0) + "%";
        }
    }

    function colorCell(td, valStr, metric) {
        const val = parseFloat(valStr);
        if(isNaN(val)) return;
        if(metric === 'quality') {
            if(val >= 70) td.className = 'grade-good';
            else if(val < 40) td.className = 'grade-bad';
        } else {
            if(val >= 4.5) td.className = 'grade-good';
            else if(val < 3.0) td.className = 'grade-bad';
        }
    }

    // ======================================================
    // 3. INDIVIDUAL TEACHER PERFORMANCE
    // ======================================================
    function renderPerformancePie() {
        if(!perfPie || !perfTeacherSelect || !perfTermSelect) return;

        const tid = perfTeacherSelect.value;
        const term = perfTermSelect.value;
        
        if(!tid || !term) {
            perfPie.innerHTML = "";
            Plotly.purge(perfPie);
            return;
        }

        // Filter rows taught by this teacher in this term
        const rows = (SBI.state.allRows || []).filter(r => {
            return r.term === term && getTeacherForAssignment(r.class_id, r.subject_id, r.term) === tid;
        });

        if(rows.length === 0) {
            Plotly.purge(perfPie);
            perfPie.innerHTML = "<div style='padding:40px;text-align:center;color:#999'>Нет оценок для выбранного учителя и четверти</div>";
            return;
        }

        let counts = { '5': 0, '4': 0, '3': 0, '2': 0 };
        
        rows.forEach(r => {
            const g = r.final_5scale;
            if(g === 5) counts['5']++;
            else if(g === 4) counts['4']++;
            else if(g === 3) counts['3']++;
            else if(g != null && g <= 2) counts['2']++;
        });

        const data = [{
            values: [counts['5'], counts['4'], counts['3'], counts['2']],
            labels: ['Отличники (5)', 'Хорошисты (4)', 'Троечники (3)', 'Двоечники (2)'],
            type: 'pie',
            hole: 0.5,
            marker: { colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] },
            textinfo: 'label+percent+value'
        }];

        Plotly.newPlot(perfPie, data, {
            title: 'Распределение оценок',
            margin: { t: 40, b: 20, l: 20, r: 20 },
            showlegend: true
        }, {displayModeBar:false});
    }

    document.addEventListener('DOMContentLoaded', init);

    return { onDataLoaded };
})();
