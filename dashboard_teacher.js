// dashboard_teacher.js
console.log("dashboard_teacher.js загружен");

window.SBI_Teacher = (function () {
    const state = SBI.state;
    const log = SBI.log || console.log;

    let teacherSelect, termSelect;
    let summaryTableWrapper;
    let pieChartContainer;

    // Индекс для быстрого поиска учителя по ID
    let teacherIndex = {};

    function buildTeacherName(teacher) {
        if (!teacher) return "";
        const parts = [
            teacher.last_name   != null ? String(teacher.last_name).trim()   : "",
            teacher.first_name  != null ? String(teacher.first_name).trim()  : "",
            teacher.middle_name != null ? String(teacher.middle_name).trim() : ""
        ].filter(Boolean);
        return parts.join(" ");
    }

    function init() {
        // 1. Инициализация DOM элементов
        teacherSelect       = document.getElementById("teacherSelect");
        termSelect          = document.getElementById("teacherTermSelect");
        summaryTableWrapper = document.getElementById("teacherSummaryTableWrapper");
        pieChartContainer   = document.getElementById("chart-teacher-pie");

        // 2. Настройка слушателей событий
        if (teacherSelect) teacherSelect.onchange = update;
        if (termSelect)    termSelect.onchange    = update;

        // 3. Создание индекса учителей
        if (state.teachers && state.teachers.length) {
            state.teachers.forEach(t => {
                if (t.teacher_id) {
                    teacherIndex[t.teacher_id] = t;
                }
            });
        }
    }

    // Вспомогательная функция для приведения оценки к 5-балльной шкале (аналогично overview.js)
    function valueTo5Scale(row) {
        const s5 = SBI.toNumber(row.final_5scale);
        if (s5 != null && s5 > 0) return s5;
        const p = SBI.toNumber(row.final_percent);
        if (p != null && p > 0) return p / 20 * 5; // Проксимация: 100% = 5
        return null;
    }

    function populateFilters() {
        const teachers = state.teachers || [];
        const terms    = state.allTerms || [];

        // Учителя
        if (teacherSelect) {
            teacherSelect.innerHTML = "";
            teachers.forEach(t => {
                const name = buildTeacherName(t);
                if (!name || !t.teacher_id) return;
                const opt = document.createElement("option");
                opt.value = t.teacher_id;
                opt.textContent = name;
                teacherSelect.appendChild(opt);
            });
            // Выбираем первого учителя по умолчанию
            if (teachers.length) {
                teacherSelect.value = teachers[0].teacher_id;
            }
        }

        // Четверти
        if (termSelect) {
            termSelect.innerHTML = "";
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                termSelect.appendChild(opt);
            });
            // Выбираем последнюю четверть по умолчанию
            if (terms.length) {
                termSelect.value = String(terms[terms.length - 1]).trim();
            }
        }
    }

    function update() {
        const selectedTeacherId = teacherSelect ? teacherSelect.value : null;
        const selectedTermId = termSelect ? termSelect.value : null;

        if (!selectedTeacherId || !selectedTermId) {
            if (summaryTableWrapper) summaryTableWrapper.innerHTML = "<p>Выберите учителя и четверть.</p>";
            if (pieChartContainer)   pieChartContainer.innerHTML = "";
            return;
        }

        log(`Дашборд учителя: ID=${selectedTeacherId}, Четверть=${selectedTermId}`);

        // 1. Фильтруем назначения для выбранного учителя и четверти
        const teacherAssignments = (state.teacherAssignments || [])
            .filter(a => String(a.teacher_id).trim() === selectedTeacherId &&
                         String(a.term_id).trim() === selectedTermId);

        // 2. Рендерим таблицу
        renderSummaryTable(selectedTeacherId, selectedTermId, teacherAssignments);

        // 3. Рендерим диаграмму
        renderGradePie(selectedTeacherId, selectedTermId, teacherAssignments);
    }

    function renderSummaryTable(teacherId, termId, assignments) {
        if (!summaryTableWrapper) return;

        if (!assignments.length) {
            summaryTableWrapper.innerHTML =
                `<p class="text-gray-500">У учителя нет назначений на четверть ${termId}.</p>`;
            return;
        }

        const assignmentsData = assignments.map(assignment => {
            const subjectName = state.idx_subjects[assignment.subject_id] || assignment.subject_id;
            const classId     = assignment.class_id;

            // Найти все строки оценок для данного назначения
            const rows = (state.allRows || []).filter(r =>
                r.teacher_id === teacherId &&
                r.term === termId &&
                r.subject_id === assignment.subject_id &&
                r.class === classId
            );

            // Группируем студентов и рассчитываем их средний балл
            const studentsGrades = SBI.groupBy(
                rows,
                r => r.student_id,
                valueTo5Scale
            );

            // Подсчет студентов
            const studentCount = Object.keys(studentsGrades).length;
            
            // Расчет среднего балла по классу/предмету
            const allClassAverages = Object.values(studentsGrades).map(grades => SBI.mean(grades))
                .filter(v => v != null); // средний балл каждого ученика

            const avgScore = SBI.mean(allClassAverages);

            // Качество знаний (доля 4 и 5)
            const qualityRatio = SBI.knowledgeRatio(rows);
            
            return {
                subjectName,
                classId,
                studentCount,
                avgScore: avgScore != null ? avgScore.toFixed(2) : 'Н/Д',
                qualityRatio: qualityRatio != null ? (qualityRatio * 100).toFixed(1) + '%' : 'Н/Д',
                allClassAverages
            };
        });


        // Строим HTML таблицу
        const table = document.createElement("table");
        table.className = "data-table"; // Используем стиль из index.html

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Предмет</th>
                    <th>Класс</th>
                    <th>Студентов</th>
                    <th>Средний балл (5-шкала)</th>
                    <th>Качество знаний (4 и 5)</th>
                </tr>
            </thead>
            <tbody>
                ${assignmentsData.map(a => `
                    <tr>
                        <td>${a.subjectName}</td>
                        <td>${a.classId}</td>
                        <td>${a.studentCount}</td>
                        <td>${a.avgScore}</td>
                        <td>${a.qualityRatio}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        summaryTableWrapper.innerHTML = "";
        summaryTableWrapper.appendChild(table);
    }

    function renderGradePie(teacherId, termId, assignments) {
        if (!pieChartContainer) return;
        
        // 1. Собираем все строки оценок для выбранного учителя и четверти
        const allTeacherRows = (state.allRows || []).filter(r =>
            r.teacher_id === teacherId && r.term === termId
        );
        
        if (!allTeacherRows.length) {
            pieChartContainer.innerHTML = "<p>Нет данных по оценкам для этого учителя и четверти.</p>";
            return;
        }

        // 2. Группируем по фактическим 5-бальным оценкам
        const gradeCounts = {};
        allTeacherRows.forEach(row => {
            const grade = SBI.toNumber(row.final_5scale);
            if (grade != null && grade >= 2 && grade <= 5) {
                gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
            }
        });

        const grades = Object.keys(gradeCounts).sort().map(Number);
        const counts = grades.map(g => gradeCounts[g]);

        if (grades.length === 0) {
            pieChartContainer.innerHTML = "<p>Недостаточно данных для построения диаграммы.</p>";
            return;
        }
        
        const labels = grades.map(g => `${g} (${counts[grades.indexOf(g)]})`);
        const colors = {
            5: '#10B981', // green-500
            4: '#3B82F6', // blue-500
            3: '#FBBF24', // amber-400
            2: '#EF4444'  // red-500
        };
        const pieColors = grades.map(g => colors[g]);

        const data = [{
            values: counts,
            labels: labels,
            type: 'pie',
            marker: {
                colors: pieColors
            },
            hoverinfo: 'label+percent',
            textinfo: 'percent',
            automargin: true
        }];

        const layout = {
            title: `Распределение всех оценок (Четверть ${termId})`,
            height: 350,
            margin: { t: 30, b: 0, l: 0, r: 0 },
            legend: {
                orientation: "h",
                y: -0.1
            }
        };

        Plotly.newPlot(pieChartContainer, data, layout, { responsive: true, displayModeBar: false });
    }

    // -------- public lifecycle --------
    function onDataLoaded() {
        const rows = state.allRows || [];
        if (!rows.length) {
            log("[TeacherDashboard] onDataLoaded: нет данных allRows");
            return;
        }

        // Убедимся, что инициализация выполнена (включая построение teacherIndex)
        init(); 
        
        populateFilters();
        update();
    }

    // Инициализация при первой загрузке скрипта
    // (Поскольку скрипты внизу body, DOM должен быть готов)
    init();

    return {
        onDataLoaded: onDataLoaded
    };
})();
