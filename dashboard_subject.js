window.SBI_Subject = (function() {
    function update() {
        if (!SBI.state.isLoaded) return;
        
        const termSel = document.getElementById('sbTerm');
        if (termSel.options.length === 0) {
             SBI.state.terms.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.term_id; opt.text = t.term_id;
                termSel.add(opt);
            });
            termSel.addEventListener('change', render);
            document.getElementById('sbMetric').addEventListener('change', render);
        }
        render();
    }

    function render() {
        const term = document.getElementById('sbTerm').value;
        const metric = document.getElementById('sbMetric').value;

        renderBarChart(term, metric);
        renderHeatmap(term, metric);
    }

    function renderBarChart(term, metric) {
        // Subjects descending by metric
        const stats = [];
        SBI.state.subjects.forEach(s => {
            const rows = SBI.state.processedGrades.filter(r => r.subject_id === s.subject_id && r.term_id === term);
            const val = calculateMetric(rows, metric);
            if (val !== null) stats.push({ name: s.subject_name, val: val });
        });

        stats.sort((a,b) => b.val - a.val); // Descending

        const x = stats.map(s => s.name);
        const y = stats.map(s => s.val);

        Plotly.newPlot('sbBarChart', [{
            x: x, y: y, type: 'bar', marker: { color: '#3498db' }
        }], { 
            xaxis: { tickangle: -45 },
            margin: { b: 100 }
        });
    }

    function renderHeatmap(term, metric) {
        // Rows: Subjects, Cols: Classes
        // We need sorted lists
        const classes = SBI.state.classes.slice().sort((a,b) => a.class_name.localeCompare(b.class_name));
        const subjects = SBI.state.subjects;

        const zValues = [];
        const xLabels = classes.map(c => c.class_name);
        const yLabels = subjects.map(s => s.subject_name);

        subjects.forEach(s => {
            const row = [];
            classes.forEach(c => {
                const subset = SBI.state.processedGrades.filter(r => 
                    r.subject_id === s.subject_id && 
                    r.class_id === c.class_id && 
                    r.term_id === term
                );
                const val = calculateMetric(subset, metric);
                row.push(val !== null ? val : null); // Null for heatmap gaps
            });
            zValues.push(row);
        });

        Plotly.newPlot('sbHeatmap', [{
            z: zValues,
            x: xLabels,
            y: yLabels,
            type: 'heatmap',
            colorscale: metric === 'quality' ? 'RdYlGn' : 'RdYlGn',
            xgap: 1, ygap: 1
        }], {
            margin: { l: 150, b: 100 }
        });
    }

    function calculateMetric(rows, type) {
        if (!rows.length) return null;
        if (type === 'average') {
            return rows.reduce((a,b)=>a+b.grade,0) / rows.length;
        } else {
            const good = rows.filter(r => r.grade >= 4).length;
            return (good / rows.length) * 100;
        }
    }

    return { update };
})();
