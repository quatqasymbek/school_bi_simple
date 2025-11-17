    /* ===========================================
       ATTENDANCE (Посещаемость)
    ========================================== */
    state.attendanceRows = [];
    state.attendanceTerms = [];
    state.attendanceClasses = [];

    // Build helper: student_id → name from ASSESSMENTS (if present)
    const studentNameById = {};
    (state.allRows || []).forEach(r => {
        const sid = (r.student_id || "").toString().trim();
        const nm = (r.student_name || "").toString().trim();
        if (sid && nm && !studentNameById[sid]) {
            studentNameById[sid] = nm;
        }
    });

    if (workbook.Sheets["Посещаемость"]) {
        const rawAtt = XLSX.utils.sheet_to_json(
            workbook.Sheets["Посещаемость"],
            { defval: null }
        );

        state.attendanceRows = rawAtt.map(r => {
            const student_id = (r.student_id || "").toString().trim();
            const class_id = (r.class_id || "").toString().trim();
            const term_id = (r.term_id || "").toString().trim();

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

        SBI.log("Attendance rows loaded from 'Посещаемость': " +
            state.attendanceRows.length);
    } else if (workbook.Sheets["ATTENDANCE"]) {
        // Fallback for old template
        const rawAtt = XLSX.utils.sheet_to_json(
            workbook.Sheets["ATTENDANCE"],
            { defval: null }
        );

        state.attendanceRows = rawAtt.map(r => ({
            term_id: String(r.term || "").trim(),
            class_id: String(r.class || "").trim(),
            total_classes: Number(r.total_classes ?? 0),
            present_classes: Number(r.present_classes ?? 0),
            absent_excused_classes: Number(r.absent_excused_classes ?? 0),
            absent_unexcused_classes: Number(r.absent_unexcused_classes ?? 0),
            late_classes: Number(r.late_classes ?? 0)
        }));

        state.attendanceTerms = SBI.unique(
            state.attendanceRows.map(r => r.term_id)
        );
        state.attendanceClasses = SBI.unique(
            state.attendanceRows.map(r => r.class_id)
        );

        SBI.log("Attendance rows loaded from 'ATTENDANCE': " +
            state.attendanceRows.length);
    } else {
        SBI.log("⚠️ Посещаемость / ATTENDANCE sheet not found (attendance dashboard will be empty).");
    }

    SBI.setStatus("Data loaded successfully.");

    /* ===========================================
       Notify dashboards
    ========================================== */
    if (window.SBI_Overview) SBI_Overview.onDataLoaded();
    if (window.SBI_Class) SBI_Class.onDataLoaded();
    if (window.SBI_Subject) SBI_Subject.onDataLoaded();
    if (window.SBI_Teacher) SBI_Teacher.onDataLoaded();
    if (window.SBI_Attendance) SBI_Attendance.onDataLoaded();
    if (window.SBI_Trends) SBI_Trends.onDataLoaded();
});
