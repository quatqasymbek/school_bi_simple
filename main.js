<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8" />
    <title>Школьная Аналитическая Платформа</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Plotly.js -->
    <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
    <!-- XLSX -->
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />

    <style>
        :root {
            --primary: #2c3e50;
            --secondary: #34495e;
            --accent: #3498db;
            --bg: #f5f7fa;
            --text: #2c3e50;
            --white: #ffffff;
            --success: #27ae60;
            --warning: #f39c12;
            --danger: #c0392b;
            --gray: #95a5a6;
        }

        body {
            margin: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg);
            color: var(--text);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Header */
        header {
            background: var(--primary);
            color: var(--white);
            padding: 0 20px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        header h1 { margin: 0; font-size: 1.4rem; font-weight: 600; }
        header .controls { display: flex; gap: 10px; }

        /* Tabs */
        .tabs {
            background: var(--white);
            padding: 0 20px;
            display: flex;
            gap: 5px;
            border-bottom: 1px solid #ddd;
        }
        .tab-btn {
            padding: 15px 20px;
            background: none;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            font-size: 1rem;
            color: var(--text);
            font-weight: 500;
            transition: all 0.2s;
        }
        .tab-btn:hover { background: #f8f9fa; }
        .tab-btn.active {
            border-bottom-color: var(--accent);
            color: var(--accent);
        }

        /* Main Content */
        main {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            position: relative;
        }

        .page { display: none; animation: fadeIn 0.3s; }
        .page.active { display: block; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Common UI Elements */
        .card {
            background: var(--white);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .card h2 { margin-top: 0; font-size: 1.2rem; color: var(--secondary); border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }

        .filters {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            align-items: center;
            background: var(--white);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        select {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.95rem;
            outline: none;
            min-width: 150px;
        }
        select:focus { border-color: var(--accent); }

        button {
            padding: 8px 16px;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.95rem;
        }
        button:hover { opacity: 0.9; }
        button.secondary { background: var(--gray); }

        /* KPIs */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .kpi-card {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .kpi-value { font-size: 2.5rem; font-weight: bold; }
        .kpi-label { font-size: 0.9rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }

        /* Grids */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }

        /* Tables */
        .table-container { overflow-x: auto; }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }
        th, td {
            padding: 10px 15px;
            border: 1px solid #eee;
            text-align: center;
        }
        th { background: #f8f9fa; font-weight: 600; color: var(--secondary); }
        td { color: #555; }
        tr:hover td { background: #f1f1f1; }

        /* AI Section */
        .ai-box {
            background: #f0f7ff;
            border: 1px solid #cce5ff;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
        }
        .ai-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; color: var(--accent); font-weight: bold; }

        /* Specific Colors for Grades */
        .grade-5 { color: #27ae60; font-weight: bold; }
        .grade-4 { color: #2980b9; font-weight: bold; }
        .grade-3 { color: #f39c12; font-weight: bold; }
        .grade-2 { color: #c0392b; font-weight: bold; }
    </style>
</head>
<body>

<header>
    <h1>📊 BI Platform</h1>
    <div class="controls">
        <button onclick="document.getElementById('fileLoader').click()"><i class="fas fa-upload"></i> Загрузить Excel</button>
    </div>
</header>

<div class="tabs">
    <button class="tab-btn active" data-page="page-overview">Обзор</button>
    <button class="tab-btn" data-page="page-classes">Классы</button>
    <button class="tab-btn" data-page="page-students">Ученики</button>
    <button class="tab-btn" data-page="page-teachers">Учителя</button>
    <button class="tab-btn" data-page="page-subjects">Предметы</button>
    <button class="tab-btn" data-page="page-attendance">Посещаемость</button>
</div>

<main>
    <!-- PAGE: OVERVIEW -->
    <div id="page-overview" class="page active">
        <div class="filters">
            <label>Четверть: <select id="ovTerm"></select></label>
            <label>Метрика: <select id="ovMetric">
                <option value="quality">Качество знаний</option>
                <option value="average">Средняя оценка</option>
            </select></label>
            <button id="ovAiBtn" class="secondary"><i class="fas fa-magic"></i> ИИ-интерпретация</button>
        </div>

        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-value" id="kpiStudents">0</div>
                <div class="kpi-label">Всего учеников</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value" id="kpiTeachers">0</div>
                <div class="kpi-label">Всего учителей</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <h2>Успеваемость по параллелям (1-11 классы)</h2>
                <div class="table-container" id="ovGradeTable"></div>
            </div>
            <div class="card">
                <h2>Статус учащихся (Вся школа)</h2>
                <div id="ovDonut" style="height: 350px;"></div>
            </div>
        </div>
        
        <div id="ovAiResult" class="ai-box" style="display:none;">
            <div class="ai-header"><i class="fas fa-robot"></i> Анализ ИИ</div>
            <div id="ovAiText"></div>
        </div>
    </div>

    <!-- PAGE: CLASSES -->
    <div id="page-classes" class="page">
        <div class="filters">
            <label>Четверть: <select id="clTerm"></select></label>
            <label>Метрика: <select id="clMetric">
                <option value="quality">Качество знаний</option>
                <option value="average">Средняя оценка</option>
            </select></label>
        </div>

        <div class="card">
            <h2>Рейтинг классов</h2>
            <div class="table-container" id="clTable"></div>
        </div>

        <div class="filters" style="margin-top:30px;">
            <label>Класс для диаграммы: <select id="clSelectClass"></select></label>
        </div>
        <div class="card">
            <h2>Распределение оценок в классе</h2>
            <div id="clDonut" style="height: 400px;"></div>
        </div>
    </div>

    <!-- PAGE: STUDENTS -->
    <div id="page-students" class="page">
        <div class="filters">
            <label>Класс: <select id="stClass"></select></label>
            <label>Четверть: <select id="stTerm"></select></label>
            <button id="stLoadBtn">Показать</button>
        </div>
        <div class="card">
            <h2>Ведомость успеваемости</h2>
            <div class="table-container" id="stTable"></div>
        </div>
    </div>

    <!-- PAGE: TEACHERS -->
    <div id="page-teachers" class="page">
        <div class="filters">
            <label>Четверть: <select id="tcTerm"></select></label>
            <label>Метрика: <select id="tcMetric">
                <option value="quality">Качество знаний</option>
                <option value="average">Средняя оценка</option>
            </select></label>
        </div>

        <div class="grid-2">
            <div class="card">
                <h2>Квалификация педагогов</h2>
                <div id="tcQualDonut" style="height: 300px;"></div>
            </div>
            <div class="card">
                <h2>Детализация по учителю</h2>
                <div style="margin-bottom:10px;">
                    <select id="tcSelectTeacher" style="width:100%"></select>
                </div>
                <div id="tcStudentDonut" style="height: 260px;"></div>
            </div>
        </div>

        <div class="card">
            <h2>Эффективность работы учителей</h2>
            <div class="table-container" id="tcTable"></div>
        </div>
    </div>

    <!-- PAGE: SUBJECTS -->
    <div id="page-subjects" class="page">
        <div class="filters">
            <label>Четверть: <select id="sbTerm"></select></label>
            <label>Метрика: <select id="sbMetric">
                <option value="quality">Качество знаний</option>
                <option value="average">Средняя оценка</option>
            </select></label>
        </div>

        <div class="card">
            <h2>Рейтинг предметов</h2>
            <div id="sbBarChart" style="height: 400px;"></div>
        </div>

        <div class="card">
            <h2>Матрица: Предметы / Классы</h2>
            <div id="sbHeatmap" style="height: 500px;"></div>
        </div>
    </div>

    <!-- PAGE: ATTENDANCE -->
    <div id="page-attendance" class="page">
        <div class="filters">
            <label>Четверть: <select id="atTerm"></select></label>
        </div>

        <div class="card">
            <h2>Посещаемость по классам</h2>
            <div class="table-container" id="atClassTable"></div>
        </div>

        <div class="filters" style="margin-top:20px;">
            <label>Детализация по классу: <select id="atClassSelect"></select></label>
        </div>
        <div class="card">
            <h2>Посещаемость учащихся</h2>
            <div class="table-container" id="atStudentTable"></div>
        </div>
    </div>

</main>

<!-- Scripts -->
<script src="llm_cpu.js"></script>
<script src="main.js"></script>
<script src="dashboard_overview.js"></script>
<script src="dashboard_class.js"></script>
<script src="dashboard_student.js"></script>
<script src="dashboard_teacher.js"></script>
<script src="dashboard_subject.js"></script>
<script src="attendance.js"></script>

<script>
    // Simple Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.page).classList.add('active');
        });
    });
</script>

</body>
</html>
