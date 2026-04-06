const fs = require('fs')
const path = require('path')

const ADVANCED = {
  es: {
    // Tab labels
    tabOverview: 'Resumen', tabPerformance: 'Rendimiento', tabMatchups: 'Enfrentamientos',
    tabTeam: 'Equipo', tabTrends: 'Tendencias', tabTools: 'Herramientas',
    // Overview
    winRateLabel: 'Win Rate', record: 'Récord', trophyChange: 'Trofeos', starPlayer: 'Star Player',
    avgDuration: 'Duración Media', currentStreak: 'Racha Actual', bestWinStreak: 'Mejor Racha W', worstLossStreak: 'Peor Racha L',
    streakWin: '¡Racha de {count} victorias!', streakLoss: 'Racha de {count} derrotas',
    // Brawler x Map
    brawlerMapTitle: 'Brawler × Mapa', brawlerMapEmpty: 'No hay datos suficientes de mapa',
    brawlerMapEmptyHint: 'Juega 3+ partidas con el mismo brawler en un mapa para ver rendimiento.',
    allBrawlers: 'Todos los Brawlers', games: 'partidas', on: 'en',
    // Matchups
    matchupsTitle: 'Enfrentamientos', strengths: 'Fortalezas', weaknesses: 'Debilidades',
    matchupsEmpty: 'No hay datos de enfrentamientos', matchupsEmptyHint: 'Juega 3+ partidas contra el mismo brawler para ver estadísticas.',
    showAll: 'Ver todos', showLess: 'Ver menos',
    // Team synergy
    teamTitle: 'Sinergia de Equipo', brawlerCombos: 'Combos Brawler', teammates: 'Compañeros',
    teamEmpty: 'No hay datos suficientes de equipo', teamEmptyHint: 'Juega más partidas con los mismos compañeros o combos de brawler para ver sinergias.',
    bestMode: 'Mejor modo',
    // Trends
    trendsTitle: 'Tendencias', winRateTrend: 'Tendencia Win Rate', trophyProgression: 'Progresión Trofeos',
    trendsEmpty: 'Necesitas más datos para tendencias',
    // Mastery
    masteryTitle: 'Curvas de Maestría', masteryEmpty: 'No hay datos para curvas de maestría',
    totalGames: 'Total partidas', currentWR: 'WR actual', firstWR: 'Primer WR', wrChange: 'Cambio WR',
    // Time of day
    timeTitle: 'Rendimiento por Hora', bestHour: 'Mejor hora', worstHour: 'Peor hora',
    // Tilt
    tiltTitle: 'Detector de Tilt',
    tiltWarning: '⚠️ Alerta de Tilt — Tu WR baja de {normal}% a {tilt}% tras 3+ derrotas. Considera descansar.',
    tiltOk: '✅ Manejas bien las rachas de derrotas',
    tiltNoData: '📊 Aún no hay datos suficientes',
    normalWR: 'WR Normal', tiltWR: 'WR en Tilt', tiltEpisodes: 'Episodios Tilt', avgGamesInTilt: 'Partidas en Tilt',
    recentSessions: 'Sesiones Recientes', battles: 'batallas',
    // Play Now
    playNowTitle: 'Juega Ahora', playNowEmpty: '¡Juega más partidas para desbloquear recomendaciones!',
    bestPick: 'MEJOR', bestWith: 'mejor con',
    // Counter-pick
    counterTitle: 'Asesor Counter-Pick', enemy: 'Enemigo', mapOptional: 'Mapa (opcional)',
    findCounter: 'Buscar Counter', vsBreakdown: 'Desglose',
    counterEmpty: 'No hay datos suficientes contra esos oponentes. ¡Juega más partidas!',
    // Info tooltips
    tipBrawlerMap: 'Muestra tu win rate por brawler en cada mapa. Verde = fuerte (60%+), dorado = medio, rojo = débil. Solo combos con 3+ partidas. Ordenado por confianza estadística.',
    tipMatchups: 'Tu win rate personal contra brawlers enemigos. "Fortalezas" muestra a quién ganas más; "Debilidades" a quién te gana. Basado en TUS datos, no en el meta global.',
    tipTeam: 'Combos Brawler muestra qué pares funcionan mejor juntos. Compañeros muestra tu win rate con jugadores específicos. Ordenado por Wilson score — método estadístico que considera el tamaño de muestra.',
    tipTrends: 'Tendencia diaria de win rate y progresión acumulada de trofeos. La línea discontinua al 50% es el punto de equilibrio. Busca tendencias ascendentes como señal de mejora.',
    tipTilt: 'Tilt = 3+ derrotas consecutivas en una sesión. Este análisis compara tu win rate normal vs después de entrar en tilt. Una gran caída sugiere que deberías descansar tras rachas de derrotas.',
    tipMastery: 'Muestra cómo evoluciona tu win rate acumulado con cada brawler a lo largo del tiempo. Una curva ascendente significa que estás dominando el brawler. Selecciona diferentes brawlers para comparar.',
    tipTimeOfDay: 'Tu win rate desglosado por hora del día (UTC). La barra resaltada es la hora actual. Ayuda a identificar cuándo juegas mejor y peor.',
    tipStarPlayer: 'La tasa de Star Player muestra con qué frecuencia fuiste el MVP de la partida. Mayor = estás cargando al equipo.',
  },
  en: {
    tabOverview: 'Overview', tabPerformance: 'Performance', tabMatchups: 'Matchups',
    tabTeam: 'Team', tabTrends: 'Trends', tabTools: 'Tools',
    winRateLabel: 'Win Rate', record: 'Record', trophyChange: 'Trophies', starPlayer: 'Star Player',
    avgDuration: 'Avg Duration', currentStreak: 'Current Streak', bestWinStreak: 'Best Win Streak', worstLossStreak: 'Worst Loss Streak',
    streakWin: '{count} win streak!', streakLoss: '{count} loss streak',
    brawlerMapTitle: 'Brawler × Map', brawlerMapEmpty: 'Not enough map data yet',
    brawlerMapEmptyHint: 'Play 3+ games with the same brawler on a map to see performance.',
    allBrawlers: 'All Brawlers', games: 'games', on: 'on',
    matchupsTitle: 'Matchups', strengths: 'Strengths', weaknesses: 'Weaknesses',
    matchupsEmpty: 'Not enough matchup data yet', matchupsEmptyHint: 'Play 3+ games against the same brawler to see matchup stats.',
    showAll: 'Show all', showLess: 'Show less',
    teamTitle: 'Team Synergy', brawlerCombos: 'Brawler Combos', teammates: 'Teammates',
    teamEmpty: 'Not enough team data yet', teamEmptyHint: 'Play more games with the same teammates or brawler combos to see synergy stats.',
    bestMode: 'Best mode',
    trendsTitle: 'Trends', winRateTrend: 'Win Rate Trend', trophyProgression: 'Trophy Progression',
    trendsEmpty: 'Need more data for trends',
    masteryTitle: 'Mastery Curves', masteryEmpty: 'Not enough data for mastery curves',
    totalGames: 'Total games', currentWR: 'Current WR', firstWR: 'First WR', wrChange: 'WR Change',
    timeTitle: 'Performance by Hour', bestHour: 'Best hour', worstHour: 'Worst hour',
    tiltTitle: 'Tilt Detector',
    tiltWarning: '⚠️ Tilt Alert — Your WR drops from {normal}% to {tilt}% after 3+ losses. Consider taking breaks.',
    tiltOk: '✅ You handle losing streaks well',
    tiltNoData: '📊 Not enough data yet',
    normalWR: 'Normal WR', tiltWR: 'Tilt WR', tiltEpisodes: 'Tilt Episodes', avgGamesInTilt: 'Games in Tilt',
    recentSessions: 'Recent Sessions', battles: 'battles',
    playNowTitle: 'Play Now', playNowEmpty: 'Play some more games to unlock recommendations!',
    bestPick: 'BEST', bestWith: 'best with',
    counterTitle: 'Counter-Pick Advisor', enemy: 'Enemy', mapOptional: 'Map (optional)',
    findCounter: 'Find Counter', vsBreakdown: 'Breakdown',
    counterEmpty: 'Not enough data against these opponents. Play more games!',
    tipBrawlerMap: 'Shows your win rate for each brawler on each map. Green = strong (60%+), gold = average, red = weak. Only combos with 3+ games shown. Ranked by statistical confidence.',
    tipMatchups: 'Your personal win rate against specific enemy brawlers. "Strengths" shows opponents you beat most; "Weaknesses" shows who counters you. Based on YOUR data, not global meta.',
    tipTeam: 'Brawler Combos shows which brawler pairs work best together. Teammates shows your win rate with specific players. Ranked by Wilson score — a statistical method that accounts for sample size.',
    tipTrends: 'Daily win rate trend and cumulative trophy progression. The dashed line at 50% is the break-even point. Look for upward trends as a sign of improvement.',
    tipTilt: 'Tilt = 3+ consecutive losses in a session. This analysis compares your win rate during normal play vs after tilting. A big drop suggests you should take breaks after losing streaks.',
    tipMastery: 'Shows how your cumulative win rate with each brawler evolves over time. An upward curve means you are mastering the brawler. Select different brawlers to compare.',
    tipTimeOfDay: 'Your win rate broken down by hour of day (UTC). The highlighted bar is the current hour. Helps identify when you play best and worst.',
    tipStarPlayer: 'Star Player rate shows how often you were the MVP of the match. Higher = you are carrying your team.',
  },
}

// Generate basic translations for other locales by copying English
const otherLocales = ['fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

const dir = path.join(__dirname, '..', 'messages')
const locales = ['es', 'en', ...otherLocales]

for (const locale of locales) {
  const filePath = path.join(dir, locale + '.json')
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  content.advancedAnalytics = ADVANCED[locale] || ADVANCED.en
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
}

console.log('Done: advancedAnalytics i18n added to all 13 locales')
