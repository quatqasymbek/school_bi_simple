window.SBI_Attendance = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;

        const termSel = document.getElementById('atTerm');
        if (termSel.options.length === 0) {
             SBI.state.terms.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.term_id; opt.text = t.term_id;
                termSel.add(opt);
            });
            termSel.addEventListener('change', renderClassTable);
            
            const clSel = document.getElementById('atClassSelect');
            SBI.state.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.class_id; opt.text = c.class_name;
                clSel.add(opt);
            });
            clSel.addEventListener('change', renderStudentTable);
        }
        renderClassTable();
    }

    function renderClassTable() {
        const term = document.getElementById('atTerm').value;
        const container = document.getElementById('atClassTable');
        
        // Aggregate attendance by class
        const classes = SBI.state.classes;
        let html = `<table><thead><tr>
            <th>Класс</th>
            <th>Всего занятий</th>
            <th>Присутствие (%)</th>
            <th>Опоздания (%)</th>
            <th>Уваж. (%)</th>
            <th>Неуваж. (%)</th>
        </tr></thead><tbody>`;

        classes.forEach(c => {
            const recs = SBI.state.attendance.filter(a => a.class_id === c.class_id && a.term_id === term);
            if (recs.length === 0) return;

            const stats = aggregateAtt(recs);
            
            html += `<tr>
                <td>${c.class_name}</td>
                <td>${stats.total}</td>
                <td>${stats.present_pct}%</td>
                <td>${stats.late_pct}%</td>
                <td>${stats.exc_pct}%</td>
                <td>${stats.unexc_pct}%</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function renderStudentTable() {
        const term = document.getElementById('atTerm').value;
        const classId = document.getElementById('atClassSelect').value;
        const container = document.getElementById('atStudentTable');

        if (!classId) return;

        // Get students enrolled
        const enrollments = SBI.state.enrollments.filter(e => e.class_id === classId && e.term_id === term);
        
        let html = `<table><thead><tr>
            <th>Ученик</th><th>ID</th>
            <th>Всего</th><th>Присут. (%)</th><th>Опозд. (%)</th><th>Уваж. (%)</th><th>Неуваж. (%)</th>
        </tr></thead><tbody>`;

        enrollments.forEach(e => {
            const s = SBI.state.students.find(stu => stu.student_id === e.student_id);
            const name = s ? `${s.last_name} ${s.first_name}` : e.student_id;

            const recs = SBI.state.attendance.filter(a => a.student_id === e.student_id && a.term_id === term);
            const stats = aggregateAtt(recs);

            html += `<tr>
                <td>${name}</td><td>${e.student_id}</td>
                <td>${stats.total}</td>
                <td>${stats.present_pct}%</td>
                <td>${stats.late_pct}%</td>
                <td>${stats.exc_pct}%</td>
                <td>${stats.unexc_pct}%</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function aggregateAtt(rows) {
        let total = 0, present = 0, late = 0, exc = 0, unexc = 0;
        rows.forEach(r => {
            // Assuming fields: total_classes, present_classes, etc. (as per snippet)
            // Ensure numbers
            total += (parseInt(r.total_classes)||0);
            present += (parseInt(r.present_classes)||0);
            late += (parseInt(r.late_classes)||0);
            exc += (parseInt(r.absent_excused_classes)||0);
            unexc += (parseInt(r.absent_unexcused_classes)||0);
        });

        const calc = (n) => total > 0 ? ((n/total)*100).toFixed(1) : '0.0';
        return {
            total,
            present_pct: calc(present),
            late_pct: calc(late),
            exc_pct: calc(exc),
            unexc_pct: calc(unexc)
        };
    }

    return { update };
})();
