// dashboard_students.js - Students List and Grades View
console.log("DASHBOARD_STUDENTS.JS: Loaded");

window.SBI_Students = (function() {
    // Получение ссылок на глобальные переменные и утилиты
    const SBI = window.SBI;
    // Проверка, что SBI существует, иначе не можем продолжить
    if (!SBI || !SBI.state) {
        console.error("DASHBOARD_STUDENTS: SBI object not found. Data processing will fail.");
        return {};
    }
    const state = SBI.state;
    const log = SBI.log || console.log;

    // DOM Elements
    let classSelect;
    let termSelect;
    let tableContainer;

    // --- HELPER FUNCTIONS ---

    /**
     * Helper: Get Student Full Name
     * @param {string} sid Student ID
     * @returns {string} Full name or ID fallback
     */
    function getStudentName(sid) {
        const s = state.students.find(st => st.student_id === sid);
        if (!s) return sid;
        return `${s.last_name || ""} ${s.first_name || ""}`.trim() || sid;
    }

    /**
     * Helper: Get Subject Name
     * @param {string} subId Subject ID
     * @returns {string} Subject name or ID fallback
     */
    function getSubjectName(subId) {
        const s = state.subjects.find(sub => sub.subject_id === subId);
        return s ? s.subject_name : subId;
    }

    /**
     * Initialization of DOM elements and event listeners.
     */
    function init() {
        // IDs соответствуют элементам, добавленным в index.html
        classSelect = document.getElementById("studentsClassSelect");
        termSelect    = document.getElementById("studentsTermSelect");
        tableContainer = document.getElementById("studentsTableContainer");

        if (classSelect) classSelect.onchange = updateTable;
        if (termSelect)  termSelect.onchange  = updateTable;
        
        if (tableContainer) {
            tableContainer.innerHTML = '<h3 style="margin-top:0;">Успеваемость учеников</h3><p style="color:#666;">Пожалуйста, выберите класс и четверть, или загрузите данные.</p>';
        }
    }

    /**
     * Populates the Class and Term filters based on loaded data.
     */
    function populateFilters() {
        // 1. Фильтр Классов
        if (classSelect) {
            classSelect.innerHTML = '';
            // Сортируем классы
            const classes = state.classes.slice().sort((a,b) => a.class_name.localeCompare(b.class_name, 'kk'));
            
            SBI.unique(classes.map(c => c.class_id)).forEach(cid => {
                const classData = classes.find(c => c.class_id === cid);
                if (classData) {
                    const opt = document.createElement("option");
                    opt.value = cid;
                    opt.textContent = classData.class_name.replace(' сыныбы', '').trim(); // Отображаем '6 «Ә»'
                    classSelect.appendChild(opt);
                }
            });
            if (classes.length > 0) {
                classSelect.value = classes[0].class_id;
            }
        }

        // 2. Фильтр Четвертей
        if (termSelect) {
            termSelect.innerHTML = '';
            const terms = state.allTerms.slice().sort();
            terms.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                termSelect.appendChild(opt);
            });
            if (terms.length > 0) {
                termSelect.value = terms[terms.length - 1]; // Последняя четверть по умолчанию
            }
        }
    }

    /**
     * Main function to filter data and render the student grades table.
     */
    function updateTable() {
        if (!state.allRows || !state.allRows.length || !classSelect || !termSelect || !tableContainer) {
            log("[StudentsDashboard] Data or DOM not ready.");
            return;
        }

        const selectedClassId = classSelect.value;
        const selectedTermId = termSelect.value;

        if (!selectedClassId || !selectedTermId) {
             tableContainer.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Пожалуйста, выберите класс и четверть.</div>';
             return;
        }

        // Фильтруем итоговые оценки по классу и четверти
        const classRows = state.allRows.filter(r => 
            r.class_id === selectedClassId && r.term === selectedTermId
        );
        
        if (classRows.length === 0) {
            tableContainer.innerHTML = '<div style="text-align:center; color:#999; padding:20px;">Нет итоговых оценок для этого класса за выбранную четверть.</div>';
            return;
        }

        // 1. Определяем все предметы в этой выборке
        const subjectIds = SBI.unique(classRows.map(r => r.subject_id)).sort();
        const subjects = subjectIds.map(getSubjectName);

        // 2. Группируем оценки по ученикам
        const gradesByStudent = SBI.groupBy(classRows, r => r.student_id);

        // 3. Подготавливаем данные для таблицы
        const tableData = [];
        for (const studentId in gradesByStudent) {
            const studentGrades = gradesByStudent[studentId];
            const studentName = getStudentName(studentId);
            
            const subjectGradeMap = {};
            const finalGrades5Pt = [];
            
            studentGrades.forEach(gradeRow => {
                subjectGradeMap[gradeRow.subject_id] = gradeRow.final_5scale;
                // Собираем валидные оценки (>0) для среднего балла
                if (gradeRow.final_5scale != null && gradeRow.final_5scale > 0) {
                    finalGrades5Pt.push(gradeRow.final_5scale);
                }
            });

            // Расчет среднего балла
            const avgGrade = SBI.mean(finalGrades5Pt);
            
            tableData.push({
                student_id: studentId,
                student_name: studentName,
                subject_grades: subjectGradeMap,
                avg_grade: avgGrade
            });
        }
        
        // 4. Сортируем по имени
        tableData.sort((a, b) => a.student_name.localeCompare(b.student_name, 'kk'));

        // 5. Строим HTML-таблицу
        let html = '<div style="overflow-x:auto;">';
        html += '<table class="sbi-table" style="min-width: 900px;">';
        
        // Заголовок таблицы
        html += '<thead><tr>';
        html += '<th style="text-align:left; min-width: 150px;">Ученик (ФИ)</th>';
        html += '<th style="text-align:left; min-width: 80px;">ID</th>';
        // Динамические колонки предметов (сокращаем название, если очень длинное)
        subjects.forEach(subjectName => {
            const shortName = subjectName.length > 10 ? subjectName.substring(0, 10) + '...' : subjectName;
            html += `<th title="${subjectName}" style="min-width: 60px;">${shortName}</th>`;
        });
        html += '<th style="min-width: 100px;">Средний балл</th>';
        html += '</tr></thead>';

        // Тело таблицы
        html += '<tbody>';
        tableData.forEach(student => {
            html += '<tr>';
            html += `<td style="text-align:left;"><b>${student.student_name}</b></td>`;
            html += `<td style="font-size:0.9em; text-align:left; color:#777;">${student.student_id}</td>`;
            
            // Оценки по предметам
            subjectIds.forEach(subId => {
                const grade = student.subject_grades[subId];
                const gradeDisplay = grade != null && grade > 0 ? grade.toFixed(0) : '-';
                let style = '';
                
                // Цветовая разметка оценок
                if (grade === 5) style = 'font-weight:bold; color: #2ecc71;'; // Green
                else if (grade === 4) style = 'font-weight:bold; color: #3498db;'; // Blue
                else if (grade === 3) style = 'color: #f1c40f;'; // Yellow
                else if (grade === 2) style = 'font-weight:bold; color: #e74c3c;'; // Red
                
                html += `<td style="${style} text-align:center;">${gradeDisplay}</td>`;
            });

            // Средний балл
            const avgDisplay = student.avg_grade > 0 ? student.avg_grade.toFixed(2) : '-';
            let avgStyle = 'font-weight:bold; text-align:center;';
            
            // Цветовая разметка среднего балла
            if (student.avg_grade >= 4.5) avgStyle += 'color: #2ecc71;'; 
            else if (student.avg_grade >= 3.5) avgStyle += 'color: #3498db;';
            else if (student.avg_grade >= 2.5) avgStyle += 'color: #f1c40f;'; 
            else if (student.avg_grade > 0) avgStyle += 'color: #e74c3c;';
            else avgStyle += 'color:#777;';

            html += `<td style="${avgStyle}">${avgDisplay}</td>`;
            html += '</tr>';
        });
        html += '</tbody>';
        
        html += '</table></div>';
        
        // Добавление информационного футера
         const className = state.classes.find(c => c.class_id === selectedClassId)?.class_name || selectedClassId;
         html += `
            <div style="margin-top:15px; font-size:0.85rem; color:#666;">
                Показаны итоговые оценки (в 5-балльной шкале) для класса <b>${className.replace(' сыныбы', '').trim()}</b> за четверть <b>${selectedTermId}</b>. Средний балл рассчитан как среднее арифметическое итоговых оценок по всем предметам, где есть оценка.
            </div>
        `;

        tableContainer.innerHTML = html;
    }

    /**
     * Called after all data is loaded from Excel.
     */
    function onDataLoaded() {
        if (!state.allRows || !state.allRows.length) {
            log("[StudentsDashboard] onDataLoaded: Нет данных allRows.");
            return;
        }

        populateFilters();
        updateTable();
    }
    
    // Функция обновления (вызывается при переключении страниц)
    function update() {
        // Просто вызываем основную функцию для перерисовки текущего состояния
        updateTable();
    }

    init();

    return {
        onDataLoaded: onDataLoaded,
        update: update
    };
})();
