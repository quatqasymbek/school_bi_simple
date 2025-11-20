window.SBI_Student = (function() {
    
    function update() {
        if (!SBI.state.isLoaded) return;

        // Populate selectors
        const classSel = document.getElementById('stClass');
        const termSel = document.getElementById('stTerm');

        if (classSel.options.length === 0) {
            SBI.state.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.class_id; opt.text = c.class_name;
                classSel.add(opt);
            });
            SBI.state.terms.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.term_id; opt.text = t.term_id;
                termSel.add(opt);
            });
            
            document.getElementById('stLoadBtn').addEventListener('click', render);
        }
    }

    function render() {
        const classId = document.getElementById('stClass').value;
        const termId = document.getElementById('stTerm').value;
        const container = document.getElementById('stTable');

        // Get Students enrolled in this class/term
        const enrollments = SBI.state.enrollments.filter(e => e.class_id === classId && e.term_id === termId);
        // Sort by name
        enrollments.sort((a,b) => {
            const sa = SBI.state.students.find(s => s.student_id === a.student_id);
            const sb = SBI.state.students.find(s => s.student_id === b.student_id);
            return (sa?.last_name || '').localeCompare(sb?.last_name || '');
        });

        // Get Subjects taught in this class for this term
        // Look at assignments or grades? Grades are safer source of truth for "what was taken".
        // Or Assignments. Let's use Assignments.
        const assignments = SBI.state.assignments.filter(a => a.class_id === classId && a.term_id === termId);
        const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
        
        let html = `<table><thead><tr><th>ФИО</th><th>ID</th><th>Кл. рук.</th>`;
        subjectIds.forEach(sid => {
            const sName = SBI.state.subjects.find(s => s.subject_id === sid)?.subject_name || sid;
            html += `<th>${sName}</th>`;
        });
        html += `<th>Статус</th><th>Ср. балл</th></tr></thead><tbody>`;

        // Homeroom teacher
        const classObj = SBI.state.classes.find(c => c.class_id === classId);
        const hrName = classObj ? getTeacherName(classObj.homeroom_teacher_id) : '-';

        enrollments.forEach(e => {
            const s = SBI.state.students.find(stu => stu.student_id === e.student_id);
            const name = s ? `${s.last_name} ${s.first_name}` : e.student_id;
            
            html += `<tr>
                <td style="text-align:left">${name}</td>
                <td>${e.student_id}</td>
                <td>${hrName}</td>`;
            
            let sum = 0;
            let count = 0;

            subjectIds.forEach(sid => {
                // Find grade
                const rec = SBI.state.processedGrades.find(r => r.student_id === e.student_id && r.subject_id === sid && r.term_id === termId);
                if (rec) {
                    const colorClass = `grade-${rec.grade}`;
                    html += `<td class="${colorClass}">${rec.grade}</td>`;
                    sum += rec.grade;
                    count++;
                } else {
                    html += `<td>-</td>`;
                }
            });

            // Overall Status
            const statusKey = `${e.student_id}|${termId}`;
            const status = SBI.state.studentStatuses[statusKey] || '-';
            
            // Avg
            const avg = count ? (sum/count).toFixed(2) : '-';

            html += `<td><b>${status}</b></td><td><b>${avg}</b></td></tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function getTeacherName(tid) {
        const t = SBI.state.teachers.find(x => x.teacher_id === tid);
        return t ? `${t.last_name} ${t.first_name}` : tid;
    }

    return { update };
})();
