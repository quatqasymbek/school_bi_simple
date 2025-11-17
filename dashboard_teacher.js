// dashboard_teacher.js
console.log("dashboard_teacher.js загружен");

window.SBI_Teacher = (function () {
    const state = SBI.state;

    let teacherSelect, subjectSelect;
    let chartPerf, chartLoad, chartTrend;

    function init() {
        teacherSelect = document.getElementById("teacherSelect");
        subjectSelect = document.getElementById("teacherSubjectSelect");

        chartPerf  = document.getElementById("chart-teacher-performance");
        chartLoad  = document.getElementById("chart-teacher-subjects");
        chartTrend = document.getElementById("chart-teacher-trend");

        if (teacherSelect) teacherSelect.onchange = onTeacherChange;
        if (subjectSelect) subjectSelect.onchange = update;
    }

    function buildAssignmentIndex() {
        if (state.assignByTeacher) return;
        const assignments = state.assignments || state.teacherAssignments || [];
        const map = {};
        assignments.forEach(function (a) {
            const tid = String(a.teacher_id || "").trim();
            if (!tid) return;
            if (!map[tid]) map[tid] = [];
            map[tid].push(a);
        });
        state.assignByTeacher = map;
    }

    function populateTeachers() {
        if (!teacherSelect) return;
        const teachers = state.allTeachers || [];
        teacherSelect.innerHTML = "";
        teachers.forEach(function (t) {
            const opt = document.createElement("option");
            opt.value = t.teacher_id;
            opt.textContent = t.teacher_name;
            teacherSelect.appendChild(opt);
        });
    }

    function subjectsForTeacher(teacherId) {
        buildAssignmentIndex();
        const assignments = state.assignByTeacher[teacherId] || [];
        const idxSubj = state.idx_subjects || {};
        const set = {};
        assignments.forEach(function (a) {
            const sid = String(a.subject_id || "").trim();
            if (!sid) return;
            const subjRow = idxSubj[sid] || {};
            const name = String(subjRow.subject_name || subjRow.name || sid).trim();
            set[sid] = name;
        });
        const arr = [];
        Object.keys(set).forEach(function (sid) {
            arr.push({ sid: sid, name: set[sid] });
        });
        return arr;
    }

    function populateSubjects(teacherId) {
        if (!subjectSelect) return;
        const subjects = subjectsForTeacher(teacherId);
        subjectSelect.innerHTML = "";
        subjects.forEach(function (s) {
            const opt = document.createElement("option");
            opt.value = s.sid;
            opt.textContent = s.name;
            subjectSelect.appendChild(opt);
        });
    }

    function filterRowsForTeacher(teacherId, subjectId) {
        const rows = state.allRows || [];
        const assignments = state.assignByTeacher[teacherId] || [];

        const keySet = {};
        assignments.forEach(function (a) {
            const sid = String(a.subject_id || "").trim();
            const cid = String(a.class_id   || "").trim();
            const tid = String(a.term_id    || "").trim();
            if (!sid || !cid || !tid) return;
            if (subjectId && sid !== subjectId) return;
            keySet[sid + "|" + cid + "|" + tid] = true;
        });

        const filtered = rows.filter(function (r) {
            const sid = String(r.subject_id || "").trim();
            const cid = String(r.class_id   || "").trim();
            const tid = String(r.term_id    || "").trim();
            const key = sid + "|" + cid + "|" + tid;
            return !!keySet[key];
        });

        return filtered;
    }

    function renderPerformanceBox(rows, teacherName, subjectName) {
        if (!chartPerf) return;

        if (!rows.length) {
            Plotly.newPlot(chartPerf, [], {
                title: "Нет данных по выбранному учителю / предмету",
                xaxis: { title: "Четверть" },
                yaxis: { title: "Итоговая оценка" }
            });
            return;
        }

        const yVals = rows.map(function (r) {
            return Number(r.final_percent ?? r.final_5scale ?? NaN);
        }).filter(function (v) { return !Number.isNaN(v); });

        Plotly.newPlot(chartPerf, [{
            x: rows.map(function (r) { return r.term; }),
            y: yVals,
            type: "box"
        }], {
            title: teacherName + " — " + subjectName + " (распределение оценок)",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Итоговая оценка" }
        });
    }

    function renderLoadChart(rows) {
        if (!chartLoad) return;

        if (!rows.length) {
            Plotly.newPlot(chartLoad, [], {
                title: "Нет классов для данного учителя / предмета",
                xaxis: { title: "Класс" },
                yaxis: { title: "Количество записей" }
            });
            return;
        }

        const counts = {};
        rows.forEach(function (r) {
            const cls = r.class;
            if (!counts[cls]) counts[cls] = 0;
            counts[cls]++;
        });

        Plotly.newPlot(chartLoad, [{
            x: Object.keys(counts),
            y: Object.values(counts),
            type: "bar"
        }], {
            title: "Нагрузка по классам (количество оценок)",
            xaxis: { title: "Класс" },
            yaxis: { title: "Количество" }
        });
    }

    function renderTrend(rows) {
        if (!chartTrend) return;

        if (!rows.length) {
            Plotly.newPlot(chartTrend, [], {
                title: "Нет данных для отображения динамики",
                xaxis: { title: "Четверть" },
                yaxis: { title: "Средний балл" }
            });
            return;
        }

        const byTerm = SBI.groupBy(rows, function (r) { return r.term; }, function (r) {
            return Number(r.final_percent ?? r.final_5scale ?? NaN);
        });

        const terms = Object.keys(byTerm);
        const avg = terms.map(function (t) { return SBI.mean(byTerm[t]); });

        Plotly.newPlot(chartTrend, [{
            x: terms,
            y: avg,
            mode: "lines+markers"
        }], {
            title: "Динамика среднего балла по четвертям",
            xaxis: { title: "Четверть" },
            yaxis: { title: "Средний балл" }
        });
    }

    function onTeacherChange() {
        const teacherId = teacherSelect ? teacherSelect.value : "";
        if (!teacherId) return;

        populateSubjects(teacherId);
        update();
    }

    function update() {
        if (!teacherSelect || !subjectSelect) return;
        const teacherId = teacherSelect.value;
        const subjectId = subjectSelect.value;
        if (!teacherId || !subjectId) return;

        const teacher = (state.allTeachers || []).find(function (t) {
            return t.teacher_id === teacherId;
        });
        const teacherName = teacher ? teacher.teacher_name : teacherId;

        const subjList = subjectsForTeacher(teacherId);
        const subjObj = subjList.find(function (s) { return s.sid === subjectId; });
        const subjectName = subjObj ? subjObj.name : subjectId;

        const rows = filterRowsForTeacher(teacherId, subjectId);
        SBI.log("По учителям → строк для " + teacherName + ", " + subjectName + ": " + rows.length);

        renderPerformanceBox(rows, teacherName, subjectName);
        renderLoadChart(rows);
        renderTrend(rows);
    }

    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            SBI.log("Дашборд по учителям: нет данных.");
            return;
        }
        populateTeachers();
        if (teacherSelect && teacherSelect.options.length) {
            teacherSelect.selectedIndex = 0;
            onTeacherChange();
        }
    }

    init();

    return {
        onDataLoaded: onDataLoaded
    };
})();
