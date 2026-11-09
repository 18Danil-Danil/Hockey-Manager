/* ============================================================
   ГЛАВНЫЙ RENDER
   ============================================================ */
function render() {
  const root = document.getElementById('app');
  if (!G.league) return;

  if (G.screen === 'select') {
    stopLiveAnimation();
    if (G.liveMatch && G.liveMatch.intervalId) { clearInterval(G.liveMatch.intervalId); G.liveMatch.intervalId = null; }
    G.liveMatch = null;
    root.innerHTML = renderTeamSelect();
    bindTeamSelect();
    saveGame();
    return;
  }

  if (G.liveMatch) {
    root.innerHTML = renderLiveMatchScreen();
    drawLiveCanvas();
    updateLiveClock();
    startLiveAnimation();
    return;
  }

  stopLiveAnimation();

  if (!G.playerTeamId) {
    root.innerHTML = renderFreeAgentScreen() + renderModal() + renderTeamModal() + renderInjuryPromptModal() + renderOpeningCupModal() + renderRoundResultsModal() + renderYouthPlayerModal();
    return;
  }

  const content =
    G.activeTab === 'standings' ? renderStandings() :
    G.activeTab === 'games' ? renderGames() :
    G.activeTab === 'calendar' ? renderCalendar() :
    G.activeTab === 'roster' ? renderRoster() :
    G.activeTab === 'lines' ? renderLines() :
    G.activeTab === 'stats' ? renderStats() :
    G.activeTab === 'market' ? renderMarket() :
    G.activeTab === 'trades' ? renderTrades() :
    G.activeTab === 'waivers' ? renderWaivers() :
    G.activeTab === 'inbox' ? renderInbox() :
    G.activeTab === 'news' ? renderNews() :
    G.activeTab === 'tactics' ? renderTactics() :
    G.activeTab === 'training' ? renderTraining() :
    G.activeTab === 'staff' ? renderStaff() :
    G.activeTab === 'infrastructure' ? renderInfrastructure() :
    G.activeTab === 'academy' ? renderAcademy() :
    G.activeTab === 'youth' ? renderYouthLeagues() :
    G.activeTab === 'finance' ? renderFinance() :
    G.activeTab === 'career' ? renderCareer() :
    G.activeTab === 'playoffs' ? renderPlayoffs() :
    G.activeTab === 'history' ? renderHistory() :
    renderRoster();

  root.innerHTML = renderHeader() + renderTabs() + content + renderModal() + renderTeamModal() + renderPressConferenceModal() + renderPlayoffInjuryModal() + renderInjuryPromptModal() + renderOpeningCupModal() + renderRoundResultsModal() + renderYouthPlayerModal();
  document.querySelectorAll('.tab').forEach(el => { el.onclick = () => { G.activeTab = el.dataset.tab; render(); }; });
  saveGame();
}
