// dashboard_teacher.js - Teachers Analytics
console.log("DASHBOARD_TEACHER.JS: Loaded and fixed");

window.SBI_Teacher = (function() {
    const SBI = window.SBI;
    const log = SBI.log || console.log;

    // DOM Elements for section 1: Квалификация педагогического состава
    let qualDonut, qualTermSelect;
    
    // DOM Elements for section 2: Мониторинг успеваемости по учителям
    let teacherTableBody, teacherMetricSelect; // Assumed HTML has an element with ID 'teachTableBody' and 'teachTableMetricSelect'
    
    // DOM Elements for section 3: Персональный анализ результатов
    let perfPie, perfTeacherSelect, perfTermSelect; // Assumed HTML has specific selectors for this section
    
    // Cached internal data structures
    let teacherQualMap = {}; // Map of qual_code to qual_name
    let teacherAssignmentMap = {}; // Map of teacher_id -> { term_id -> [rows of grades] }

    // ======================================================
    // 0. INIT & HELPERS
    // ======================================================

    function buildTeacherName(teacher) {
        if (!teacher) return "";
        const parts = [
            teacher.last_name   != null ? String(teacher.last_name).trim()   : "",
            teacher.first_name  != null ? String(teacher.first_name).trim()  : ""
        ].filter(Boolean);
        return parts.join(" ");
    }
    
    /**
     * Helper: Find Teacher ID for a specific Class+Subject+Term
     * This is vital for linking grades (allRows) back to teachers.
     */
    function getTeacherForAssignment(classId, subjectId, termId) {
        const asg = SBI.state.assignments || []; // 'assignments' sheet data (НАЗНАЧЕНИЯ_ПРЕПОД)
        
        // Match all three fields precisely
        const found = asg.find(a => 
            String(a.class_id).trim() === String(classId).trim() && 
            String(a.subject_id).trim() === String(subjectId).trim() && 
            String(a.term_id).trim() === String(termId).trim()
        );
        return found ? found.teacher_id : null;
    }
    
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

        // Set up Listeners
        if(qualTermSelect) qualTermSelect.onchange = renderQualDonut;
        
        // FIX 1: Set default metric to 'quality' and attach listener
        if (teacherMetricSelect) {
            if (teacherMetricSelect.value !== 'average') { // Only set if not already 'average'
                teacherMetricSelect.value = 'quality'; // Default to Качество знаний
            }
            teacherMetricSelect.onchange = renderTeacherTable;
        }
        
        if(perfTeacherSelect) perfTeacherSelect.onchange = renderPerformancePie;
        if(perfTermSelect) perfTermSelect.onchange = renderPerformancePie;
    }
    
    /**
     * Builds internal data maps after main data load.
     */
    function buildDataMaps() {
        // 1. Teacher Qual Map
        (SBI.state.teacherQuals || []).forEach(q => {
            teacherQualMap[q.qual_code] = q.qual_name;
        });

        // 2. Teacher Assignment Map (link allRows to teacher via assignments)
        teacherAssignmentMap = {}; 
        const rows = SBI.state.allRows || [];

        rows.forEach(r => {
            // Find the teacher ID for this specific grade row (class + subject + term)
            const tid = getTeacherForAssignment(r.class_id, r.subject_id, r.term);
            if (!tid) return;
            
            if (!teacherAssignmentMap[tid]) teacherAssignmentMap[tid] = {};
            if (!teacherAssignmentMap[tid][r.term]) teacherAssignmentMap[tid][r.term] = [];
            
            teacherAssignmentMap[tid][r.term].push(r);
        });
        log("SBI_Teacher: Built teacherAssignmentMap with entries:", Object.keys(teacherAssignmentMap).length);
    }
    
    function fillSelect(select, values, defaultValue = null) {
        if (!select) return;
        const oldVal = select.value;
        select.innerHTML = "";
        
        if (!values || values.length === 0) {
             const opt = document.createElement("option");
             opt.textContent = "Нет данных";
             opt.value = "NODATA";
             select.appendChild(opt);
             return;
        }
        
        values.forEach(v => {
            const opt = document.createElement("option");
            if (typeof v === 'object' && v.teacher_id) {
                const name = buildTeacherName(v);
                opt.value = v.teacher_id;
                opt.textContent = name || v.teacher_id;
            } else { 
                opt.value = v;
                opt.textContent = v;
            }
            select.appendChild(opt);
        });
        
        // Restore selection if possible, otherwise use default
        if (oldVal && select.querySelector(`option[value="${oldVal}"]`)) {
            select.value = oldVal;
        } else if (defaultValue !== null && select.querySelector(`option[value="${defaultValue}"]`)) {
            select.value = defaultValue;
        } else if (values.length > 0) {
            select.value = values[0].teacher_id ? values[0].teacher_id : values[0];
        }
    }

    function populateSelectors() {
        const terms = SBI.state.allTerms ? [...SBI.state.allTerms].sort() : [];
        const teachers = SBI.state.teachers || [];
        
        // Sort teachers by name
        teachers.sort((a,b) => buildTeacherName(a).localeCompare(buildTeacherName(b)));

        // Use the last term as default
        const defaultTerm = terms.length > 0 ? terms[terms.length - 1] : null;

        // 1. Qual Term
        fillSelect(qualTermSelect, terms, defaultTerm);
        
        // 2. Perf Term
        fillSelect(perfTermSelect, terms, defaultTerm);

        // 3. Perf Teacher (use object list here)
        fillSelect(perfTeacherSelect, teachers);
    }

    // ======================================================
    // 1. КВАЛИФИКАЦИЯ ПЕДАГОГИЧЕСКОГО СОСТАВА (QUALIFICATION DONUT)
    // ======================================================
    function renderQualDonut() {
        if(!qualDonut || !qualTermSelect) return;
        const term = qualTermSelect.value;
        const teachers = SBI.state.teachers || [];
        const assignments = SBI.state.assignments || [];

        // Determine active teachers in this term
        let activeTids = new Set();
        if(assignments.length > 0 && term !== 'NODATA') {
            assignments.filter(a => String(a.term_id).trim() === String(term).trim()).forEach(a => activeTids.add(a.teacher_id));
        } else {
            // Fallback: show all if no assignment data loaded or term selector is empty
            teachers.forEach(t => activeTids.add(t.teacher_id));
        }

        const activeTeachers = teachers.filter(t => activeTids.has(t.teacher_id));
        
        if(activeTeachers.length === 0) {
            Plotly.purge(qualDonut);
            qualDonut.innerHTML = "<div style='padding:20px;text-align:center;color:#999'>Нет данных об учителях для выбранной четверти.</div>";
            return;
        }

        const counts = {};
        activeTeachers.forEach(t => {
            const code = t.qualification_code || "Unknown";
            const name = teacherQualMap[code] || code;
            counts[name] = (counts[name] || 0) + 1;
        });

        const data = [{
            values: Object.values(counts),
            labels: Object.keys(counts),
            type: 'pie',
            hole: 0.4,
            textinfo: 'label+percent',
            marker: { colors: ['#3B82F6', '#10B981', '#FBBF24', '#EF4444', '#A855F7', '#06B6D4'] }
        }];

        const layout = {
            title: `Распределение квалификаций (${term || 'Все'})`,
            height: 350,
            margin: { t: 30, b: 10, l: 10, r: 10 },
            showlegend: true
        };

        Plotly.newPlot(qualDonut, data, layout, {displayModeBar:false, responsive: true});
    }


    // ======================================================
    // 2. МОНИТОРИНГ УСПЕВАЕМОСТИ ПО УЧИТЕЛЯМ (MATRIX TABLE)
    // ======================================================

    function calculateMetric(rows, metric) {
        // Only consider the 5-scale final grades (must be >= 2)
        const grades = rows.map(r => SBI.toNumber(r.final_5scale)).filter(g => g != null && g >= 2); 
        
        if(grades.length === 0) return "-";
        
        if (metric === 'average') {
            return SBI.mean(grades).toFixed(2);
        } else { // 'quality' (Качество знаний: доля 4 и 5)
            const good = grades.filter(g => g >= 4).length;
            return ((good / grades.length) * 100).toFixed(0) + "%";
        }
    }

    function colorCell(td, valStr, metric) {
        const val = parseFloat(valStr.replace('%', ''));
        if(isNaN(val)) return;
        
        if(metric === 'quality') {
            if(val >= 70) td.className = 'grade-good';
            else if(val <= 40) td.className = 'grade-bad';
            else td.className = 'grade-neutral';
        } else { // 'average'
            if(val >= 4.5) td.className = 'grade-good';
            else if(val < 3.0) td.className = 'grade-bad';
            else td.className = 'grade-neutral';
        }
    }

    function renderTeacherTable() {
        if(!teacherTableBody) return;
        
        const metric = teacherMetricSelect ? teacherMetricSelect.value : "quality"; 
        const teachers = SBI.state.teachers || [];
        const terms = SBI.state.allTerms ? [...SBI.state.allTerms].sort() : [];
        const subjectIdx = SBI.state.idx_subjects || {};

        teacherTableBody.innerHTML = "";

        if (teachers.length === 0) {
            teacherTableBody.innerHTML = "<tr><td colspan='10' style='text-align:center; color:#999'>Список учителей пуст.</td></tr>";
            return;
        }
        
        // Helper for Subjects taught by teacher
        const teacherSubjects = {};
        (SBI.state.assignments || []).forEach(a => {
            if(!teacherSubjects[a.teacher_id]) teacherSubjects[a.teacher_id] = new Set();
            const sName = subjectIdx[a.subject_id] || a.subject_id;
            teacherSubjects[a.teacher_id].add(sName);
        });

        // Render rows
        teachers.forEach(t => {
            const tr = document.createElement("tr");
            const teacherId = t.teacher_id;
            
            // Name
            const tdName = document.createElement("td");
            tdName.textContent = buildTeacherName(t) || teacherId;
            tdName.style.textAlign = "left";
            tr.appendChild(tdName);

            // Subject
            const tdSubj = document.createElement("td");
            const sSet = teacherSubjects[teacherId] || new Set();
            tdSubj.textContent = Array.from(sSet).sort().join(", ") || "-";
            tr.appendChild(tdSubj);

            // Qual
            const tdQual = document.createElement("td");
            tdQual.textContent = teacherQualMap[t.qualification_code] || t.qualification_code || "-";
            tr.appendChild(tdQual);

            // Terms columns
            terms.forEach(term => {
                const td = document.createElement("td");
                const tData = (teacherAssignmentMap[teacherId] && teacherAssignmentMap[teacherId][term]) || []; 
                
                if(tData.length === 0) {
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

    // ======================================================
    // 3. ПЕРСОНАЛЬНЫЙ АНАЛИЗ РЕЗУЛЬТАТОВ (PERFORMANCE PIE)
    // ======================================================
    function renderPerformancePie() {
        if(!perfPie || !perfTeacherSelect || !perfTermSelect) return;

        const tid = perfTeacherSelect.value;
        const term = perfTermSelect.value;
        
        if(!tid || tid === "NODATA" || !term || term === "NODATA") {
            Plotly.purge(perfPie);
            perfPie.innerHTML = "<div style='padding:40px;text-align:center;color:#999'>Выберите учителя и четверть для анализа.</div>";
            return;
        }

        // Get all rows (grades) assigned to this teacher/term combination from the pre-calculated map
        const rows = (teacherAssignmentMap[tid] && teacherAssignmentMap[tid][term]) || [];

        if(rows.length === 0) {
            Plotly.purge(perfPie);
            perfPie.innerHTML = "<div style='padding:40px;text-align:center;color:#999'>Нет оценок для выбранного учителя и четверти.</div>";
            return;
        }

        let counts = { '5': 0, '4': 0, '3': 0, '2': 0 };
        let totalGrades = 0;
        
        rows.forEach(r => {
            const g = SBI.toNumber(r.final_5scale);
            if(g === 5) counts['5']++;
            else if(g === 4) counts['4']++;
            else if(g === 3) counts['3']++;
            else if(g != null && g >= 2 && g < 3) counts['2']++;
            
            if (g != null && g >= 2) totalGrades++;
        });
        
        if (totalGrades === 0) {
             Plotly.purge(perfPie);
            perfPie.innerHTML = "<div style='padding:40px;text-align:center;color:#999'>Не найдено действительных 5-балльных оценок (2-5).</div>";
            return;
        }

        const data = [{
            values: [counts['5'], counts['4'], counts['3'], counts['2']],
            labels: ['Отлично (5)', 'Хорошо (4)', 'Удовлетворительно (3)', 'Неудовлетворительно (2)'],
            type: 'pie',
            hole: 0.5,
            marker: { colors: ['#10B981', '#3B82F6', '#FBBF24', '#EF4444'] },
            textinfo: 'label+percent+value',
            sort: false
        }];

        const teacher = SBI.state.teachers.find(t => t.teacher_id === tid);
        const teacherName = buildTeacherName(teacher) || tid;

        Plotly.newPlot(perfPie, data, {
            title: `Распределение оценок для ${teacherName} (${term})`,
            height: 350,
            margin: { t: 40, b: 20, l: 20, r: 20 },
            showlegend: true
        }, {displayModeBar:false, responsive: true});
    }

    // ======================================================
    // LIFECYCLE
    // ======================================================
    function onDataLoaded() {
        const rows = SBI.state.allRows || [];
        if (!rows.length) {
            log("[TeacherDashboard] onDataLoaded: нет данных allRows");
            return;
        }
        
        // 1. Построение внутренних индексов
        buildDataMaps(); 

        // 2. Заполнение всех селекторов
        populateSelectors();
        
        // 3. Первичный рендеринг всех трех секций
        renderQualDonut();
        renderTeacherTable();
        renderPerformancePie();
    }
    
    document.addEventListener('DOMContentLoaded', init); // Run init when DOM is ready

    return {
        onDataLoaded: onDataLoaded
    };
})();
```eof
