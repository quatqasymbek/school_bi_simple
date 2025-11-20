window.SBI_Overview = (function() {
    
    function update() {
        if (!SBI.state.isLoaded) return;
        
        const rows = SBI.state.processedGrades;
        const terms = [...new Set(rows.map(r => r.term_id))].sort();
        
        // Populate Selectors
        const selTerm = document.getElementById('ovTerm');
        if (selTerm.options.length === 0) {
            const allOpt = document.createElement('option');
            allOpt.value = 'ALL'; allOpt.text = 'Весь год';
            selTerm.add(allOpt);
            terms.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t; opt.text = t;
                selTerm.add(opt);
            });
            selTerm.addEventListener('change', render);
            document.getElementById('ovMetric').addEventListener('change', render);
            document.getElementById('ovAiBtn').addEventListener('click', runAI);
        }

        render();
    }

    function render() {
        const term = document.getElementById('ovTerm').value;
        const metric = document.getElementById('ovMetric').value; // quality or average

        // Filter rows
        let data = SBI.state.processedGrades;
        if (term !== 'ALL') {
            data = data.filter(r => r.term_id === term);
        }

        // 1. KPIs
        document.getElementById('kpiStudents').innerText = SBI.state.students.length;
        document.getElementById('kpiTeachers').innerText = SBI.state.teachers.length;

        // 2. Grade Level Table (1-11 vs Terms)
        renderGradeTable(term, metric);

        // 3. School Donut (Statuses)
        renderStatusDonut(term);
    }

    function renderGradeTable(selectedTerm, metric) {
        const container = document.getElementById('ovGradeTable');
        // Grades 1 to 11. Terms as columns (or if Term selected, just that term? Prompt says "by term for each grade").
        // Let's show all terms in columns to show progress.
        
        const terms = [...new Set(SBI.state.processedGrades.map(r => r.term_id))].sort();
        const levels = [1,2,3,4,5,6,7,8,9,10,11];

        let html = `<table><thead><tr><th>Параллель</th>`;
        terms.forEach(t => html += `<th>${t}</th>`);
        html += `</tr></thead><tbody>`;

        levels.forEach(lvl => {
            html += `<tr><td><b>${lvl} Классы</b></td>`;
            terms.forEach(t => {
                // Filter: Classes starting with lvl + Term
                const subset = SBI.state.processedGrades.filter(r => {
                    // Class ID logic: K-1A -> starts with 'K-1' but we need to be careful about K-11 vs K-1
                    // Parse int from class name
                    const cName = SBI.state.classes.find(c => c.class_id === r.class_id)?.class_name || "";
                    return parseInt(cName) === lvl && r.term_id === t;
                });

                const val = calculateMetric(subset, metric);
                const color = getCellColor(val, metric);
                html += `<td style="background:${color}">${val !== null ? val : '-'}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    function renderStatusDonut(term) {
        // Aggregation of Student Statuses
        // If term is ALL, we might pick latest, or average? Status is term-specific. 
        // Let's use unique (Student, Term) keys if ALL, but donut usually shows snapshot. 
        // For ALL, let's just count all term-statuses (sum of instances).
        
        const counts = { 'Отличник': 0, 'Хорошист': 0, 'Троечник': 0, 'Двоечник': 0 };
        
        Object.entries(SBI.state.studentStatuses).forEach(([key, status]) => {
            const [sid, t] = key.split('|');
            if (term === 'ALL' || t === term) {
                if (counts[status] !== undefined) counts[status]++;
            }
        });

        const values = [counts['Отличник'], counts['Хорошист'], counts['Троечник'], counts['Двоечник']];
        const labels = ['Отличники', 'Хорошисты', 'Троечники', 'Двоечники'];
        const colors = [SBI.colors.grade5, SBI.colors.grade4, SBI.colors.grade3, SBI.colors.grade2];

        Plotly.newPlot('ovDonut', [{
            values: values,
            labels: labels,
            type: 'pie',
            marker: { colors: colors },
            hole: 0.4,
            textinfo: 'label+percent'
        }], { margin: { t: 0, b: 0, l: 0, r: 0 } });
    }

    // Helpers
    function calculateMetric(rows, type) {
        if (rows.length === 0) return null;
        if (type === 'average') {
            const sum = rows.reduce((a,b) => a + b.grade, 0);
            return (sum / rows.length).toFixed(2);
        } else {
            // Quality: (4s + 5s) / All
            const good = rows.filter(r => r.grade >= 4).length;
            return ((good / rows.length) * 100).toFixed(1) + '%';
        }
    }

    function getCellColor(val, type) {
        if (!val) return 'transparent';
        let num = parseFloat(val);
        if (type === 'quality') {
            // 0-100 gradient
            if (num >= 70) return 'rgba(46, 204, 113, 0.3)'; // Good
            if (num >= 50) return 'rgba(241, 196, 15, 0.3)'; // Mid
            return 'rgba(231, 76, 60, 0.3)'; // Bad
        } else {
            // 2-5 gradient
            if (num >= 4.5) return 'rgba(46, 204, 113, 0.3)';
            if (num >= 3.5) return 'rgba(52, 152, 219, 0.3)';
            if (num >= 2.5) return 'rgba(241, 196, 15, 0.3)';
            return 'rgba(231, 76, 60, 0.3)';
        }
    }

    async function runAI() {
        const box = document.getElementById('ovAiResult');
        const txt = document.getElementById('ovAiText');
        box.style.display = 'block';
        txt.innerHTML = 'Генерация анализа...';
        
        // Prepare context
        const stats = {
            students: SBI.state.students.length,
            teachers: SBI.state.teachers.length,
            // Add more summary stats here
        };
        
        const prompt = `Проанализируй статистику школы: ${JSON.stringify(stats)}. Дай краткий обзор успеваемости.`;
        
        // Call LLM (Assuming global wrapper)
        if (window.SBI_LLM) {
            const result = await window.SBI_LLM.interpret(prompt);
            txt.innerHTML = result;
        } else {
            txt.innerHTML = "Модуль ИИ не загружен.";
        }
    }

    return { update };
})();
