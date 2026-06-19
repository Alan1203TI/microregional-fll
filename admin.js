<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin - FLL 2026</title>
  <link rel="stylesheet" href="style.css?v=20260618-mesa2">
</head>
<body>
  <header class="topbar" id="adminTopbar" style="display:none">
    <div class="brand">
      <div class="logo"><img src="assets/bioglow-logo.png" alt="BIOGLOW"></div>
      <div>
        <div>Administração</div>
        <small>Equipes, mesas e resultados</small>
      </div>
    </div>
    <nav class="nav">
      <a href="pontuacao-mesa1.html">Pontuação Mesa 1</a>
      <a href="pontuacao-mesa2.html">Pontuação Mesa 2</a>
      <a href="dashboard.html" target="_blank">Dashboard Geral</a>
      <a href="cronometro.html" target="_blank">Cronômetro</a>
      <a href="admin.html">Admin</a>
      <button class="btn red" id="logoutAdminBtn" type="button">Sair</button>
    </nav>
  </header>

  <main class="admin-login-wrap" id="adminLoginScreen">
    <section class="card admin-login-card">
      <div class="admin-lock-icon">🔒</div>
      <h1>Área Administrativa</h1>
      <p class="muted">Digite a senha para acessar cadastro de equipes, resultados, ranking completo e controles da competição.</p>

      <div class="field">
        <label>Senha do administrador</label>
        <input id="adminPasswordInput" type="password" placeholder="Digite a senha">
      </div>

      <button class="btn primary full-btn" id="adminLoginBtn" type="button">Entrar</button>
      <div class="admin-login-error" id="adminLoginError"></div>
    </section>
  </main>

  <main class="container" id="adminContent" style="display:none">
    <section class="card admin-control-card">
      <h2>Cronômetro geral</h2>
      <p class="muted">Controle aqui o cronômetro único gigante da competição. Abra a tela <strong>cronometro.html</strong> em outro monitor ou projetor.</p>

      <div class="giant-admin-timer" id="adminTimerDisplay">02:30</div>
      <div class="admin-timer-status" id="adminTimerStatus">Parado</div>

      <div class="admin-actions-grid">
        <button class="btn primary" id="globalTimerStartBtn" type="button">Iniciar Cronômetro</button>
        <button class="btn" id="globalTimerPauseBtn" type="button">Pausar</button>
        <button class="btn red" id="globalTimerResetBtn" type="button">Reiniciar 02:30</button>
        <a class="btn green" href="cronometro.html" target="_blank">Abrir tela gigante</a>
      </div>
    </section>

    <section class="card admin-control-card">
      <h2>Painel de controle</h2>
      <p class="muted">Use estes botões para controlar a competição sem mexer diretamente no Firestore.</p>

      <div class="admin-actions-grid">
        <button class="btn red" id="clearMesa1Btn" type="button">Zerar Mesa 1</button>
        <button class="btn red" id="clearMesa2Btn" type="button">Zerar Mesa 2</button>
        <button class="btn red" id="resetCompetitionBtn" type="button">Zerar Competição</button>
        <button class="btn green" id="exportBtn" type="button">Exportar CSV</button>
      </div>

      <p class="muted admin-note">
        Zerar Mesa 1 ou Mesa 2 apaga somente os resultados da mesa escolhida, limpa a pontuação ao vivo e reinicia o cronômetro da mesa.
        Zerar Competição apaga todos os resultados das duas mesas, mas mantém as equipes cadastradas.
      </p>
    </section>

    <div class="columns admin-columns">
      <section class="card">
        <h2>Cadastrar equipe</h2>
        <div class="setup" style="grid-template-columns:1fr 1fr auto">
          <div class="field">
            <label>Nome da equipe</label>
            <input id="teamName" placeholder="Ex: AtomTech">
          </div>
          <div class="field">
            <label>Robô / escola / turma</label>
            <input id="teamInfo" placeholder="Opcional">
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn primary" id="addTeamBtn" type="button">Adicionar</button>
          </div>
        </div>
        <h3>Equipes cadastradas</h3>
        <div class="admin-list" id="teamList"></div>
      </section>

      <section class="card">
        <h2>Visual do sistema</h2>
        <p class="muted">Você pode trocar o banner/topo e o fundo usando um caminho de imagem dentro da pasta <strong>assets</strong>.</p>

        <div class="field">
          <label>Banner do topo</label>
          <input id="bannerUrlInput" placeholder="Ex: assets/banner-topo.png">
        </div>

        <div class="field">
          <label>Fundo do sistema</label>
          <input id="backgroundUrlInput" placeholder="Ex: assets/fundo-bioglow.png">
        </div>

        <div class="admin-actions-grid small">
          <button class="btn primary" id="saveVisualBtn" type="button">Salvar visual</button>
          <button class="btn" id="resetVisualBtn" type="button">Voltar padrão</button>
        </div>

        <p class="muted admin-note">Depois de enviar uma nova imagem para o GitHub em <strong>assets</strong>, coloque aqui o caminho do arquivo.</p>
      </section>
    </div>

    <section class="card">
      <h2>Ranking completo administrativo</h2>
      <p class="muted">Aqui aparecem Round Oficial 1 e Round 2. No dashboard público, o Round 2 continua reservado, mas conta na melhor nota oficial.</p>

      <div class="table-wrap">
        <table class="roundTable admin-ranking-table">
          <thead>
            <tr>
              <th>Posição</th>
              <th>Equipe</th>
              <th>Round Teste</th>
              <th>Round Oficial 1</th>
              <th>Round 2</th>
              <th>Melhor oficial</th>
            </tr>
          </thead>
          <tbody id="adminRankingBody"></tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>Resultados lançados</h2>
      <p class="muted">Resultados detalhados das duas mesas. Exclua apenas se houver erro no lançamento.</p>

      <div style="overflow:auto;margin-top:12px">
        <table class="roundTable">
          <thead>
            <tr>
              <th>Mesa</th>
              <th>Equipe</th>
              <th>Round</th>
              <th>Pontos</th>
              <th>Árbitro</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="resultsBody"></tbody>
        </table>
      </div>
    </section>
  </main>

  <div class="toast" id="toast"></div>

  <script type="module" src="visual-settings.js?v=20260618-mesa2"></script>
  <script type="module" src="admin.js?v=20260618-mesa2"></script>
</body>
</html>
