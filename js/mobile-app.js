// WikiScout Mobile Application

class MobileApp {
  constructor() {
    this.currentEvent = null;
    this.teamNumber = null;
    this.teams = [];
    this.rankings = [];
    this.matches = [];
    this.currentScreen = 'rankings';
    
    this.init();
  }
  
  async init() {
    // Initialize icons
    initIcons();
    
    // Check authentication
    await this.checkAuth();
    
    // Setup navigation and events
    this.setupNavigation();
    this.setupEventListeners();
    
    // Load initial data
    await this.loadInitialData();
    
    // Hide loading screen
    setTimeout(() => {
      $('#loadingScreen').style.display = 'none';
    }, 500);
  }
  
  async checkAuth() {
    try {
      const result = await api.validateToken();
      if (result && result.team_number) {
        this.teamNumber = result.team_number.toString();
        this.userName = result.name || 'Team Member';
        $('#mobileSubtitle').textContent = `Team #${this.teamNumber}`;
        return;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Allow demo mode - don't redirect, just set demo team
    }
    
    // Demo mode fallback
    this.teamNumber = '16072';
    this.userName = 'Demo User';
    $('#mobileSubtitle').textContent = `Team #${this.teamNumber} (Demo)`;
    
    // Only redirect on explicit unauthorized event
    window.addEventListener('auth:unauthorized', (e) => {
      // Check if this is not a demo mode scenario
      if (!e.detail?.allowDemo) {
        window.location.href = 'index.html';
      }
    });
  }
  
  setupNavigation() {
    $$('.mobile-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const screen = item.dataset.screen;
        this.navigateTo(screen);
      });
    });
  }
  
  navigateTo(screen) {
    // Update nav
    $$('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.screen === screen);
    });
    
    // Update screens
    $$('.screen').forEach(s => {
      s.classList.toggle('active', s.id === `screen-${screen}`);
    });
    
    // Update title
    const titles = {
      rankings: 'Rankings',
      matches: 'Matches',
      data: 'Team Data',
      scout: 'Scout'
    };
    $('#mobileTitle').textContent = titles[screen] || 'WikiScout';
    
    this.currentScreen = screen;
    this.loadScreenData(screen);
    
    // Show/hide FAB
    $('#fabScout').style.display = screen !== 'scout' ? 'flex' : 'none';
  }
  
  setupEventListeners() {
    // Logout button in header
    $('#mobileLogoutBtn')?.addEventListener('click', () => this.logout());
    
    // OTP button in header
    $('#mobileOtpBtn')?.addEventListener('click', () => this.openOtpSheet());
    
    // Close OTP sheet
    $('#closeOtpSheet')?.addEventListener('click', () => this.closeOtpSheet());
    $('#otpSheetOverlay')?.addEventListener('click', () => this.closeOtpSheet());
    
    // FAB
    $('#fabScout')?.addEventListener('click', () => this.navigateTo('scout'));
    
    // OTP buttons in sheet
    $('#mobileDeleteOtp')?.addEventListener('click', () => this.deleteOtp());
    $('#mobileRegenOtp')?.addEventListener('click', () => this.regenerateOtp());
    
    // Match filter pills
    this.matchFilter = 'my-team';
    document.querySelectorAll('.match-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.matchFilter = pill.dataset.matchFilter;
        document.querySelectorAll('.match-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.renderMatches();
      });
    });
    
    // Team select for data view
    $('#mobileTeamSelect').addEventListener('change', (e) => {
      if (e.target.value) this.loadTeamData(e.target.value);
    });
    
    // Scout form
    $('#mobileScoutForm').addEventListener('submit', (e) => this.handleScoutSubmit(e));
    
    // Stats popup buttons
    $('#statsViewData').addEventListener('click', () => this.viewTeamDataFromStats());
    $('#statsClose').addEventListener('click', () => this.closeStatsPopup());
    $('#statsPopup').addEventListener('click', (e) => {
      if (e.target.id === 'statsPopup') this.closeStatsPopup();
    });
    
    // Event banners open event picker
    document.querySelectorAll('.event-banner').forEach(banner => {
      banner.addEventListener('click', () => this.openMobileEventPicker());
    });
    
    // Mobile Event Picker
    $('#mobileEpClose')?.addEventListener('click', () => this.closeMobileEventPicker());
    $('#mobileEventPickerModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'mobileEventPickerModal') this.closeMobileEventPicker();
    });
    
    document.querySelectorAll('.mobile-ep-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchMobileEpTab(tab.dataset.epFilter));
    });
    
    $('#mobileEpSearchInput')?.addEventListener('input', debounce((e) => {
      this._filterMobileEpList(e.target.value);
    }, 250));
    
    $('#mobileEpSeasonSelect')?.addEventListener('change', (e) => {
      this._mepSeason = parseInt(e.target.value);
      this._loadMobileEpData();
    });
  }
  
  async loadInitialData() {
    try {
      // Get current event
      const meData = await api.getMe().catch(err => {
        console.error('Failed to fetch /me:', err);
        return { found: false };
      });
      
      if (meData.found && meData.event) {
        this.currentEvent = meData.event.code;
        this.eventName = meData.event.name || this.currentEvent;
        storage.set('currentEvent', this.currentEvent);
      } else {
        this.currentEvent = storage.get('currentEvent');
      }
      
      // Load today's events
      const todayData = await api.getTodayEvents().catch(() => ({ events: [] }));
      
      // If API fails, use demo event data
      if (!todayData.events || todayData.events.length === 0) {
        todayData.events = [
          { code: '2026flwp', name: 'West Palm Beach Regional' },
          { code: '2026txda', name: 'Dallas Regional' }
        ];
      }
      
      this.populateEventSelect(todayData.events || []);
      
      // If no current event but there are events today, pick the first one
      if (!this.currentEvent && todayData.events && todayData.events.length > 0) {
        this.currentEvent = todayData.events[0].code;
        this.eventName = todayData.events[0].name;
        storage.set('currentEvent', this.currentEvent);
      }
      
      // Update event banners
      this.updateEventBanners();
      
      // Load event data
      if (this.currentEvent) {
        await this.loadEventData();
      }
      
      // Load OTP
      this.loadOtp();
      
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }
  
  updateEventBanners() {
    const name = this.eventName || this.currentEvent || 'No Event Selected';
    const code = this.currentEvent || '---';
    
    ['#rankingsEventName', '#matchesEventName', '#scoutEventName'].forEach(sel => {
      const el = $(sel);
      if (el) el.textContent = name;
    });
    
    ['#rankingsEventCode', '#matchesEventCode', '#scoutEventCode'].forEach(sel => {
      const el = $(sel);
      if (el) el.textContent = code;
    });
  }
  
  async loadEventData() {
    if (!this.currentEvent) return;
    
    try {
      const [teamsData, rankingsData, matchesData] = await Promise.all([
        api.getTeams(this.currentEvent).catch(() => ({ teams: [] })),
        api.getRankings(this.currentEvent).catch(() => ({ rankings: [] })),
        api.getMatches(this.currentEvent).catch(() => ({ matches: [] }))
      ]);
      
      // Process teams
      if (teamsData && teamsData.teams && teamsData.teams.length > 0) {
        this.teams = teamsData.teams.map(t => t.teamNumber || t);
      } else {
        this.teams = [];
      }
      
      // Process rankings (API returns lowercase 'rankings')
      const rankings = rankingsData.rankings || rankingsData.Rankings || [];
      this.rankings = rankings.map(r => ({
        teamNumber: r.teamNumber,
        teamName: r.teamName || '',
        rank: r.rank,
        wins: r.wins || 0,
        losses: r.losses || 0,
        ties: r.ties || 0,
        matchesPlayed: r.matchesPlayed || (r.wins + r.losses + r.ties) || 0
      }));
      
      // Process matches — API returns simplified format: { red: { total, auto, foul, teams }, blue: { ... } }
      const matches = matchesData.matches || matchesData.Schedule || [];
      this.matches = matches.map(m => ({
        matchNumber: m.matchNumber,
        description: m.description || `Match ${m.matchNumber}`,
        tournamentLevel: m.tournamentLevel,
        completed: m.red?.total !== null && m.red?.total !== undefined,
        red: {
          teams: m.red?.teams || [],
          score: m.red?.total,
          auto: m.red?.auto,
          foul: m.red?.foul
        },
        blue: {
          teams: m.blue?.teams || [],
          score: m.blue?.total,
          auto: m.blue?.auto,
          foul: m.blue?.foul
        }
      }));
      
      // If API returned empty data (no auth / demo mode), generate client-side demo data
      if (this.teams.length === 0 && this.rankings.length === 0 && this.matches.length === 0) {
        this._generateDemoData();
      }
      
      this.updateEventBanners();
      this.populateTeamSelects();
      this.renderRankings();
      this.renderMatches();
      this.renderScoutForm();
      
    } catch (error) {
      console.error('Failed to load event data:', error);
    }
  }
  
  _generateDemoData() {
    // Demo teams list (mirrors the server-side demo data)
    const DEMO_TEAMS = [
      { teamNumber: 7236, name: 'Recharged Green' },
      { teamNumber: 8393, name: 'Gearheads' },
      { teamNumber: 9281, name: 'Overcharged' },
      { teamNumber: 10331, name: 'BinaryBots' },
      { teamNumber: 11115, name: 'Gluten Free' },
      { teamNumber: 11260, name: 'Up Next!' },
      { teamNumber: 12456, name: 'Circuit Breakers' },
      { teamNumber: 13201, name: 'TechnoWizards' },
      { teamNumber: 14078, name: 'Sigma Bots' },
      { teamNumber: 14523, name: 'RoboKnights' },
      { teamNumber: 15227, name: 'Mech Mayhem' },
      { teamNumber: 16072, name: 'Coyote Coders' },
      { teamNumber: 16340, name: 'Wired Warriors' },
      { teamNumber: 17305, name: 'Steel Stingers' },
      { teamNumber: 18092, name: 'Quantum Leap' },
      { teamNumber: 18456, name: 'Iron Eagles' },
      { teamNumber: 19012, name: 'Byte Force' },
      { teamNumber: 19876, name: 'Phoenix Rising' },
      { teamNumber: 20145, name: 'Titan Tech' },
      { teamNumber: 20503, name: 'NovaDroids' },
      { teamNumber: 21087, name: 'Velocity' },
      { teamNumber: 22190, name: 'Gear Grinders' },
      { teamNumber: 23456, name: 'Flash Forge' },
      { teamNumber: 24601, name: 'Robovolt' },
    ];

    this.teams = DEMO_TEAMS.map(t => t.teamNumber);

    // Seeded random for consistent demo data
    let seed = 42;
    const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // Generate 30 completed matches + 6 upcoming
    const teamNums = this.teams;
    const demoMatches = [];
    for (let i = 1; i <= 36; i++) {
      const sh = shuffle(teamNums);
      const isCompleted = i <= 30;
      const redAuto = isCompleted ? Math.floor(rng() * 40) + 10 : null;
      const blueAuto = isCompleted ? Math.floor(rng() * 40) + 10 : null;
      const redTeleop = isCompleted ? Math.floor(rng() * 80) + 30 : 0;
      const blueTeleop = isCompleted ? Math.floor(rng() * 80) + 30 : 0;
      const redEnd = isCompleted ? Math.floor(rng() * 30) : 0;
      const blueEnd = isCompleted ? Math.floor(rng() * 30) : 0;
      const redFoul = isCompleted ? Math.floor(rng() * 10) : null;
      const blueFoul = isCompleted ? Math.floor(rng() * 10) : null;
      const redTotal = isCompleted ? (redAuto + redTeleop + redEnd + redFoul) : null;
      const blueTotal = isCompleted ? (blueAuto + blueTeleop + blueEnd + blueFoul) : null;

      demoMatches.push({
        matchNumber: i,
        description: `Qualifier ${i}`,
        tournamentLevel: 'qual',
        completed: isCompleted,
        red: { teams: [sh[0], sh[1]], score: redTotal, auto: redAuto, foul: redFoul },
        blue: { teams: [sh[2], sh[3]], score: blueTotal, auto: blueAuto, foul: blueFoul }
      });
    }
    this.matches = demoMatches;

    // Generate rankings from match results
    const stats = {};
    teamNums.forEach(t => { stats[t] = { wins: 0, losses: 0, ties: 0, matchesPlayed: 0, totalScore: 0 }; });
    demoMatches.filter(m => m.completed).forEach(m => {
      m.red.teams.forEach(t => {
        if (!stats[t]) return;
        stats[t].matchesPlayed++;
        stats[t].totalScore += m.red.score;
        if (m.red.score > m.blue.score) stats[t].wins++;
        else if (m.red.score < m.blue.score) stats[t].losses++;
        else stats[t].ties++;
      });
      m.blue.teams.forEach(t => {
        if (!stats[t]) return;
        stats[t].matchesPlayed++;
        stats[t].totalScore += m.blue.score;
        if (m.blue.score > m.red.score) stats[t].wins++;
        else if (m.blue.score < m.red.score) stats[t].losses++;
        else stats[t].ties++;
      });
    });

    const sorted = Object.entries(stats).sort(([, a], [, b]) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalScore - a.totalScore;
    });

    this.rankings = sorted.map(([num, s], idx) => {
      const teamInfo = DEMO_TEAMS.find(t => t.teamNumber === parseInt(num));
      return {
        teamNumber: parseInt(num),
        teamName: teamInfo?.name || `Team ${num}`,
        rank: idx + 1,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        matchesPlayed: s.matchesPlayed
      };
    });

    console.log('Demo data generated:', this.teams.length, 'teams,', this.rankings.length, 'rankings,', this.matches.length, 'matches');
  }

  populateTeamSelects() {
    ['#mobileTeamSelect', '#mobileScoutTeam'].forEach(selector => {
      const select = $(selector);
      if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Team</option>' +
          this.teams.map(t => `<option value="${t}">${t}</option>`).join('');
        if (currentValue && this.teams.includes(parseInt(currentValue))) {
          select.value = currentValue;
        }
      }
    });
  }
  
  loadScreenData(screen) {
    switch (screen) {
      case 'account':
        this.loadOtp();
        break;
      case 'rankings':
        this.renderRankings();
        break;
      case 'matches':
        this.renderMatches();
        break;
    }
  }
  
  renderRankings() {
    const container = $('#mobileRankingsList');
    if (!container) return;
    
    if (this.rankings.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" data-icon="rankings" data-icon-size="48"></div>
          <div class="empty-state-title">No Rankings</div>
          <div class="empty-state-text">Rankings will appear when data is available</div>
        </div>
      `;
      initIcons();
      return;
    }
    
    container.innerHTML = this.rankings.map(team => `
      <div class="ranking-item" onclick="mobileApp.showTeamStats(${team.teamNumber})">
        <div class="ranking-position ${this.getRankClass(team.rank)}">${team.rank}</div>
        <div class="ranking-info">
          <div class="ranking-team ${team.teamNumber.toString() === this.teamNumber ? 'text-primary' : ''}">
            Team ${team.teamNumber}
          </div>
          <div class="ranking-record">${team.wins}W - ${team.losses}L - ${team.ties}T</div>
        </div>
        <div class="ranking-stat">
          <div class="ranking-stat-value">${team.matchesPlayed}</div>
          <div class="ranking-stat-label">Played</div>
        </div>
      </div>
    `).join('');
  }
  
  renderMatches() {
    const container = $('#mobileMatchList');
    if (!container) return;
    
    if (this.matches.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" data-icon="matches" data-icon-size="48"></div>
          <div class="empty-state-title">No Matches</div>
          <div class="empty-state-text">Match schedule will appear when data is available</div>
        </div>
      `;
      initIcons();
      return;
    }
    
    const myTeam = parseInt(this.teamNumber);
    let matches = [...this.matches];
    
    // Apply filter
    if (this.matchFilter === 'my-team') {
      matches = matches.filter(m =>
        m.red.teams.includes(myTeam) || m.blue.teams.includes(myTeam)
      );
    } else if (this.matchFilter === 'upcoming') {
      matches = matches.filter(m => !m.completed);
    }
    
    // Sort: upcoming first (by match number asc), then completed (by match number desc)
    matches.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.matchNumber - b.matchNumber;
    });
    
    if (matches.length === 0) {
      const msg = this.matchFilter === 'my-team'
        ? `No matches found for Team ${this.teamNumber}`
        : 'No matches match the current filter';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" data-icon="matches" data-icon-size="48"></div>
          <div class="empty-state-title">No Matches</div>
          <div class="empty-state-text">${msg}</div>
        </div>
      `;
      initIcons();
      return;
    }
    
    // Compute WLT summary for my team
    const myMatches = this.matches.filter(m =>
      m.completed && (m.red.teams.includes(myTeam) || m.blue.teams.includes(myTeam))
    );
    let wins = 0, losses = 0, ties = 0;
    myMatches.forEach(m => {
      const isRed = m.red.teams.includes(myTeam);
      const myScore = isRed ? m.red.score : m.blue.score;
      const oppScore = isRed ? m.blue.score : m.red.score;
      if (myScore > oppScore) wins++;
      else if (myScore < oppScore) losses++;
      else ties++;
    });
    
    let html = '';
    
    // Summary chips
    if (this.matchFilter === 'my-team' && myMatches.length > 0) {
      html += `
        <div class="match-summary-bar">
          <div class="match-summary-chip wins">
            <span class="chip-count">${wins}</span> W
          </div>
          <div class="match-summary-chip losses">
            <span class="chip-count">${losses}</span> L
          </div>
          <div class="match-summary-chip">
            <span class="chip-count">${ties}</span> T
          </div>
          <div class="match-summary-chip">
            <span class="chip-count">${myMatches.length}</span> Played
          </div>
        </div>
      `;
    }
    
    // Group matches
    const upcoming = matches.filter(m => !m.completed);
    const completed = matches.filter(m => m.completed);
    
    if (upcoming.length > 0) {
      html += `<div class="match-list-section-label">Upcoming (${upcoming.length})</div>`;
      html += upcoming.map(m => this._renderMatchCard(m, myTeam)).join('');
    }
    
    if (completed.length > 0) {
      html += `<div class="match-list-section-label">Completed (${completed.length})</div>`;
      // Show most recent completed first
      html += completed.reverse().map(m => this._renderMatchCard(m, myTeam)).join('');
    }
    
    container.innerHTML = html;
    initIcons();
    
    // Wire up tap actions on match cards
    container.querySelectorAll('.m-match-card').forEach(card => {
      card.addEventListener('click', () => {
        // Find the winning team or first team and show stats
        const teamNum = parseInt(card.dataset.focusTeam);
        if (teamNum) this.showTeamStats(teamNum);
      });
    });
  }
  
  _renderMatchCard(match, myTeam) {
    const isMyMatch = match.red.teams.includes(myTeam) || match.blue.teams.includes(myTeam);
    const isCompleted = match.completed;
    
    // Determine winner
    let redWin = false, blueWin = false;
    if (isCompleted && match.red.score !== null && match.blue.score !== null) {
      redWin = match.red.score > match.blue.score;
      blueWin = match.blue.score > match.red.score;
    }
    
    // For my-team filter, figure out result
    let resultClass = '';
    if (isMyMatch && isCompleted) {
      const isRed = match.red.teams.includes(myTeam);
      const myScore = isRed ? match.red.score : match.blue.score;
      const oppScore = isRed ? match.blue.score : match.red.score;
      if (myScore > oppScore) resultClass = 'my-win';
      else if (myScore < oppScore) resultClass = 'my-loss';
      else resultClass = 'my-tie';
    }
    
    // Focus team for click (prefer my team, otherwise red team 1)
    const focusTeam = isMyMatch ? myTeam : (match.red.teams[0] || match.blue.teams[0] || 0);
    
    const status = isCompleted ? 'completed' : 'upcoming';
    
    const renderTeamTags = (teams, alliance) => {
      return teams.map(t => {
        let cls = 'm-match-team-tag';
        if (t === myTeam) cls += ' highlight';
        return `<span class="${cls}">${t}</span>`;
      }).join('');
    };
    
    return `
      <div class="m-match-card ${isMyMatch ? 'my-match' : ''} ${!isCompleted ? 'upcoming' : ''} ${resultClass}" data-focus-team="${focusTeam}">
        <div class="m-match-top">
          <span class="m-match-label">${match.description || `Match ${match.matchNumber}`}</span>
          <span class="m-match-status ${status}">${isCompleted ? 'Final' : 'Upcoming'}</span>
        </div>
        <div class="m-match-body">
          <div class="m-match-alliance red">
            <div class="m-match-score ${redWin ? 'winner' : ''} ${!isCompleted ? 'pending' : ''}">
              ${isCompleted ? (match.red.score ?? '—') : '—'}
            </div>
            <div class="m-match-teams">
              ${renderTeamTags(match.red.teams, 'red')}
            </div>
          </div>
          <div class="m-match-vs">VS</div>
          <div class="m-match-alliance blue">
            <div class="m-match-score ${blueWin ? 'winner' : ''} ${!isCompleted ? 'pending' : ''}">
              ${isCompleted ? (match.blue.score ?? '—') : '—'}
            </div>
            <div class="m-match-teams">
              ${renderTeamTags(match.blue.teams, 'blue')}
            </div>
          </div>
        </div>
        ${isCompleted && match.red.auto !== null ? `
          <div class="m-match-breakdown">
            <div class="m-match-stat">
              <div class="m-match-stat-values">
                <span class="red-val">${match.red.auto ?? '—'}</span>
                <span>·</span>
                <span class="blue-val">${match.blue.auto ?? '—'}</span>
              </div>
              <div class="m-match-stat-label">Auto</div>
            </div>
            <div class="m-match-stat">
              <div class="m-match-stat-values">
                <span class="red-val">${match.red.score !== null ? (match.red.score - (match.red.auto || 0) - (match.red.foul || 0)) : '—'}</span>
                <span>·</span>
                <span class="blue-val">${match.blue.score !== null ? (match.blue.score - (match.blue.auto || 0) - (match.blue.foul || 0)) : '—'}</span>
              </div>
              <div class="m-match-stat-label">Teleop</div>
            </div>
            <div class="m-match-stat">
              <div class="m-match-stat-values">
                <span class="red-val">${match.red.foul ?? '—'}</span>
                <span>·</span>
                <span class="blue-val">${match.blue.foul ?? '—'}</span>
              </div>
              <div class="m-match-stat-label">Foul</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  showTeamStats(teamNumber) {
    const team = this.rankings.find(r => r.teamNumber === teamNumber);
    if (!team) return;
    
    // Populate popup
    $('#statsTeamTitle').textContent = `Team ${teamNumber}`;
    $('#statsTeamName').textContent = team.teamName || '';
    $('#statsWins').textContent = team.wins;
    $('#statsTies').textContent = team.ties;
    $('#statsLosses').textContent = team.losses;
    $('#statsPlayed').textContent = `Matches Played: ${team.matchesPlayed}`;
    
    // Load match history
    this.loadMatchHistory(teamNumber);
    
    // Store current team for view data button
    this.statsTeamNumber = teamNumber;
    
    // Show popup
    $('#statsPopup').classList.add('active');
  }
  
  loadMatchHistory(teamNumber) {
    const container = $('#statsMatchList');
    
    // Filter matches for this team from already loaded matches
    const teamMatches = this.matches.filter(m => 
      m.red.teams.includes(teamNumber) || m.blue.teams.includes(teamNumber)
    ).filter(m => m.completed); // Only show completed matches
    
    // Sort by match number ascending (chronological)
    teamMatches.sort((a, b) => a.matchNumber - b.matchNumber);
    
    if (teamMatches.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-xl);">
          <div class="empty-state-title">No Matches</div>
          <div class="empty-state-text">No match history available</div>
        </div>
      `;
      return;
    }
    
    // Build scroll-snap match card UI (inspired by old WikiScout)
    container.innerHTML = `<div class="match-results-scroll">${teamMatches.map((match, index) => {
      const isRed = match.red.teams.includes(teamNumber);
      const teamAlliance = isRed ? 'red' : 'blue';
      const oppAlliance = isRed ? 'blue' : 'red';
      const teamScore = match[teamAlliance].score;
      const oppScore = match[oppAlliance].score;
      const result = teamScore > oppScore ? 'win' : (teamScore < oppScore ? 'loss' : 'tie');
      
      return `
        <div class="match-result-item ${result}" data-index="${index}">
          <div class="match-result-label">${match.description}</div>
          <div class="match-result-scores">
            <span class="${teamAlliance}-score">${teamScore ?? '-'}</span>
            <span class="match-result-dash">—</span>
            <span class="${oppAlliance}-score">${oppScore ?? '-'}</span>
          </div>
          <div class="match-result-details">
            <div class="match-result-value ${teamAlliance}-alliance">${match[teamAlliance].teams.join(' ')}</div>
            <div class="match-result-vs">VS</div>
            <div class="match-result-value ${oppAlliance}-alliance">${match[oppAlliance].teams.join(' ')}</div>
          </div>
          <div class="match-result-details">
            <div class="match-result-value">${match[teamAlliance].auto ?? '-'}</div>
            <div class="match-result-label-sm">Auto</div>
            <div class="match-result-value">${match[oppAlliance].auto ?? '-'}</div>
          </div>
          <div class="match-result-details">
            <div class="match-result-value">${match[teamAlliance].foul ?? '-'}</div>
            <div class="match-result-label-sm">Foul</div>
            <div class="match-result-value">${match[oppAlliance].foul ?? '-'}</div>
          </div>
        </div>
      `;
    }).join('')}</div>`;
    
    // Add click-to-snap behaviour
    container.querySelectorAll('.match-result-item').forEach(item => {
      item.addEventListener('click', () => {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }
  
  closeStatsPopup() {
    $('#statsPopup').classList.remove('active');
  }
  
  viewTeamDataFromStats() {
    this.closeStatsPopup();
    this.loadTeamData(this.statsTeamNumber);
  }
  
  getRankClass(rank) {
    if (rank === 1) return 'first';
    if (rank === 2) return 'second';
    if (rank === 3) return 'third';
    return 'default';
  }
  
  async loadTeamData(team) {
    const container = $('#mobileTeamData');
    if (!container) return;
    
    // Update select
    $('#mobileTeamSelect').value = team;
    
    // Navigate to data screen if not there
    if (this.currentScreen !== 'data') {
      this.navigateTo('data');
    }
    
    // Show loading state
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" data-icon="refresh" data-icon-size="48"></div>
        <div class="empty-state-title">Loading...</div>
      </div>
    `;
    initIcons();
    
    try {
      const data = await api.getScoutingData(team, this.currentEvent);
      
      if (!data.private_data?.data?.length && !data.public_data?.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon" data-icon="data" data-icon-size="48"></div>
            <div class="empty-state-title">No Data</div>
            <div class="empty-state-text">No scouting data for Team ${team}</div>
          </div>
        `;
        initIcons();
        return;
      }
      
      // Find team rank
      const teamRank = this.rankings.find(r => r.teamNumber === parseInt(team));
      
      let html = '';
      
      // Team header
      html += `
        <div class="team-view-header">
          <div class="team-view-number">${team}</div>
          <div class="team-view-info">
            <h2>Team ${team}</h2>
            <div class="team-view-badges">
              <span class="badge badge-secondary">#${teamRank?.rank || 'N/A'}</span>
              <span class="badge badge-primary">${teamRank ? `${teamRank.wins}W` : 'N/A'}</span>
            </div>
          </div>
          <div class="team-view-actions">
            <button class="btn btn-ghost btn-sm" onclick="mobileApp.showTeamStats(${team})">
              <span data-icon="history" data-icon-size="16"></span>
            </button>
          </div>
        </div>
      `;
      
      // Your data - highlighted section
      if (data.private_data?.data?.length) {
        html += `
          <div class="data-section my-data">
            <div class="data-section-header">
              <span class="data-section-title">Scouting Data</span>
            </div>
            <div class="data-section-body">
              ${data.fields.map((field, i) => `
                <div class="data-row">
                  <span class="data-row-label">${field}</span>
                  <span class="data-row-value ${this.formatValue(data.private_data.data[i]).isCheck ? 'check' : ''}">
                    ${this.formatValue(data.private_data.data[i]).display}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      // Divider between your data and other data
      if (data.private_data?.data?.length && data.public_data?.length) {
        html += `<div class="data-divider">Other Teams' Data</div>`;
      }
      
      // Other data - less prominent
      if (data.public_data?.length) {
        data.public_data.forEach(entry => {
          html += `
            <div class="data-section other-data">
              <div class="data-section-header">
                <span class="data-section-title">Scouted by Team ${entry.scouting_team}</span>
              </div>
              <div class="data-section-body">
                ${data.fields.map((field, i) => `
                  <div class="data-row">
                    <span class="data-row-label">${field}</span>
                    <span class="data-row-value">${this.formatValue(entry.data[i]).display}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        });
      }
      
      container.innerHTML = html;
      
    } catch (error) {
      toast.error('Failed to load team data');
      console.error(error);
    }
  }
  
  formatValue(value) {
    if (value === true || value === 'true') {
      return { display: 'Yes', isCheck: true };
    }
    if (value === false || value === 'false') {
      return { display: 'No', isCheck: false };
    }
    return { display: value || '-', isCheck: false };
  }
  
  renderScoutForm() {
    const container = $('#mobileFormFields');
    if (!container) return;
    
    const formConfig = [
      { type: 'header', label: 'Tele-OP' },
      { type: 'checkbox', label: 'Mecanum Drive Train', id: 'mecanum' },
      { type: 'slider', label: 'Driver Practice', id: 'driverPractice', min: 0, max: 3, step: 1 },
      { type: 'number', label: 'Tele-OP Balls', id: 'teleOpBalls' },
      { type: 'options', label: 'Shooting Distance', id: 'shootingDist', options: ['Near', 'Far', 'Both'] },
      { type: 'header', label: 'Autonomous' },
      { type: 'number', label: 'Auto Balls', id: 'autoBalls' },
      { type: 'options', label: 'Auto Shooting', id: 'autoShooting', options: ['Near', 'Far', 'Both'] },
      { type: 'number', label: 'Auto Points', id: 'autoPoints' },
      { type: 'checkbox', label: 'Leave', id: 'autoLeave' },
      { type: 'text', label: 'Auto Details', id: 'autoDetails', big: true, description: 'Describe their autonomous routines' },
      { type: 'text', label: 'Private Notes', id: 'privateNotes', big: true, description: 'Only your team can see this' }
    ];
    
    let currentSection = null;
    let sectionFields = [];
    let html = '';
    
    formConfig.forEach((field, index) => {
      if (field.type === 'header') {
        // Close previous section
        if (currentSection && sectionFields.length) {
          html += `
            <div class="scout-form-section">
              <div class="scout-form-header">${currentSection}</div>
              <div class="scout-form-fields">${sectionFields.join('')}</div>
            </div>
          `;
        }
        currentSection = field.label;
        sectionFields = [];
        return;
      }
      
      let input = '';
      
      switch (field.type) {
        case 'checkbox':
          input = `
            <div class="scout-field">
              <div class="scout-field-row">
                <label class="scout-field-label">${field.label}</label>
                <input type="checkbox" class="checkbox" name="${field.id}" id="m${field.id}">
              </div>
            </div>
          `;
          break;
          
        case 'slider':
          input = `
            <div class="scout-field">
              <label class="scout-field-label">${field.label}</label>
              <div class="slider-wrapper">
                <input type="range" class="slider" name="${field.id}" id="m${field.id}" 
                       min="${field.min}" max="${field.max}" step="${field.step}" value="${field.min}"
                       oninput="document.getElementById('m${field.id}Value').textContent = this.value">
                <span class="slider-value" id="m${field.id}Value">${field.min}</span>
              </div>
            </div>
          `;
          break;
          
        case 'number':
          input = `
            <div class="scout-field">
              <label class="scout-field-label">${field.label}</label>
              <input type="number" class="form-input" name="${field.id}" id="m${field.id}" min="0" inputmode="numeric">
            </div>
          `;
          break;
          
        case 'options':
          input = `
            <div class="scout-field">
              <label class="scout-field-label">${field.label}</label>
              <select class="form-input form-select" name="${field.id}" id="m${field.id}">
                <option value="">Select...</option>
                ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
              </select>
            </div>
          `;
          break;
          
        case 'text':
          input = `
            <div class="scout-field">
              <label class="scout-field-label">${field.label}</label>
              ${field.description ? `<span class="scout-field-hint">${field.description}</span>` : ''}
              <textarea class="form-input form-textarea" name="${field.id}" id="m${field.id}" 
                        rows="${field.big ? 3 : 2}"></textarea>
            </div>
          `;
          break;
      }
      
      sectionFields.push(input);
    });
    
    // Close last section
    if (currentSection && sectionFields.length) {
      html += `
        <div class="scout-form-section">
          <div class="scout-form-header">${currentSection}</div>
          <div class="scout-form-fields">${sectionFields.join('')}</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
  }
  
  async handleScoutSubmit(e) {
    e.preventDefault();
    
    const team = $('#mobileScoutTeam').value;
    if (!team || !this.currentEvent) {
      toast.error('Select a team first');
      return;
    }
    
    const fields = ['mecanum', 'driverPractice', 'teleOpBalls', 'shootingDist',
                   'autoBalls', 'autoShooting', 'autoPoints', 'autoLeave',
                   'autoDetails', 'privateNotes'];
    
    const formData = fields.map(field => {
      const el = $(`#m${field}`);
      if (el) {
        return el.type === 'checkbox' ? el.checked : (el.value || '');
      }
      return '';
    });
    
    try {
      await api.addScoutingData(team, this.currentEvent, formData);
      toast.success('Data saved!');
      e.target.reset();
      $$('.slider-value').forEach(el => el.textContent = '0');
    } catch (error) {
      toast.error('Failed to save');
      console.error(error);
    }
  }
  
  async loadOtp() {
    try {
      const data = await api.getOtp();
      this.displayOtp(data.code || '------');
    } catch (error) {
      console.error('Failed to load OTP:', error);
      this.displayOtp('------');
    }
  }
  
  displayOtp(code) {
    const container = $('#mobileOtpDigits');
    if (!container) return;
    
    // Ensure code is 6 digits
    const digits = (code || '------').slice(0, 6).split('');
    const digitElements = container.querySelectorAll('.otp-digit');
    
    // Fill all 6 digit boxes (querySelectorAll only gets .otp-digit elements, not the dash)
    digits.forEach((digit, i) => {
      if (digitElements[i]) {
        digitElements[i].textContent = digit || '-';
        digitElements[i].classList.toggle('filled', digit && digit !== '-');
      }
    });
  }
  
  async regenerateOtp() {
    try {
      const data = await api.generateOtp();
      this.displayOtp(data.code);
      toast.success('New code generated');
    } catch (error) {
      toast.error('Failed to generate');
    }
  }
  
  async deleteOtp() {
    try {
      await api.deleteOtp();
      this.displayOtp('------');
      toast.success('Code deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  }
  
  openOtpSheet() {
    $('#otpSheet')?.classList.add('open');
    $('#otpSheetOverlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  closeOtpSheet() {
    $('#otpSheet')?.classList.remove('open');
    $('#otpSheetOverlay')?.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  async logout() {
    try {
      await api.logout();
    } catch (e) {}
    storage.clear();
    window.location.href = 'index.html';
  }
  
  // ===================== Mobile Event Picker =====================
  
  openMobileEventPicker() {
    const modal = $('#mobileEventPickerModal');
    if (!modal) return;
    modal.style.display = 'flex';
    
    this._mepSeason = this._getSeasonYear();
    this._mepFilter = 'today';
    this._mepAllEvents = [];
    this._mepSearchQuery = '';
    
    const input = $('#mobileEpSearchInput');
    if (input) input.value = '';
    
    this._populateMobileSeasonDropdown();
    
    document.querySelectorAll('.mobile-ep-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.mobile-ep-tab[data-ep-filter="today"]')?.classList.add('active');
    
    const seasonSelect = $('#mobileEpSeasonSelect');
    if (seasonSelect) seasonSelect.style.display = 'none';
    
    this._loadMobileEpData();
    if (typeof initIcons === 'function') initIcons();
  }
  
  closeMobileEventPicker() {
    const modal = $('#mobileEventPickerModal');
    if (modal) modal.style.display = 'none';
  }
  
  _getSeasonYear() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return month >= 9 ? year : year - 1;
  }
  
  _populateMobileSeasonDropdown() {
    const select = $('#mobileEpSeasonSelect');
    if (!select) return;
    
    const currentSeason = this._getSeasonYear();
    const startYear = 2019;
    
    let html = '';
    for (let year = currentSeason; year >= startYear; year--) {
      html += `<option value="${year}" ${year === currentSeason ? 'selected' : ''}>${year}-${year + 1}</option>`;
    }
    select.innerHTML = html;
  }
  
  _updateMepSeasonLabel() {
    // Deprecated
  }
  
  _switchMobileEpTab(filter) {
    this._mepFilter = filter;
    this._mepSearchQuery = '';
    const input = $('#mobileEpSearchInput');
    if (input) input.value = '';
    
    document.querySelectorAll('.mobile-ep-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.mobile-ep-tab[data-ep-filter="${filter}"]`)?.classList.add('active');
    
    const seasonSelect = $('#mobileEpSeasonSelect');
    if (seasonSelect) {
      seasonSelect.style.display = filter === 'all' ? 'block' : 'none';
      seasonSelect.value = this._mepSeason.toString();
    }
    
    this._loadMobileEpData();
  }
  
  _changeMobileEpSeason(delta) {
    // Deprecated
    this._mepSeason += delta;
    this._loadMobileEpData();
  }
  
  async _loadMobileEpData() {
    const list = $('#mobileEpEventList');
    if (!list) return;
    
    list.innerHTML = '<div class="mobile-ep-loading">Loading events...</div>';
    
    try {
      const params = {};
      
      if (this._mepFilter === 'today') {
        params.season = this._getSeasonYear();
      } else if (this._mepFilter === 'my-team') {
        params.season = this._getSeasonYear();
        if (this.teamNumber) params.team = this.teamNumber;
      } else {
        params.season = this._mepSeason;
      }
      
      if (this._mepSearchQuery) {
        params.query = this._mepSearchQuery;
      }
      
      const data = await api.searchEvents(params);
      this._mepAllEvents = data.events || [];
      
      if (this._mepFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        this._mepAllEvents = (data.events || []).filter(e => {
          if (e.status === 'live') return true;
          if (e.dateStart) {
            const startStr = e.dateStart.split('T')[0];
            const endStr = e.dateEnd ? e.dateEnd.split('T')[0] : startStr;
            return startStr <= todayStr && endStr >= todayStr;
          }
          return false;
        });
      }
      
      this._renderMobileEpList();
    } catch (err) {
      console.error('Mobile EP load error:', err);
      list.innerHTML = '<div class="mobile-ep-empty">Failed to load events.</div>';
    }
  }
  
  _filterMobileEpList(query) {
    this._mepSearchQuery = query.toLowerCase().trim();
    
    // Check for dev code
    if (query.toUpperCase() === 'DEVDATA1') {
      this._activateMobileDevMode();
      return;
    }
    
    if (this._mepFilter === 'all' || this._mepFilter === 'my-team') {
      this._loadMobileEpData();
    } else {
      this._renderMobileEpList();
    }
  }
  
  _activateMobileDevMode() {
    // Create a special dev/test event
    const devEvent = {
      code: '2026devtest',
      name: 'DEV TEST EVENT - Sample Data',
      type: 'Test',
      city: 'Dev City',
      stateprov: 'TEST',
      country: 'USA',
      dateStart: new Date().toISOString(),
      dateEnd: new Date().toISOString(),
      status: 'live'
    };
    
    // Select this event
    this._selectMobileEvent(devEvent.code, devEvent.name);
    
    toast.success('Dev mode activated - Using test event');
  }
  
  _renderMobileEpList() {
    const list = $('#mobileEpEventList');
    if (!list) return;
    
    let events = this._mepAllEvents || [];
    
    if (this._mepSearchQuery && this._mepFilter === 'today') {
      const q = this._mepSearchQuery;
      events = events.filter(e =>
        (e.code || '').toLowerCase().includes(q) ||
        (e.name || '').toLowerCase().includes(q) ||
        (e.city || '').toLowerCase().includes(q) ||
        (e.stateprov || '').toLowerCase().includes(q)
      );
    }
    
    if (events.length === 0) {
      list.innerHTML = '<div class="mobile-ep-empty">No events found</div>';
      return;
    }
    
    const live = events.filter(e => e.status === 'live');
    const upcoming = events.filter(e => e.status === 'upcoming');
    const past = events.filter(e => e.status === 'past');
    
    let html = '';
    
    if (live.length > 0) {
      html += '<div class="mobile-ep-section">Live Now</div>';
      html += live.map(e => this._renderMobileEpRow(e)).join('');
    }
    if (upcoming.length > 0) {
      html += '<div class="mobile-ep-section">Upcoming</div>';
      html += upcoming.map(e => this._renderMobileEpRow(e)).join('');
    }
    if (past.length > 0) {
      html += '<div class="mobile-ep-section">Past Events</div>';
      html += past.slice(0, 50).map(e => this._renderMobileEpRow(e)).join('');
    }
    
    list.innerHTML = html;
    
    list.querySelectorAll('.mobile-ep-event').forEach(row => {
      row.addEventListener('click', () => {
        const code = row.dataset.eventCode;
        const name = row.dataset.eventName;
        this._selectMobileEvent(code, name);
      });
    });
  }
  
  _renderMobileEpRow(event) {
    const isCurrent = event.code === this.currentEvent;
    const statusClass = event.status || 'upcoming';
    
    let dateStr = '';
    if (event.dateStart) {
      const start = new Date(event.dateStart);
      dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (event.dateEnd && event.dateEnd !== event.dateStart) {
        const end = new Date(event.dateEnd);
        dateStr += ` – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
    }
    
    const locationParts = [event.city, event.stateprov].filter(Boolean);
    const location = locationParts.join(', ');
    const meta = [dateStr, location, event.type].filter(Boolean).join(' · ');
    
    const eName = event.name || event.code;
    const div = document.createElement('div');
    div.textContent = eName;
    const escapedName = div.innerHTML;
    
    return `
      <div class="mobile-ep-event ${isCurrent ? 'current' : ''}" data-event-code="${event.code}" data-event-name="${escapedName}">
        <div class="mobile-ep-dot ${statusClass}"></div>
        <div class="mobile-ep-info">
          <div class="mobile-ep-name">${escapedName}</div>
          ${meta ? `<div class="mobile-ep-meta">${meta}</div>` : ''}
        </div>
        <div class="mobile-ep-code">${event.code}</div>
      </div>
    `;
  }
  
  async _selectMobileEvent(code, name) {
    this.currentEvent = code;
    this.eventName = name || code;
    storage.set('currentEvent', code);
    
    // Update banners
    this.updateEventBanners();
    
    this.closeMobileEventPicker();
    
    try {
      await this.loadEventData();
      toast.success(`Switched to ${this.eventName}`);
    } catch (err) {
      console.error('Failed to load event data:', err);
      toast.error('Failed to load event data');
    }
  }
}

// Initialize
const mobileApp = new MobileApp();
