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
            summaryContainer.innerHTML = '<h3>Сводка по успеваемости</h3><p style="color:#666;">Данные загружаются...</p>';
        }
        if (breakdownContainer) {
            breakdownContainer.innerHTML = '<h3>Средний балл по предметам / классам</h3><p style="color:#666;">Данные загружаются...</p>';
        }

        log("[TeacherDashboard] init complete");
    }

    /**
     * Заполняет фильтры (Учитель, Четверть).
     */
    function populateFilters() {
        const rows = state.allRows || [];
        const teachers = state.teachers || [];
        const terms = state.allTerms || [];

        if (!rows.length) return;

        // 1. Учителя
        if (teacherSelect) {
            teacherSelect.innerHTML = "";
            const sortedTeachers = [...teachers].sort((a, b) => {
                return buildTeacherName(a).localeCompare(buildTeacherName(b), "ru");
            });

            sortedTeachers.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t.teacher_id;
                opt.textContent = buildTeacherName(t);
                teacherSelect.appendChild(opt);
            });
            // Выбираем первого учителя по умолчанию
            if (sortedTeachers.length) {
                 teacherSelect.value = sortedTeachers[0].teacher_id;
            }
        }

        // 2. Четверти
        if (termSelect) {
            termSelect.innerHTML = "";
            const sortedTerms = [...terms].sort(); // Сортируем по ID четверти

            // Добавляем опцию "Все четверти"
            const optAll = document.createElement("option");
            optAll.value = "";
            optAll.textContent = "Все четверти";
            termSelect.appendChild(optAll);

            sortedTerms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                termSelect.appendChild(opt);
            });
            // Выбираем последнюю четверть по умолчанию
            if (sortedTerms.length) {
                termSelect.value = sortedTerms[sortedTerms.length - 1];
            } else {
                termSelect.value = "";
            }
        }
    }

    /**
     * Получает строки оценок, относящиеся к выбранному учителю и четверти.
     * Это ключевая функция, выполняющая JOIN.
     * @returns {Array} Отфильтрованные строки оценок.
     */
    function getTeacherRows() {
        const selectedTeacherId = teacherSelect ? teacherSelect.value : null;
        const selectedTermId = termSelect ? termSelect.value : null;

        if (!selectedTeacherId) {
            log("[TeacherDashboard] Не выбран учитель.");
            return [];
        }

        const allRows = state.allRows || [];
        const assignments = state.teacherAssignments || [];

        // 1. Находим все курсы, которые вел этот учитель в выбранной четверти
        const taughtKeys = new Set(); // Set of "subject|class|term"
        assignments.forEach(a => {
            if (a.teacher_id === selectedTeacherId) {
                if (!selectedTermId || a.term_id === selectedTermId) {
                    const key = `${a.subject_id}|${a.class_id}|${a.term_id}`;
                    taughtKeys.add(key);
                }
            }
        });

        if (taughtKeys.size === 0) {
            log(`[TeacherDashboard] Не найдено назначений для учителя ${selectedTeacherId} в четверти ${selectedTermId || 'Все'}.`);
            return [];
        }

        // 2. Фильтруем все оценки по найденным курсам
        const filteredRows = allRows.filter(r => {
            const key = `${r.subject}|${r.class}|${r.term}`;
            return taughtKeys.has(key);
        });

        return filteredRows;
    }

    /**
     * Рендеринг сводной таблицы.
     * @param {Array} rows Отфильтрованные строки оценок.
     */
    function renderSummary(rows) {
        if (!summaryContainer) return;
        
        if (rows.length === 0) {
            summaryContainer.innerHTML = `
                <h3>Сводка по успеваемости</h3>
                <p style="color:#e94c3d; font-weight: 500;">
                    Для выбранного учителя и четверти не найдено данных об оценках.
                </p>
            `;
            return;
        }

        const avgScore = SBI.mean(rows.map(r => SBI.toNumber(r.final_5scale)).filter(v => v != null));
        const knowledgeRatio = SBI.knowledgeRatio(rows);
        const totalRecords = rows.length;

        const teacherRow = (state.teachers || []).find(t => t.teacher_id === teacherSelect.value);
        const teacherName = buildTeacherName(teacherRow);

        summaryContainer.innerHTML = `
            <h3>Сводка по успеваемости</h3>
            <p><strong>Учитель:</strong> ${teacherName}</p>
            <p><strong>Четверть:</strong> ${termSelect.value || 'Все'}</p>
            
            <table class="data-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">Показатель</th>
                        <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: right;">Значение</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">Средний балл (5-балльная)</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">
                            ${avgScore != null ? avgScore.toFixed(2) : 'Н/Д'}
                        </td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">Качество знаний (доля 4 и 5)</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">
                            ${knowledgeRatio != null ? (knowledgeRatio * 100).toFixed(1) + '%' : 'Н/Д'}
                        </td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">Всего оценок (строк)</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalRecords}</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    /**
     * Рендеринг графика разбивки по предметам/классам.
     * @param {Array} rows Отфильтрованные строки оценок.
     */
    function renderBreakdown(rows) {
        if (!breakdownContainer) return;

        if (rows.length === 0) {
            Plotly.purge(breakdownContainer);
            return;
        }
        
        // Группируем по комбинации Предмет + Класс
        const bySubjectClass = SBI.groupBy(
            rows, 
            r => `${r.subject} (${r.class})`,
            r => SBI.toNumber(r.final_5scale)
        );

        const keys = Object.keys(bySubjectClass);
        const avgScores = keys.map(k => {
            const scores = bySubjectClass[k].filter(v => v != null);
            return SBI.mean(scores);
        });
        
        // Создаем массив объектов для сортировки
        const dataForSort = keys.map((key, index) => ({
            key: key,
            avg: avgScores[index]
        })).filter(d => d.avg != null);

        // Сортируем от худшего к лучшему
        dataForSort.sort((a, b) => a.avg - b.avg);

        const sortedKeys = dataForSort.map(d => d.key);
        const sortedScores = dataForSort.map(d => d.avg);


        Plotly.newPlot(breakdownContainer, [{
            x: sortedScores,
            y: sortedKeys,
            type: 'bar',
            orientation: 'h',
            marker: {
                color: sortedScores.map(score => {
                    if (score >= 4.5) return 'rgb(34, 139, 34)'; // Зеленый (отлично)
                    if (score >= 3.5) return 'rgb(255, 165, 0)'; // Оранжевый (хорошо)
                    return 'rgb(220, 20, 60)'; // Красный (ниже среднего)
                })
            }
        }], {
            title: 'Средний балл по преподаваемым курсам',
            margin: { l: 150, r: 20, t: 50, b: 50 },
            xaxis: { 
                title: 'Средний балл (5-балльная)', 
                range: [1.5, 5],
                tickvals: [2, 3, 4, 5],
                gridcolor: '#e0e0e0'
            },
            yaxis: { 
                title: 'Предмет и класс',
                automargin: true // Убедимся, что длинные названия классов влезают
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

    init();

    return {
        onDataLoaded: onDataLoaded,
        update: update // Чтобы можно было вызвать из кнопки
    };
})();
