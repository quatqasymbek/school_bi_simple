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
        populateSelectors();
        renderQualDonut();
        renderTeacherTable();
        renderPerformancePie();
    }

    function populateSelectors() {
        const terms = SBI.state.allTerms ? SBI.state.allTerms.sort() : [];
        const teachers = SBI.state.teachers || [];

        // Sort teachers by name
        teachers.sort((a,b) => {
            const na = `${a.last_name} ${a.first_name}`;
            const nb = `${b.last_name} ${b.first_name}`;
            return na.localeCompare(nb);
        });

        // 1. Qual Term
        fillSelect(qualTermSelect, terms);
        
        // 2. Perf Term
        fillSelect(perfTermSelect, terms);

        // 3. Perf Teacher
        if (perfTeacherSelect) {
            perfTeacherSelect.innerHTML = "";
            teachers.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.teacher_id;
                opt.textContent = `${t.last_name} ${t.first_name}`;
                perfTeacherSelect.appendChild(opt);
            });
            if(teachers.length) perfTeacherSelect.value = teachers[0].teacher_id;
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
        // Restore selection if possible, else first
        if(values.includes(oldVal)) select.value = oldVal;
        else if(values.length > 0) select.value = values[0];
    }

    // Helper: Find Teacher ID for a specific Class+Subject+Term
    // We memoize this or just lookup.
    function getTeacherForAssignment(classId, subjectId, termId) {
        const asg = SBI.state.assignments || [];
        // Assignment format: teacher_id, class_id, subject_id, term_id
        const found = asg.find(a => a.class_id === classId && a.subject_id === subjectId && a.term_id === termId);
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

        // Filter teachers active in this term (have at least one assignment)
        // If no assignments loaded, show all teachers
        let activeTids = new Set();
        if(assignments.length > 0) {
            assignments.filter(a => a.term_id === term).forEach(a => activeTids.add(a.teacher_id));
        } else {
            // Fallback if no assignment data: show all
            teachers.forEach(t => activeTids.add(t.teacher_id));
        }

        const activeTeachers = teachers.filter(t => activeTids.has(t.teacher_id));
        
        if(activeTeachers.length === 0) {
            qualDonut.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>Нет учителей с нагрузкой в этой четверти</div>";
            return;
        }

        // Get Mapping code -> readable name
        // TEACHER_QUALS: qual_name, qual_code
        const qualMap = {};
        (SBI.state.teacherQuals || []).forEach(q => {
            qualMap[q.qual_code] = q.qual_name;
        });

        // Count
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
            title: `Квалификации (${term})`,
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
        const terms = SBI.state.allTerms || [];
        const subjects = SBI.state.subjects || [];

        teacherTableBody.innerHTML = "";

        // We need to iterate teachers, find their rows per term.
        // Since linking is heavy (Row -> Teacher), let's pre-calculate map:
        // Map: TeacherID -> Term -> [Row1, Row2...]
        
        const teacherRows = {}; // { "T-001": { "2024-T1": [...], "2024-T2": [...] } }

        rows.forEach(r => {
            const tid = getTeacherForAssignment(r.class_id, r.subject_id, r.term);
            if(!tid) return;
            
            if(!teacherRows[tid]) teacherRows[tid] = {};
            if(!teacherRows[tid][r.term]) teacherRows[tid][r.term] = [];
            teacherRows[tid][r.term].push(r);
        });

        // Find Subject Name for teacher (based on assignments or rows)
        const teacherSubjects = {};
        (SBI.state.assignments || []).forEach(a => {
            if(!teacherSubjects[a.teacher_id]) teacherSubjects[a.teacher_id] = new Set();
            // Lookup subject name
            const subjObj = subjects.find(s => s.subject_id === a.subject_id);
            const sName = subjObj ? subjObj.subject_name : a.subject_id;
            teacherSubjects[a.teacher_id].add(sName);
        });

        // Get Qual Names
        const qualMap = {};
        (SBI.state.teacherQuals || []).forEach(q => { qualMap[q.qual_code] = q.qual_name; });

        teachers.forEach(t => {
            const tr = document.createElement("tr");
            
            // Name
            const tdName = document.createElement("td");
            tdName.textContent = `${t.last_name} ${t.first_name}`;
            tdName.style.textAlign = "left";
            tr.appendChild(tdName);

            // Subject
            const tdSubj = document.createElement("td");
            const sSet = teacherSubjects[t.teacher_id] || new Set();
            tdSubj.textContent = Array.from(sSet).join(", ") || "-";
            tr.appendChild(tdSubj);

            // Qualification
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
            return;
        }

        // Filter Rows: Must be taught by this teacher in this term
        const rows = (SBI.state.allRows || []).filter(r => {
            return r.term === term && getTeacherForAssignment(r.class_id, r.subject_id, r.term) === tid;
        });

        if(rows.length === 0) {
            Plotly.purge(perfPie);
            perfPie.innerHTML = "<div style='padding:40px;text-align:center;color:#999'>Нет оценок у этого учителя в выбранной четверти</div>";
            return;
        }

        // Count 5/4/3/2
        // Note: One student might have multiple subjects with this teacher? Usually not, but possible.
        // We count *Grades*, not *Students*. (e.g. 5 in Math, 4 in Physics -> 1 Otlichno, 1 Khorosho)
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

        const layout = {
            title: 'Распределение оценок',
            margin: { t: 40, b: 20, l: 20, r: 20 },
            showlegend: true
        };

        Plotly.newPlot(perfPie, data, layout, {displayModeBar:false});
    }

    document.addEventListener('DOMContentLoaded', init);

    return { onDataLoaded };
})();
