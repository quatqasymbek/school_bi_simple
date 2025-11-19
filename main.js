// main.js - Data Loading and Processing Core
console.log("MAIN.JS: Initializing...");

// ==========================================\
// ГЛОБАЛЬНЫЙ ОБЪЕКТ И СОСТОЯНИЕ
// ==========================================\
window.SBI = window.SBI || {};
const SBI = window.SBI;

SBI.state = {
    allRows: [], // Итоговые оценки (по студенту/предмету/четверти)
    allTerms: [], // Список всех четвертей
    students: [],
    teachers: [], 
    teacherQuals: [], 
    assignments: [], 
    classes: [],
    subjects: [],
    terms: [],
    attendanceRows: [],
    weights: {}, // Веса оценок
    gradingScale: [] // Шкала перевода в 5-балльную систему
};

// ==========================================\
// 2. DATA PROCESSING HELPERS (Из utils.js)
// NOTE: Предполагаем, что utils.js подключен и содержит mean, unique, groupBy.
// ==========================================\

function parsePercent(val) {
    if (val == null || val === "") return null;
    let s = String(val).replace(",", ".").replace("%", "").trim();
    let n = parseFloat(s);
    if (isNaN(n)) return null;
    // Если число меньше или равно 1, считаем его долей и переводим в %
    if (n <= 1.0 && n > 0) return n * 100; 
    return n;
}

function convertTo5Scale(score, scaleRules) {
    if (score == null) return null;
    if (!scaleRules || scaleRules.length === 0) {
        // Дефолтная шкала (если файл ШКАЛА_5Б.csv не загружен или пуст)
        if (score >= 85) return 5;
        if (score >= 70) return 4;
        if (score >= 55) return 3;
        if (score >= 0) return 2;
        return null;
    }
    // Используем загруженную шкалу
    for (let rule of scaleRules) {
        if (score >= rule.pct_min && score <= rule.pct_max) {
            return rule.grade_5pt;
        }
    }
    return null;
}

// ==========================================\
// 3. DATA LOADING AND PARSING
// ==========================================\

/**
 * Loads and parses the uploaded CSV files.
 * @param {FileList} files - List of files uploaded by the user.
 */
SBI.loadData = function(files) {
    if (files.length === 0) return;

    // Сброс состояния
    Object.keys(SBI.state).forEach(key => {
        if (Array.isArray(SBI.state[key])) {
            SBI.state[key] = [];
        } else if (typeof SBI.state[key] === 'object' && key !== 'weights') {
            SBI.state[key] = {};
        }
    });
    SBI.state.allRows = [];

    let fileCount = files.length;
    let filesProcessed = 0;
    const allData = {};

    function fileLoaded(fileName, data) {
        filesProcessed++;
        
        // Преобразование имени файла в ключ состояния (убираем префикс и .csv)
        let key = fileName.split(' - ')[1].replace('.csv', '').replace('example_excel.xlsx ', '').replace('«', '').replace('»', '').replace(/[\s\W]+/g, '_').toUpperCase();
        
        if (key.includes('УЧАЩИЕСЯ')) key = 'STUDENTS';
        else if (key.includes('УЧИТЕЛЯ')) key = 'TEACHERS';
        else if (key.includes('КЛАССЫ')) key = 'CLASSES';
        else if (key.includes('ПРЕДМЕТЫ')) key = 'SUBJECTS';
        else if (key.includes('ЧЕТВЕРТИ')) key = 'TERMS';
        else if (key.includes('ОЦЕНКИ')) key = 'GRADES';
        else if (key.includes('ВЕСА_ОЦЕНОК')) key = 'WEIGHTS';
        else if (key.includes('ШКАЛА_5Б')) key = 'GRADING_SCALE';
        else if (key.includes('ПОСЕЩАЕМОСТЬ')) key = 'ATTENDANCE';
        else if (key.includes('СОСТАВ_КЛАССА')) key = 'CLASS_ENROLLMENT';
        else if (key.includes('НАЗНАЧЕНИЯ_ПРЕПОД')) key = 'ASSIGNMENTS';
        else if (key.includes('TEACHER_QUALS')) key = 'TEACHER_QUALS';

        allData[key] = data;

        if (filesProcessed === fileCount) {
            console.log("All files loaded. Starting processing.");
            SBI.processData(allData);
        }
    }

    // Использование PapaParse для чтения CSV
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = Papa.parse(event.target.result, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
            });
            fileLoaded(file.name, result.data);
        };
        reader.readAsText(file);
    });
};

// ==========================================\
// 4. DATA TRANSFORMATION AND CALCULATION
// ==========================================\

/**
 * Processes raw data to calculate final term grades.
 * @param {object} rawData - Parsed data from all CSV files.
 */
SBI.processData = function(rawData) {
    console.log("Starting data processing...");
    
    // --- 1. Load Reference Data ---
    SBI.state.students = rawData.STUDENTS || [];
    SBI.state.teachers = rawData.TEACHERS || [];
    SBI.state.classes = rawData.CLASSES || [];
    SBI.state.subjects = rawData.SUBJECTS || [];
    SBI.state.terms = rawData.TERMS || [];
    SBI.state.attendanceRows = rawData.ATTENDANCE || [];
    SBI.state.teacherQuals = rawData.TEACHER_QUALS || [];
    SBI.state.assignments = rawData.ASSIGNMENTS || [];
    SBI.state.gradingScale = (rawData.GRADING_SCALE || []).map(r => ({
        grade_5pt: r.grade_5pt,
        min: r.pct_min, // Используем более понятные имена
        max: r.pct_max
    }));

    // --- 2. Process Weights ---
    const rawWeights = rawData.WEIGHTS || [];
    rawWeights.forEach(row => {
        // Предполагаем, что нам нужны только веса по типу работы (ФО, СОР, СОЧ)
        if (row.scope === 'overall' && row.work_type) {
            SBI.state.weights[row.work_type] = parsePercent(row.weight_pct) / 100;
        }
    });

    const grades = rawData.GRADES || [];
    const scaleRules = SBI.state.gradingScale;
    const weights = SBI.state.weights;
    const finalRows = [];

    // --- 3. Group Raw Grades ---
    // Группируем по: Ученик ID, Предмет ID, Четверть (для расчета итоговой)
    const groupedByFinalGradeKey = SBI.groupBy(grades, r => `${r.student_id}|${r.subject_id}|${r.term_id}|${r.class_id}`);
    
    // --- 4. Calculate Final Term Grades ---
    Object.keys(groupedByFinalGradeKey).forEach(key => {
        const group = groupedByFinalGradeKey[key];
        // Берем данные из первой строки группы
        const firstRow = group[0];
        const groupKeyParts = key.split('|');
        
        const calculationGroup = {
            sid: groupKeyParts[0],
            sub: groupKeyParts[1],
            term: groupKeyParts[2],
            class_id: groupKeyParts[3],
            // Инициализируем сумму взвешенных процентов
            weightedSum: 0, 
            totalWeight: 0
        };

        // Группируем оценки внутри четверти по типу работы (ФО, СОР, СОЧ)
        const gradesByWorkType = SBI.groupBy(group, r => r.work_type);

        Object.keys(gradesByWorkType).forEach(workType => {
            const workTypeGrades = gradesByWorkType[workType];
            const weight = weights[workType] || 0; // Получаем вес для данного типа работы
            
            if (weight > 0) {
                // Берем все оценки (в процентах) для данного типа работы
                const percents = workTypeGrades.map(r => parsePercent(r.percent)).filter(n => n != null);
                
                if (percents.length > 0) {
                    // Рассчитываем средний процент для данного типа работы
                    const avgPercent = SBI.mean(percents); 
                    
                    // Добавляем взвешенный результат к общей сумме
                    calculationGroup.weightedSum += avgPercent * weight;
                    calculationGroup.totalWeight += weight;
                }
            }
        });
        
        let totalPct = null;
        if (calculationGroup.totalWeight > 0) {
            // Итоговый процент = Взвешенная сумма / Общий вес (должен быть 1.0, но может отличаться)
            totalPct = calculationGroup.weightedSum / calculationGroup.totalWeight;
        }

        // Переводим итоговый процент в 5-балльную шкалу
        const grade5 = convertTo5Scale(totalPct, scaleRules);

        // Добавляем итоговую строку
        finalRows.push({
            student_id: calculationGroup.sid,
            subject_id: calculationGroup.sub,
            term: calculationGroup.term, 
            class_id: calculationGroup.class_id,
            final_percent: totalPct,
            final_5scale: grade5
        });
    });

    SBI.state.allRows = finalRows;
    // Сбор уникальных четвертей для фильтров
    SBI.state.allTerms = SBI.unique(finalRows.map(r => r.term));
    
    console.log(`Data Processed: ${finalRows.length} rows, ${SBI.state.classes.length} classes, ${SBI.state.teachers.length} teachers.`);


    // --- 5. NOTIFY MODULES ---
    // Вызов onDataLoaded() для всех дашбордов, включая новый "Ученики"
    if (window.SBI_Overview && SBI_Overview.onDataLoaded) SBI_Overview.onDataLoaded();
    if (window.SBI_Class && SBI_Class.onDataLoaded) SBI_Class.onDataLoaded();
    if (window.SBI_Teacher && SBI_Teacher.onDataLoaded) SBI_Teacher.onDataLoaded();
    if (window.SBI_Attendance && SBI_Attendance.onDataLoaded) SBI_Attendance.onDataLoaded();
    // НОВЫЙ МОДУЛЬ:
    if (window.SBI_Students && SBI_Students.onDataLoaded) SBI_Students.onDataLoaded(); 
};

// ==========================================\
// 5. INITIALIZATION
// ==========================================\

document.addEventListener('DOMContentLoaded', () => {
    // 1. Настройка загрузчика файлов
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    input.id = 'fileLoader';
    input.addEventListener('change', (e) => SBI.loadData(e.target.files));
    document.body.appendChild(input);

    const header = document.querySelector('header div:last-child');
    const oldBtn = document.getElementById('uploadBtn');
    if(oldBtn) oldBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'uploadBtn';
    btn.innerText = '📂 Загрузить Excel';
    btn.style.background = 'rgba(255,255,255,0.2)';
    btn.style.border = '1px solid rgba(255,255,255,0.4)';
    btn.style.borderRadius = '5px';
    btn.style.padding = '8px 15px';
    btn.style.cursor = 'pointer';
    btn.style.color = '#fff';
    btn.style.marginLeft = '10px';
    btn.style.transition = 'background 0.3s';
    btn.onclick = () => document.getElementById('fileLoader').click();
    
    if (header) {
        header.appendChild(btn);
    }
    
    // 2. Настройка навигации
    const navButtons = document.querySelectorAll('.nav-button');
    const pages = document.querySelectorAll('.page-content');
    
    function showPage(pageId) {
        pages.forEach(page => {
            page.style.display = page.id === pageId ? 'block' : 'none';
        });
        navButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === pageId);
        });
        // При переключении страницы, если дашборд имеет функцию update, вызываем ее
        const pageModule = `SBI_${pageId.replace('-page-content', '').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;
        if (window[pageModule] && window[pageModule].update) {
            window[pageModule].update();
        }
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            showPage(btn.dataset.page);
        });
    });

    // Показать домашнюю страницу при загрузке (или 'overview-page-content' если он существует)
    const defaultPage = document.getElementById('students-page-content') ? 'students-page-content' : 'overview-page-content';
    if(document.getElementById(defaultPage)) {
        showPage(defaultPage);
    }
});
