// main.js
console.log("JS загружен: main.js");

const fileInput = document.getElementById("excelUpload");

SBI.setStatus("Приложение готово. Загрузите Excel-файл.");
SBI.log("Приложение инициализировано. Ожидается загрузка файла.");

/* --------- Вспомогательные функции --------- */

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

/* --------- Обработка загрузки Excel --------- */

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

        // 1. Чтение основных таблиц
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

        if (!gradesRaw.length && !termResultsRaw.length) {
            SBI.setStatus("❌ Нет данных в листах ОЦЕНКИ или ИТОГ_ЧЕТВЕРТИ. Нечего анализировать.");
            return;
        }

        // 2. Индексы для связей
        const idx_students = {};
        studentsRaw.forEach(r => {
            const id = String(r.student_id || "").trim();
            if (!id) return;
            idx_students[id] = r;
        });

        const idx_classes = {};
        classesRaw.forEach(r => {
            const id = String(r.class_id || "").trim();
            if (!id) return;
            idx_classes[id] = r;
        });

        const idx_subjects = {};
        subjectsRaw.forEach(r => {
            const id = String(r.subject_id || "").trim();
            if (!id) return;
            idx_subjects[id] = r;
        });

        const idx_terms = {};
        termsRaw.forEach(r => {
            const id = String(r.term_id || "").trim();
            if (!id) return;
            idx_terms[id] = r;
        });

        const idx_teachers = {};
        teachersRaw.forEach(r => {
            const id = String(r.teacher_id || "").trim();
            if (!id) return;
            idx_teachers[id] = r;
        });

        // 3. Веса оценок
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
                w_fo: Number(row.w_fo ?? row.fo_weight ?? defaults.w_fo),
                w_sor: Number(row.w_sor ?? row.sor_weight ?? defaults.w_sor),
                w_soch: Number(row.w_soch ?? row.soch_weight ?? defaults.w_soch)
            };
        }

        // 4. Шкала 5-балльной системы
        const scale = scaleRaw
            .map(r => ({
                min: Number(r.min_percent ?? r.threshold ?? 0),
                grade: Number(r.grade_5pt ?? r.grade ?? r.mark ?? null)
            }))
            .filter(r => !Number.isNaN(r.min) && r.grade != null)
            .sort((a, b) => a.min - b.min);

        function mapPercentTo5pt(pct) {
            if (pct == null || Number.isNaN(pct)) return null;
            let result = null;
            for (let i = 0; i < scale.length; i++) {
                if (pct >= scale[i].min) {
                    result = scale[i].grade;
                }
            }
            return result;
        }

        // 5. Формирование агрегированных строк (ученик × предмет × четверть)
        const analyticRows = [];

        if (termResultsRaw.length) {
            SBI.log("Используем лист ИТОГ_ЧЕТВЕРТИ как источник четвертных оценок.");

            termResultsRaw.forEach(r => {
                const student_id = String(r.student_id || "").trim();
                const subject_id = String(r.subject_id || "").trim();
                const term_id = String(r.term_id || "").trim();
                const class_id = String(r.class_id || r.current_class_id || "").trim() || null;

                if (!student_id || !subject_id || !term_id) return;

                const student = idx_students[student_id] || {};
                const cls = class_id ? (idx_classes[class_id] || {}) : {};
                const subj = idx_subjects[subject_id] || {};
                const term = idx_terms[term_id] || {};

                const student_name = buildPersonName(student);
                const class_name = buildClassLabel(cls);
                const subject_name = String(subj.subject_name || subj.name || subject_id).trim();
                const term_name = String(term.term_id || term.name || term_id).trim();
                const grade_num = cls.grade ?? cls.grade_num ?? cls.grade_number ?? null;

                const final_percent = r.final_percent != null ? Number(r.final_percent) : null;
                const final_5scale =
                    r.final_5pt     != null ? Number(r.final_5pt) :
                    r.final_5scale  != null ? Number(r.final_5scale) :
                    mapPercentTo5pt(final_percent);

                const knowledge_quality =
                    final_5scale != null ? (final_5scale >= 4 ? 1 : 0) : null;

                analyticRows.push({
                    student_id,
                    student_name,
                    class_id,
                    class: class_name,
                    grade: grade_num,
                    subject_id,
                    subject: subject_name,
                    term_id,
                    term: term_name,
                    final_percent,
                    final_5scale,
                    knowledge_quality
                });
            });
        } else {
            SBI.log("Вычисляем четвертные оценки из ОЦЕНКИ + ВЕСА_ОЦЕНОК + ШКАЛА_5Б.");

            const byTypeKey = {}; // s|subj|term|type → [percent]

            gradesRaw.forEach(r => {
                const student_id = String(r.student_id || "").trim();
                const subject_id = String(r.subject_id || "").trim();
                const term_id    = String(r.term_id    || "").trim();
                const work_type  = String(r.work_type  || "").trim();

                if (!student_id || !subject_id || !term_id || !work_type) return;

                const key = student_id + "|" + subject_id + "|" + term_id + "|" + work_type;
                if (!byTypeKey[key]) byTypeKey[key] = [];

                const pct = r.percent != null
                    ? Number(r.percent)
                    : (r.score_percent != null ? Number(r.score_percent) : null);

                if (pct != null && !Number.isNaN(pct)) {
                    byTypeKey[key].push(pct);
                }
            });

            const perPST = {}; // s|subj|term → { student_id, subject_id, term_id, typeAvgs }

            Object.keys(byTypeKey).forEach(key => {
                const parts = key.split("|");
                const student_id = parts[0];
                const subject_id = parts[1];
                const term_id = parts[2];
                const rawType = parts[3];

                const pstKey = student_id + "|" + subject_id + "|" + term_id;
                if (!perPST[pstKey]) {
                    perPST[pstKey] = {
                        student_id: student_id,
                        subject_id: subject_id,
                        term_id: term_id,
                        typeAvgs: {}
                    };
                }

                const arr = byTypeKey[key];
                const avg = SBI.mean(arr);
                let t = rawType.toUpperCase();

                if (t === "ФО" || t === "FO") t = "FO";
                if (t === "СОР" || t === "SOR" || t === "SAU") t = "SOR";
                if (t === "СОЧ" || t === "SOCH" || t === "SAT") t = "SOCH";

                perPST[pstKey].typeAvgs[t] = avg;
            });

            Object.keys(perPST).forEach(pstKey => {
                const item = perPST[pstKey];
                const student_id = item.student_id;
                const subject_id = item.subject_id;
                const term_id = item.term_id;
                const typeAvgs = item.typeAvgs;

                const weights = getWeights(subject_id, term_id);
                const partsArr = [];
                if (typeAvgs.FO   != null) partsArr.push({ avg: typeAvgs.FO,   w: weights.w_fo   });
                if (typeAvgs.SOR  != null) partsArr.push({ avg: typeAvgs.SOR,  w: weights.w_sor  });
                if (typeAvgs.SOCH != null) partsArr.push({ avg: typeAvgs.SOCH, w: weights.w_soch });

                if (!partsArr.length) return;

                const totalW = partsArr.reduce((s, p) => s + p.w, 0) || 1;
                const final_percent = partsArr.reduce((s, p) => s + p.avg * p.w, 0) / totalW;

                let class_id = null;
                const anyGradeRow = gradesRaw.find(r =>
                    String(r.student_id || "").trim() === student_id &&
                    String(r.subject_id || "").trim() === subject_id &&
                    String(r.term_id    || "").trim() === term_id
                );
                if (anyGradeRow) {
                    class_id = String(anyGradeRow.class_id || anyGradeRow.current_class_id || "").trim() || null;
                }

                const student = idx_students[student_id] || {};
                const cls     = class_id ? (idx_classes[class_id] || {}) : {};
                const subj    = idx_subjects[subject_id] || {};
                const term    = idx_terms[term_id] || {};

                const student_name = buildPersonName(student);
                const class_name   = buildClassLabel(cls);
                const subject_name = String(subj.subject_name || subj.name || subject_id).trim();
                const term_name    = String(term.term_id || term.name || term_id).trim();
                const grade_num    = cls.grade ?? cls.grade_num ?? cls.grade_number ?? null;

                const final_5scale      = mapPercentTo5pt(final_percent);
                const knowledge_quality = final_5scale != null ? (final_5scale >= 4 ? 1 : 0) : null;

                analyticRows.push({
                    student_id,
                    student_name,
                    class_id,
                    class: class_name,
                    grade: grade_num,
                    subject_id,
                    subject: subject_name,
                    term_id,
                    term: term_name,
                    final_percent,
                    final_5scale,
                    knowledge_quality
                });
            });
        }

        // 6. Запись в глобальное состояние
        state.allRows     = analyticRows;
        state.allTerms    = SBI.unique(analyticRows.map(r => r.term));
        state.allSubjects = SBI.unique(analyticRows.map(r => r.subject));
        state.allClasses  = SBI.unique(analyticRows.map(r => r.class));

        SBI.log("Нормализованных строк (ученик × предмет × четверть): " + state.allRows.length);
        SBI.log("Четверти: " + state.allTerms.join(", "));
        SBI.log("Предметы: " + state.allSubjects.join(", "));
        SBI.log("Классы: " + state.allClasses.join(", "));

        state.students      = studentsRaw;
        state.classesTable  = classesRaw;
        state.subjectsTable = subjectsRaw;
        state.termsTable    = termsRaw;
        state.teachers      = teachersRaw;
        state.assignments   = assignmentsRaw;

        state.idx_students  = idx_students;
        state.idx_classes   = idx_classes;
        state.idx_subjects  = idx_subjects;
        state.idx_terms     = idx_terms;
        state.idx_teachers  = idx_teachers;

        // Учителя
        state.allTeachers = teachersRaw
            .map(t => {
                const id = String(t.teacher_id || "").trim();
                if (!id) return null;

                const name =
                    buildPersonName(t, "last_name", "first_name", "middle_name") ||
                    String(t.teacher_name || t.name || id).trim();

                return {
                    teacher_id: id,
                    teacher_name: name,
                    qualification_code: t.qualification_code,
                    qualification_rank: t.qualification_rank
                };
            })
            .filter(Boolean);

        state.teacherAssignments = assignmentsRaw;

        SBI.log("Учителей загружено: " + state.allTeachers.length);
        SBI.log("Назначений учителей: " + state.teacherAssignments.length);

        state.gradesRaw = gradesRaw;

        // 7. Посещаемость
        state.attendanceRows = [];
        state.attendanceTerms = [];
        state.attendanceClasses = [];

        const studentNameById = {};
        (state.allRows || []).forEach(r => {
            const sid = (r.student_id || "").toString().trim();
            const nm  = (r.student_name || "").toString().trim();
            if (sid && nm && !studentNameById[sid]) {
                studentNameById[sid] = nm;
            }
        });

        function findSheetNameInsensitive(candidates) {
            const names = workbook.SheetNames || [];
            const upperCandidates = candidates.map(c => c.toUpperCase());
            for (let i = 0; i < names.length; i++) {
                const n = names[i];
                if (upperCandidates.includes(n.toString().trim().toUpperCase())) {
                    return n;
                }
            }
            return null;
        }

        const attSheetName = findSheetNameInsensitive([
            "Посещаемость",
            "ПОСЕЩАЕМОСТЬ",
            "ATTENDANCE"
        ]);

        if (attSheetName && workbook.Sheets[attSheetName]) {
            const rawAtt = XLSX.utils.sheet_to_json(
                workbook.Sheets[attSheetName],
                { defval: null }
            );

            state.attendanceRows = rawAtt.map(r => {
                const student_id = (r.student_id || "").toString().trim();
                const class_id   = (r.class_id   || "").toString().trim();
                const term_id    = (r.term_id    || "").toString().trim();

                return {
                    attendance_id: (r.attendance_id || "").toString().trim(),
                    student_id,
                    student_name: studentNameById[student_id] || "",
                    subject_id: (r.subject_id || "").toString().trim(),
                    teacher_id: (r.teacher_id || "").toString().trim(),
                    class_id,
                    term_id,
                    total_classes: Number(r.total_classes ?? 0),
                    present_classes: Number(r.present_classes ?? 0),
                    absent_excused_classes: Number(r.absent_excused_classes ?? 0),
                    absent_unexcused_classes: Number(r.absent_unexcused_classes ?? 0),
                    late_classes: Number(r.late_classes ?? 0)
                };
            });

            state.attendanceTerms = SBI.unique(
                state.attendanceRows.map(r => r.term_id)
            );
            state.attendanceClasses = SBI.unique(
                state.attendanceRows.map(r => r.class_id)
            );

            SBI.log("Строк посещаемости загружено из '" + attSheetName + "': " +
                state.attendanceRows.length);
        } else {
            SBI.log("⚠️ Лист посещаемости не найден (Посещаемость/ПОСЕЩАЕМОСТЬ/ATTENDANCE).");
        }

        SBI.setStatus("Данные загружены успешно.");

        // 8. Уведомление дашбордов
        if (window.SBI_Overview)  SBI_Overview.onDataLoaded();
        if (window.SBI_Class)     SBI_Class.onDataLoaded();
        if (window.SBI_Subject)   SBI_Subject.onDataLoaded();
        if (window.SBI_Teacher)   SBI_Teacher.onDataLoaded();
        if (window.SBI_Attendance)SBI_Attendance.onDataLoaded();
        if (window.SBI_Trends)    SBI_Trends.onDataLoaded();
    });
}
