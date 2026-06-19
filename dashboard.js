<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Dashboard Geral - FLL 2026</title>
  <link rel="stylesheet" href="style.css?v=20260618-mesa2">
</head>
<body class="championship-body unified-dashboard vivid-dashboard" data-table-id="GERAL" data-table-name="Geral">
  <div class="arena-bg"></div>

  <header class="scoreboard-header">
    <div class="event-brand">
      <div class="logo-card">
        <img src="./assets/bioglow-logo.png?v=4" alt="BIOGLOW">
      </div>
      <div>
        <strong>MICRORREGIONAL MG 2026</strong>
        <span>Desafio do Robô • BIOGLOW</span>
      </div>
    </div>

    <div class="live-pill"><span></span> AO VIVO</div>

    <div class="header-actions">
      <a href="pontuacao-mesa1.html">Mesa 1</a>
      <a href="pontuacao-mesa2.html">Mesa 2</a>
      <a href="admin.html">Admin</a>
    </div>
  </header>

  <main class="championship-dashboard unified-layout vivid-layout">
    <section class="hero-scoreboard unified-hero vivid-hero">
      <div class="hero-left">
        <p class="eyebrow">CLASSIFICAÇÃO INTEGRADA</p>
        <h1>DESEMPENHO DO ROBÔ</h1>
      </div>
    </section>
<section class="rounds-scoreboard vivid-rounds dashboard-results-only">
      <div class="panel-title">
        <h2>RESULTADOS</h2>
        <span>Round Teste e Round Oficial 1</span>
      </div>

      <div class="table-wrap">
        <table class="champ-table">
          <thead>
            <tr>
              <th>EQUIPE</th>
              <th>ROUND TESTE</th>
              <th>ROUND OFICIAL 1</th>
              <th>PONTUAÇÃO PÚBLICA</th>
            </tr>
          </thead>
          <tbody id="roundsBody"></tbody>
        </table>
      </div>
    </section>
  </main>

  <script type="module" src="visual-settings.js?v=20260618-mesa2"></script>
  <script type="module" src="dashboard.js?v=20260618-mesa2"></script>
</body>
</html>
