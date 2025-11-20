// dashboard_teacher.js
console.log("dashboard_teacher.js загружен");

window.SBI_Teacher = (function () {
    const state = SBI.state;
    const log = SBI.log || console.log;

    let teacherSelect, termSelect;
    let summaryContainer, breakdownContainer;

    /**
     * Формирует полное имя учителя из строки данных.
     * @param {object} row Строка из state.teachers
     * @returns {string} Полное имя
     */
    function buildTeacherName(row) {
        if (!row) return "Неизвестный учитель";
        const parts = [
            row.last_name   != null ? String(row.last_name).trim()   : "",
            row.first_name  != null ? String(row.first_name).trim()  : "",
            row.middle_name != null ? String(row.middle_name).trim() : ""
        ].filter(Boolean);
        return parts.join(" ") || String(row.teacher_id || "Неизвестный");
    }
    
    /**
     * Возвращает класс по class_id.
     */
    function getClassName(cid) {
        const c = state.classes.find(cl => cl.class_id === cid);
        return c ? (c.class_name || cid) : cid;
    }

    /**
     * Инициализация элементов DOM.
     */
    function init() {
        teacherSelect = document.getElementById("teacherTeacherSelect");
        termSelect    = document.getElementById("teacherTermSelect");
        summaryContainer = document.getElementById("chart-teacher-summary");
        breakdownContainer = document.getElementById("chart-teacher-breakdown");

        if (teacherSelect) teacherSelect.onchange = update;
        if (termSelect)    termSelect.onchange    = update;

        // Первичное заполнение заглушками
        if (summaryContainer) {
            summaryContainer.innerHTML = '<h3>Сводка по успеваемости</h3><p style="color:#666;">Пожалуйста, загрузите данные успеваемости (Excel).</p>';
        }
        log("[TeacherDashboard] init complete");
    }

    /**
     * Заполняет фильтры выбора учителя и четверти.
     */
    function populateFilters() {
        const teachers = state.teachers || [];
        const terms = state.allTerms || [];
        
        if (teacherSelect) {
            teacherSelect.innerHTML = "";
            teachers
                .slice()
                .sort((a, b) => buildTeacherName(a).localeCompare(buildTeacherName(b), "ru"))
                .forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t.teacher_id;
                    opt.textContent = buildTeacherName(t);
                    teacherSelect.appendChild(opt);
                });
        }

        if (termSelect) {
            termSelect.innerHTML = "";
            const optAll = document.createElement("option");
            optAll.value = "ALL";
            optAll.textContent = "Все четверти";
            termSelect.appendChild(optAll);

            terms
                .slice()
                .sort()
                .forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t;
                    opt.textContent = t;
                    termSelect.appendChild(opt);
                });
            termSelect.value = terms.length > 0 ? terms[terms.length - 1] : "ALL"; // Default to latest term
        }
    }

    /**
     * Фильтрует строки оценок по выбранному учителю и четверти.
     */
    function getTeacherRows() {
        const selectedTeacherId = teacherSelect.value;
        const selectedTerm = termSelect.value;
        
        if (!selectedTeacherId) return [];

        // 1. Найти все назначения (teacher_id, class_id, subject_id, term_id) для выбранного учителя
        const teacherAssignments = state.raw.assignments.filter(
            a => a.teacher_id === selectedTeacherId && (selectedTerm === "ALL" || a.term_id === selectedTerm)
        );
        
        // Создать набор ключей: subject_id|class_id|term
        const assignmentKeys = new Set(teacherAssignments.map(a => 
            `${a.subject_id}|${a.class_id}|${a.term_id}`
        ));

        // 2. Отфильтровать allRows, которые соответствуют этим назначениям
        const filteredRows = state.allRows.filter(r => {
            const key = `${r.subject_id}|${r.class_id}|${r.term}`;
            return assignmentKeys.has(key);
        });

        return filteredRows;
    }

    /**
     * Рендерит сводный график успеваемости (Качество знаний и Средний балл).
     */
    function renderSummary(rows) {
        if (!summaryContainer) return;
        
        // Группировка по (предмет x класс)
        const groups = {};
        rows.forEach(r => {
            const key = `${r.subject_id}|${r.class_id}`;
            if (!groups[key]) {
                groups[key] = {
                    subject_id: r.subject_id,
                    class_id: r.class_id,
                    final_5scale: [],
                    final_percent: []
                };
            }
            if (r.final_5scale != null) groups[key].final_5scale.push(r.final_5scale);
            if (r.final_percent != null) groups[key].final_percent.push(r.final_percent);
        });
        
        const labels = [];
        const knowledgeQuality = [];
        const avgMark = [];

        Object.values(groups).forEach(g => {
            const label = `${g.subject_id} (${getClassName(g.class_id)})`;
            labels.push(label);

            const avg5 = SBI.mean(g.final_5scale);
            const quality = g.final_5scale.filter(v => v >= 4).length / g.final_5scale.length;
            
            knowledgeQuality.push(quality * 100 || 0);
            avgMark.push(SBI.mean(g.final_percent) || 0);
        });
        
        const data = [{
            y: labels,
            x: knowledgeQuality,
            name: 'Качество знаний (%)',
            orientation: 'h',
            type: 'bar',
            marker: { color: '#2ecc71' },
            hovertemplate: '%{x:.1f}%<extra></extra>'
        }, {
            y: labels,
            x: avgMark,
            name: 'Средний балл (%)',
            orientation: 'h',
            type: 'bar',
            marker: { color: '#3498db' },
            hovertemplate: '%{x:.1f}%<extra></extra>'
        }];

        Plotly.newPlot(summaryContainer, data, {
            title: `Сводка по успеваемости учителя: ${teacherSelect.options[teacherSelect.selectedIndex].textContent}`,
            barmode: 'group',
            xaxis: { 
                title: 'Показатель (%)', 
                range: [0, 100], 
                tickvals: [0, 25, 50, 75, 100],
                gridcolor: '#e0e0e0'
            },
            yaxis: { 
                automargin: true,
                categoryorder: 'total ascending'
            }
        }, {
            responsive: true,
            displayModeBar: false
        });
    }

    /**
     * Рендерит детализацию оценок по типам работы (ФО, СОР, СОЧ).
     */
    function renderBreakdown(rows) {
        if (!breakdownContainer) return;

        // Группировка по (предмет x класс)
        const groups = {};
        rows.forEach(r => {
            const key = `${r.subject_id}|${r.class_id}`;
            if (!groups[key]) {
                groups[key] = {
                    label: `${r.subject_id} (${getClassName(r.class_id)})`,
                    fo: [],
                    sor: [],
                    soch: []
                };
            }
            if (r.avg_fo != null) groups[key].fo.push(r.avg_fo);
            if (r.avg_sor != null) groups[key].sor.push(r.avg_sor);
            if (r.avg_soch != null) groups[key].soch.push(r.avg_soch);
        });

        const labels = Object.values(groups).map(g => g.label);
        
        const fo_data = Object.values(groups).map(g => SBI.mean(g.fo) || 0);
        const sor_data = Object.values(groups).map(g => SBI.mean(g.sor) || 0);
        const soch_data = Object.values(groups).map(g => SBI.mean(g.soch) || 0);

        const data = [{
            y: labels,
            x: fo_data,
            name: 'Средний ФО (%)',
            orientation: 'h',
            type: 'bar',
            marker: { color: '#f1c40f' },
            hovertemplate: '%{x:.1f}%<extra></extra>'
        }, {
            y: labels,
            x: sor_data,
            name: 'Средний СОР (%)',
            orientation: 'h',
            type: 'bar',
            marker: { color: '#e67e22' },
            hovertemplate: '%{x:.1f}%<extra></extra>'
        }, {
            y: labels,
            x: soch_data,
            name: 'Средний СОЧ (%)',
            orientation: 'h',
            type: 'bar',
            marker: { color: '#e74c3c' },
            hovertemplate: '%{x:.1f}%<extra></extra>'
        }];

        Plotly.newPlot(breakdownContainer, data, {
            title: 'Средние баллы по типам работы (ФО, СОР, СОЧ)',
            barmode: 'stack',
            xaxis: { 
                title: 'Средний балл (%)', 
                range: [0, 100],
                tickvals: [0, 20, 40, 60, 80, 100],
                gridcolor: '#e0e0e0'
            },
            yaxis: { 
                title: 'Предмет и класс',
                automargin: true, // Убедимся, что длинные названия классов влезают
                categoryorder: 'total ascending'
            }
        }, {
            responsive: true,
            displayModeBar: false
        });
    }

    /**
     * Основная функция обновления дашборда.
     */
    function update() {
        if (!state.allRows || !state.allRows.length) {
            log("[TeacherDashboard] Данные еще не загружены.");
            if (summaryContainer) {
                 summaryContainer.innerHTML = '<h3>Сводка по успеваемости</h3><p style="color:#666;">Пожалуйста, загрузите данные успеваемости (Excel).</p>';
            }
            if (breakdownContainer) Plotly.purge(breakdownContainer);
            return;
        }
        
        const filteredRows = getTeacherRows();
        log("[TeacherDashboard] Отфильтровано строк:", filteredRows.length);
        
        if (filteredRows.length === 0) {
            summaryContainer.innerHTML = '<h3>Сводка по успеваемости</h3><p style="color:#666;">По выбранным фильтрам нет данных.</p>';
            if (breakdownContainer) Plotly.purge(breakdownContainer);
            return;
        }
        
        renderSummary(filteredRows);
        renderBreakdown(filteredRows);
    }

    /**
     * Вызывается после загрузки всех данных из Excel.
     */
    function onDataLoaded() {
        if (!state.allRows || !state.allRows.length) {
            log("[TeacherDashboard] onDataLoaded: Нет данных allRows.");
            return;
        }

        populateFilters();
        update();
    }

    // init(); // Removed: init should be called externally

    return {
        init: init, // EXPOSED: Now accessible from index.html
        onDataLoaded: onDataLoaded,
        update: update // Чтобы можно было вызвать из кнопки
    };
})();
