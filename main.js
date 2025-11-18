// ==========================================================
//               MAIN.JS — ИСПРАВЛЕН
// ==========================================================

console.log("JS загружен: main.js");

const fileInput = document.getElementById("excelUpload");

SBI.setStatus("Приложение готово. Загрузите Excel-файл.");
SBI.log("Приложение инициализировано. Ожидается загрузка файла.");

/* ------------------------------------------------------
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
------------------------------------------------------ */

function buildPersonName(row, lastKey = "last_name", firstKey = "first_name", middleKey = "middle_name") {
    if (!row) return "";
    const parts = [
        row[lastKey] != null ? String(row[lastKey]).trim() : "",
        row[firstKey] != null ? String(row[firstKey]).trim() : "",
        row[middleKey] != null ? String(row[middleKey]).trim() : ""
    ].filter(Boolean);
    return parts.join(" ");
}

function buildClassLabel(row) {
    if (!row) return "";
    if (row.class_name) return String(row.class_name).trim();

    const grade = row.grade ?? row.grade_num ?? row.grade_number;
    const section = row.section ?? row.letter ?? row.class_letter;

    if (grade == null && !section) {
        return String(row.class_id || "").trim();
    }
    return String(row.class_id || `K-${grade}${section || ""}`).trim();
}

function extractGradeFromClassRow(cls) {
    // если есть явное поле — используем его
    let g = cls.grade ?? cls.grade_num ?? cls.grade_number;
    if (g != null) return g;

    // иначе пробуем вытащить первую цифру/число из class_name
    const name = cls.class_name || cls.name || "";
    const m = String(name).match(/\d+/);
    if (m) {
        const num = parseInt(m[0], 10);
        if (!Number.isNaN(num)) return num;
    }
    return null;
}

const toNumber = SBI.toNumber;

/* ------------------------------------------------------
   ОБРАБОТКА ЗАГРУЗКИ EXCEL
------------------------------------------------------ */

if (fileInput) {
    fileInput.addEventListener("change", async () => {

        SBI.log("Событие загрузки файла.");
        const file = fileInput.files[0];
        if (!file) {
            SBI.log("Файл не выбран.");
            SBI.setStatus("Файл не выбран.");
            return;
        }

        SBI.log("Выбран файл: " + file.name);
        SBI.setStatus("Чтение Excel-файла…");

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });

        SBI.log("Найденные листы: " + workbook.SheetNames.join(", "));

        const state = SBI.state;
        const sheets = workbook.Sheets;

        function readSheet(name) {
            if (!sheets[name]) {
                SBI.log("⚠️ Лист '" + name + "' не найден.");
                return [];
            }
            const rows = XLSX.utils.sheet_to_json(sheets[name], { defval: null });
            SBI.log("Загружено " + rows.length + " строк из листа '" + name + "'.");
            return rows;
        }

        // ------------- Чтение таблиц -------------
        const studentsRaw    = readSheet("УЧАЩИЕСЯ");
        const classesRaw     = readSheet("КЛАССЫ");
        const subjectsRaw    = readSheet("ПРЕДМЕТЫ");
        const termsRaw       = readSheet("ЧЕТВЕРТИ");
        const teachersRaw    = readSheet("УЧИТЕЛЯ");
        const assignmentsRaw = readSheet("НАЗНАЧЕНИЯ_ПРЕПОД");
        const gradesRaw      = readSheet("ОЦЕНКИ");
        const weightsRaw     = readSheet("ВЕСА_ОЦЕНОК");
        const scaleRaw       = readSheet("ШКАЛА_5Б");
        const termResultsRaw = sheets["ИТОГ_ЧЕТВЕРТИ"] ? readSheet("ИТОГ_ЧЕТВЕРТИ") : [];
        const attendanceRaw  = readSheet("ПОСЕЩАЕМОСТЬ");

        // ------------- Индексы -------------
        const idx_students = {};
        studentsRaw.forEach(r => {
            const id = String(r.student_id || "").trim();
            if (id) idx_students[id] = r;
        });

        const idx_classes = {};
        classesRaw.forEach(r => {
            const id = String(r.class_id || "").trim();
            if (id) idx_classes[id] = r;
        });

        const idx_subjects = {};
        subjectsRaw.forEach(r => {
            const id = String(r.subject_id || "").trim();
            if (id) idx_subjects[id] = r;
        });

        const idx_terms = {};
        termsRaw.forEach(r => {
            const id = String(r.term_id || "").trim();
            if (id) idx_terms[id] = r;
        });

        const idx_teachers = {};
        teachersRaw.forEach(r => {
            const id = String(r.teacher_id || "").trim();
            if (id) idx_teachers[id] = r;
        });

        state.idx_students = idx_students;
        state.idx_classes  = idx_classes;
        state.idx_subjects = idx_subjects;
        state.idx_terms    = idx_terms;
        state.idx_teachers = idx_teachers;

        /* ------------------------------------------------------
           ЧТЕНИЕ ВЕСОВ
        ------------------------------------------------------ */
        function getWeights(subject_id, term_id) {
            const sid = subject_id ? String(subject_id).trim() : "";
            const tid = term_id ? String(term_id).trim() : "";

            const exact = weightsRaw.find(r =>
                String(r.subject_id || "").trim() === sid &&
                String(r.term_id || "").trim() === tid
            );

            const subjOnly = !exact && sid &&
                weightsRaw.find(r =>
                    String(r.subject_id || "").trim() === sid &&
                    !r.term_id
                );

            const termOnly = !exact && !subjOnly && tid &&
                weightsRaw.find(r =>
                    !r.subject_id &&
                    String(r.term_id || "").trim() === tid
                );

            const globalRow = !exact && !subjOnly && !termOnly &&
                weightsRaw.find(r => !r.subject_id && !r.term_id);

            const row = exact || subjOnly || termOnly || globalRow || null;

            const defaults = { w_fo: 25, w_sor: 25, w_soch: 50 };
            if (!row) return defaults;

            return {
                w_fo: toNumber(row.w_fo ?? row.fo_weight) ?? defaults.w_fo,
                w_sor: toNumber(row.w_sor ?? row.sor_weight) ?? defaults.w_sor,
                w_soch: toNumber(row.w_soch ?? row.soch_weight) ?? defaults.w_soch
            };
        }

        /* ------------------------------------------------------
           ШКАЛА 5-БАЛЛЬНОЙ ОЦЕНКИ
        ------------------------------------------------------ */

        const scale = scaleRaw
            .map(r => {
                let min = toNumber(r.min_percent ?? r.threshold ?? r.percent_min);
                if (min == null) return null;
                if (min <= 1) min = min * 100; // 0.7 → 70%

                const grade = toNumber(r.grade_5pt ?? r.grade ?? r.mark);
                if (grade == null) return null;

                return { min, grade };
            })
            .filter(Boolean)
            .sort((a, b) => a.min - b.min);

        function mapPercentTo5pt(pct) {
            const p = toNumber(pct);
            if (p == null) return null;

            let result = null;
            for (let i = 0; i < scale.length; i++) {
                if (p >= scale[i].min) result = scale[i].grade;
            }
            return result;
        }

        function computeKnowledgeQuality(final_5scale) {
            const g = toNumber(final_5scale);
            if (g == null) return null;
            return g >= 4 ? 1 : 0;
        }

        /* ------------------------------------------------------
           ВЫЧИСЛЕНИЕ ЧЕТВЕРТНЫХ ОЦЕНОК
        ------------------------------------------------------ */

        const analyticRows = [];

        // === ВАРИАНТ 1: есть ИТОГ_ЧЕТВЕРТИ ===
        if (termResultsRaw.length) {
            SBI.log("Используем лист ИТОГ_ЧЕТВЕРТИ.");

            termResultsRaw.forEach(r => {

                const student_id = String(r.student_id || "").trim();
                const subject_id = String(r.subject_id || "").trim();
                const term_id    = String(r.term_id    || "").trim();
                const class_id   = String(r.class_id || r.current_class_id || "").trim() || null;

                if (!student_id || !subject_id || !term_id) return;

                const student = idx_students[student_id] || {};
                const cls     = class_id ? (idx_classes[class_id] || {}) : {};
                const subj    = idx_subjects[subject_id] || {};
                const term    = idx_terms[term_id] || {};

                const student_name = buildPersonName(student);
                const class_name   = buildClassLabel(cls);
                const grade_num    = extractGradeFromClassRow(cls);

                const subject_name = String(subj.subject_name || subj.name || subject_id).trim();

                let final_percent = toNumber(r.final_percent);
                if (final_percent != null && final_percent <= 1) {
                    // 0,81 → 81
                    final_percent = final_percent * 100;
                }

                const final_5scale  = toNumber(r.final_5pt) ?? mapPercentTo5pt(final_percent);
                const knowledge_quality = computeKnowledgeQuality(final_5scale);

                analyticRows.push({
                    student_id,
                    student_name,
                    class_id,
                    class: class_name,
                    grade: grade_num,
                    subject_id,
                    subject: subject_name,
                    term_id,
                    term: term_id,
                    final_percent,
                    final_5scale,
                    knowledge_quality
                });
            });
        } else {
            // === ВАРИАНТ 2: считаем из ОЦЕНКИ ===
            SBI.log("Вычисляем четвертные оценки из ОЦЕНКИ.");

            const byTypeKey = {}; // student|subject|term|work_type → []

            gradesRaw.forEach(r => {

                const student_id = String(r.student_id || "").trim();
                const subject_id = String(r.subject_id || "").trim();
                const term_id    = String(r.term_id    || "").trim();
                const work_type  = (r.work_type || "").toString().trim();

                if (!student_id || !subject_id || !term_id || !work_type) return;

                const key = `${student_id}|${subject_id}|${term_id}|${work_type}`;
                if (!byTypeKey[key]) byTypeKey[key] = [];

                let pct = null;

                if (r.percent != null) {
                    let frac = toNumber(r.percent); // 0.81 или 81
                    if (frac != null) {
                        if (frac <= 1) frac = frac * 100;
                        pct = frac;
                    }
                } else if (r.score_percent != null) {
                    pct = toNumber(r.score_percent);
                } else if (r.score != null && r.max_score != null) {
                    const s = toNumber(r.score);
                    const m = toNumber(r.max_score);
                    if (s != null && m) pct = (s / m) * 100;
                }

                if (pct != null) byTypeKey[key].push(pct);
            });

            const perPST = {};

            Object.keys(byTypeKey).forEach(key => {
                const [student_id, subject_id, term_id, rawType] = key.split("|");

                const pstKey = `${student_id}|${subject_id}|${term_id}`;
                if (!perPST[pstKey]) {
                    perPST[pstKey] = {
                        student_id,
                        subject_id,
                        term_id,
                        typeAvgs: {}
                    };
                }

                let t = rawType.toString().trim().toUpperCase();
                if (t === "ФО")  t = "FO";
                if (t === "СОР") t = "SOR";
                if (t === "СОЧ") t = "SOCH";

                const arr = byTypeKey[key];
                const avg = SBI.mean(arr);

                perPST[pstKey].typeAvgs[t] = avg;
            });

            Object.keys(perPST).forEach(pstKey => {

                const item = perPST[pstKey];
                const { student_id, subject_id, term_id, typeAvgs } = item;

                const weights = getWeights(subject_id, term_id);

                const parts = [];
                if (typeAvgs.FO   != null) parts.push({ avg: typeAvgs.FO,   w: weights.w_fo });
                if (typeAvgs.SOR  != null) parts.push({ avg: typeAvgs.SOR,  w: weights.w_sor });
                if (typeAvgs.SOCH != null) parts.push({ avg: typeAvgs.SOCH, w: weights.w_soch });

                if (!parts.length) return;

                const totalW = parts.reduce((s, p) => s + p.w, 0);
                const final_percent =
                    parts.reduce((s, p) => s + p.avg * p.w, 0) / totalW;

                let class_id = null;
                const anyRow = gradesRaw.find(r =>
                    String(r.student_id).trim() === student_id &&
                    String(r.subject_id).trim() === subject_id &&
                    String(r.term_id).trim() === term_id
                );
                if (anyRow) class_id = String(anyRow.class_id || anyRow.current_class_id || "").trim();

                const student = idx_students[student_id] || {};
                const cls     = class_id ? (idx_classes[class_id] || {}) : {};
                const subj    = idx_subjects[subject_id] || {};
                const termObj = idx_terms[term_id] || {};

                const student_name = buildPersonName(student);
                const class_name   = buildClassLabel(cls);
                const grade_num    = extractGradeFromClassRow(cls);
                const subject_name = String(subj.subject_name || subj.name || subject_id).trim();

                const final_5scale = mapPercentTo5pt(final_percent);
                const knowledge_quality = computeKnowledgeQuality(final_5scale);

                analyticRows.push({
                    student_id,
                    student_name,
                    class_id,
                    class: class_name,
                    grade: grade_num,
                    subject_id,
                    subject: subject_name,
                    term_id,
                    term: term_id,
                    final_percent,
                    final_5scale,
                    knowledge_quality
                });
            });
        }

        /* ------------------------------------------------------
           ПОДГОТОВКА ДАННЫХ ПО УЧИТЕЛЯМ
        ------------------------------------------------------ */

        const allTeachers = teachersRaw.map(t => {
            const id = String(t.teacher_id || "").trim();
            const readyName = t.teacher_name && String(t.teacher_name).trim();
            const builtName = buildPersonName(t);
            const name = readyName || builtName || id;
            return {
                ...t,
                teacher_id: id,
                teacher_name: name
            };
        });

        /* ------------------------------------------------------
           ПОСЕЩАЕМОСТЬ
        ------------------------------------------------------ */

        const attendanceProcessed = (attendanceRaw || []).map(r => {
            const student_id = String(r.student_id || "").trim();
            const class_id   = String(r.class_id   || "").trim();
            const term_id    = String(r.term_id    || "").trim();
            const subject_id = String(r.subject_id || "").trim();

            const studentRow   = idx_students[student_id] || {};
            const student_name = buildPersonName(studentRow);

            const total_classes = Number(r.total_classes ?? r.total ?? 0);
            const present_classes = Number(r.present_classes ?? r.present ?? 0);
            const absent_excused_classes   = Number(r.absent_excused_classes   ?? r.absent_excused   ?? 0);
            const absent_unexcused_classes = Number(r.absent_unexcused_classes ?? r.absent_unexcused ?? 0);
            const late_classes = Number(r.late_classes ?? r.late ?? 0);

            return {
                ...r,
                student_id,
                student_name,
                class_id,
                term_id,
                subject_id,
                total_classes,
                present_classes,
                absent_excused_classes,
                absent_unexcused_classes,
                late_classes
            };
        });

        /* ------------------------------------------------------
           СОХРАНЯЕМ ВСЁ В state
        ------------------------------------------------------ */

        state.allRows     = analyticRows;
        state.allTerms    = SBI.unique(analyticRows.map(r => r.term));
        state.allSubjects = SBI.unique(analyticRows.map(r => r.subject));
        state.allClasses  = SBI.unique(analyticRows.map(r => r.class));

        SBI.log("Нормализовано строк (ученик × предмет × четверть): " + analyticRows.length);
        SBI.log("Четверти: " + state.allTerms.join(", "));
        SBI.log("Классы: "  + state.allClasses.join(", "));

        state.students          = studentsRaw;
        state.classesTable      = classesRaw;
        state.subjectsTable     = subjectsRaw;
        state.termsTable        = termsRaw;
        state.teachers          = teachersRaw;
        state.assignments       = assignmentsRaw;

        state.allTeachers        = allTeachers;
        state.teacherAssignments = assignmentsRaw;
        state.idx_subjects       = idx_subjects;

        state.attendanceRows     = attendanceProcessed;

        /* ------------------------------------------------------
           УВЕДОМЛЯЕМ ДАШБОРДЫ
        ------------------------------------------------------ */

        SBI.setStatus("Данные загружены успешно.");

        if (window.SBI_Overview)   SBI_Overview.onDataLoaded();
        if (window.SBI_Class)      SBI_Class.onDataLoaded();
        if (window.SBI_Subject)    SBI_Subject.onDataLoaded();
        if (window.SBI_Teacher)    SBI_Teacher.onDataLoaded();
        if (window.SBI_Attendance) SBI_Attendance.onDataLoaded();
    });
}
