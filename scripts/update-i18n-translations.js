const fs = require('fs');

const translations = {
  it: {
    metaPro: {
      tabMetaPro: 'Meta PRO',
      mapSelectorTitle: 'Seleziona Mappa',
      liveMaps: 'In Rotazione',
      historicalMaps: 'Mappe Storiche',
      historicalLocked: 'Solo Premium',
      topBrawlersTitle: 'Migliori Brawler (PRO)',
      totalBattles: '{count} battaglie pro analizzate',
      trendRising: 'In salita',
      trendFalling: 'In discesa',
      trendStable: 'Stabile',
      trendDelta: '{delta}% questa settimana',
      counterTitle: 'Contro-Pick',
      counterHint: 'Se il nemico sceglie {name}, gioca:',
      proTriosTitle: 'Migliori Composizioni (PRO)',
      gapTitle: 'Il Tuo Divario vs PRO',
      gapAbove: 'Sopra il PRO',
      gapOnPar: 'Alla Pari',
      gapBelow: 'Sotto il PRO',
      gapImprove: 'Opportunità di miglioramento',
      matchupGapTitle: 'Divari di Scontro',
      matchupGapHint: 'Scontri dove differisci di più dai PRO',
      proBadgeTooltip: 'Basato su {count} battaglie pro',
      proWR: 'PRO {wr}%',
      yourWR: 'Tu {wr}%',
      windowLabel: 'Finestra Temporale',
      window7d: '7 giorni',
      window14d: '14 giorni',
      window30d: '30 giorni',
      window90d: '90 giorni',
      noDataForMap: 'Dati pro insufficienti per questa mappa',
      upgradeForGap: 'Passa a PRO per vedere la tua analisi'
    },
    advancedAnalytics: {
      modePerformance: 'Prestazioni per Modalità',
      mapPerformance: 'Prestazioni per Mappa',
      brawlerTierList: 'La Tua Tier List Brawler'
    }
  },
  pt: {
    metaPro: {
      tabMetaPro: 'Meta PRO',
      mapSelectorTitle: 'Selecionar Mapa',
      liveMaps: 'Em Rotação',
      historicalMaps: 'Mapas Históricos',
      historicalLocked: 'Apenas Premium',
      topBrawlersTitle: 'Melhores Brawlers (PRO)',
      totalBattles: '{count} batalhas pro analisadas',
      trendRising: 'Subindo',
      trendFalling: 'Descendo',
      trendStable: 'Estável',
      trendDelta: '{delta}% esta semana',
      counterTitle: 'Contra-Picks',
      counterHint: 'Se o inimigo escolhe {name}, jogue:',
      proTriosTitle: 'Melhores Composições (PRO)',
      gapTitle: 'Sua Diferença vs PROs',
      gapAbove: 'Acima do PRO',
      gapOnPar: 'Igual',
      gapBelow: 'Abaixo do PRO',
      gapImprove: 'Oportunidade de melhoria',
      matchupGapTitle: 'Diferenças de Confronto',
      matchupGapHint: 'Confrontos onde você mais difere dos PROs',
      proBadgeTooltip: 'Baseado em {count} batalhas pro',
      proWR: 'PRO {wr}%',
      yourWR: 'Você {wr}%',
      windowLabel: 'Período',
      window7d: '7 dias',
      window14d: '14 dias',
      window30d: '30 dias',
      window90d: '90 dias',
      noDataForMap: 'Dados pro insuficientes para este mapa',
      upgradeForGap: 'Atualize para PRO para ver sua análise'
    },
    advancedAnalytics: {
      modePerformance: 'Desempenho por Modo',
      mapPerformance: 'Desempenho por Mapa',
      brawlerTierList: 'Sua Tier List de Brawlers'
    }
  },
  ja: {
    metaPro: {
      tabMetaPro: 'メタPRO',
      mapSelectorTitle: 'マップ選択',
      liveMaps: 'ローテーション中',
      historicalMaps: '過去のマップ',
      historicalLocked: 'プレミアム限定',
      topBrawlersTitle: 'トップブロウラー (PRO)',
      totalBattles: '{count}プロバトル分析済み',
      trendRising: '上昇中',
      trendFalling: '下降中',
      trendStable: '安定',
      trendDelta: '今週{delta}%',
      counterTitle: 'カウンターピック',
      counterHint: '{name}に対するベストピック:',
      proTriosTitle: 'ベストチーム構成 (PRO)',
      gapTitle: 'PRO比較',
      gapAbove: 'PRO以上',
      gapOnPar: '同等',
      gapBelow: 'PRO以下',
      gapImprove: '改善のチャンス',
      matchupGapTitle: 'マッチアップ差',
      matchupGapHint: 'PROとの差が大きいマッチアップ',
      proBadgeTooltip: '{count}プロバトルに基づく',
      proWR: 'PRO {wr}%',
      yourWR: 'あなた {wr}%',
      windowLabel: '期間',
      window7d: '7日間',
      window14d: '14日間',
      window30d: '30日間',
      window90d: '90日間',
      noDataForMap: 'このマップのプロデータ不足',
      upgradeForGap: 'PROにアップグレードして分析を見る'
    },
    advancedAnalytics: {
      modePerformance: 'モード別パフォーマンス',
      mapPerformance: 'マップ別パフォーマンス',
      brawlerTierList: 'ブロウラーティアリスト'
    }
  },
  ko: {
    metaPro: {
      tabMetaPro: '메타 PRO',
      mapSelectorTitle: '맵 선택',
      liveMaps: '현재 로테이션',
      historicalMaps: '과거 맵',
      historicalLocked: '프리미엄 전용',
      topBrawlersTitle: '탑 브롤러 (PRO)',
      totalBattles: '{count}개 프로 배틀 분석',
      trendRising: '상승 중',
      trendFalling: '하락 중',
      trendStable: '안정',
      trendDelta: '이번 주 {delta}%',
      counterTitle: '카운터 픽',
      counterHint: '적이 {name}을(를) 픽하면:',
      proTriosTitle: '최고 팀 구성 (PRO)',
      gapTitle: 'PRO 대비 격차',
      gapAbove: 'PRO 이상',
      gapOnPar: '동등',
      gapBelow: 'PRO 이하',
      gapImprove: '개선 기회',
      matchupGapTitle: '매치업 격차',
      matchupGapHint: 'PRO와 가장 큰 차이가 나는 매치업',
      proBadgeTooltip: '{count}개 프로 배틀 기반',
      proWR: 'PRO {wr}%',
      yourWR: '나 {wr}%',
      windowLabel: '기간',
      window7d: '7일',
      window14d: '14일',
      window30d: '30일',
      window90d: '90일',
      noDataForMap: '이 맵의 프로 데이터 부족',
      upgradeForGap: 'PRO로 업그레이드하여 분석 보기'
    },
    advancedAnalytics: {
      modePerformance: '모드별 성과',
      mapPerformance: '맵별 성과',
      brawlerTierList: '브롤러 티어 리스트'
    }
  },
  zh: {
    metaPro: {
      tabMetaPro: 'Meta PRO',
      mapSelectorTitle: '选择地图',
      liveMaps: '当前轮换',
      historicalMaps: '历史地图',
      historicalLocked: '仅限高级版',
      topBrawlersTitle: '顶级英雄 (PRO)',
      totalBattles: '已分析{count}场职业战斗',
      trendRising: '上升',
      trendFalling: '下降',
      trendStable: '稳定',
      trendDelta: '本周{delta}%',
      counterTitle: '克制选择',
      counterHint: '如果敌方选择{name}，推荐:',
      proTriosTitle: '最佳阵容 (PRO)',
      gapTitle: '与PRO的差距',
      gapAbove: '超越PRO',
      gapOnPar: '持平',
      gapBelow: '低于PRO',
      gapImprove: '提升空间',
      matchupGapTitle: '对战差距',
      matchupGapHint: '与PRO差距最大的对战',
      proBadgeTooltip: '基于{count}场职业战斗',
      proWR: 'PRO {wr}%',
      yourWR: '你 {wr}%',
      windowLabel: '时间范围',
      window7d: '7天',
      window14d: '14天',
      window30d: '30天',
      window90d: '90天',
      noDataForMap: '该地图职业数据不足',
      upgradeForGap: '升级PRO查看差距分析'
    },
    advancedAnalytics: {
      modePerformance: '模式表现',
      mapPerformance: '地图表现',
      brawlerTierList: '英雄排行榜'
    }
  },
  ar: {
    metaPro: {
      tabMetaPro: 'Meta PRO',
      mapSelectorTitle: 'اختر الخريطة',
      liveMaps: 'في التناوب',
      historicalMaps: 'خرائط تاريخية',
      historicalLocked: 'للمميزين فقط',
      topBrawlersTitle: 'أفضل المقاتلين (PRO)',
      totalBattles: '{count} معركة احترافية تم تحليلها',
      trendRising: 'صاعد',
      trendFalling: 'هابط',
      trendStable: 'مستقر',
      trendDelta: '{delta}% هذا الأسبوع',
      counterTitle: 'اختيارات مضادة',
      counterHint: 'إذا اختار العدو {name}، العب:',
      proTriosTitle: 'أفضل التشكيلات (PRO)',
      gapTitle: 'فجوتك مقابل المحترفين',
      gapAbove: 'فوق المحترف',
      gapOnPar: 'متساوٍ',
      gapBelow: 'تحت المحترف',
      gapImprove: 'فرصة للتحسين',
      matchupGapTitle: 'فجوات المواجهة',
      matchupGapHint: 'المواجهات التي تختلف فيها أكثر عن المحترفين',
      proBadgeTooltip: 'بناءً على {count} معركة احترافية',
      proWR: 'PRO {wr}%',
      yourWR: 'أنت {wr}%',
      windowLabel: 'الفترة الزمنية',
      window7d: '7 أيام',
      window14d: '14 يوم',
      window30d: '30 يوم',
      window90d: '90 يوم',
      noDataForMap: 'بيانات احترافية غير كافية لهذه الخريطة',
      upgradeForGap: 'ترقية إلى PRO لرؤية تحليل الفجوة'
    },
    advancedAnalytics: {
      modePerformance: 'الأداء حسب الوضع',
      mapPerformance: 'الأداء حسب الخريطة',
      brawlerTierList: 'قائمة تصنيف المقاتلين'
    }
  },
  ru: {
    metaPro: {
      tabMetaPro: 'Мета PRO',
      mapSelectorTitle: 'Выбрать карту',
      liveMaps: 'В ротации',
      historicalMaps: 'Архивные карты',
      historicalLocked: 'Только для премиум',
      topBrawlersTitle: 'Лучшие бойцы (PRO)',
      totalBattles: '{count} про-боёв проанализировано',
      trendRising: 'Растёт',
      trendFalling: 'Падает',
      trendStable: 'Стабильно',
      trendDelta: '{delta}% за неделю',
      counterTitle: 'Контр-пики',
      counterHint: 'Если враг выбрал {name}, играйте:',
      proTriosTitle: 'Лучшие составы (PRO)',
      gapTitle: 'Ваш разрыв с PRO',
      gapAbove: 'Выше PRO',
      gapOnPar: 'На уровне',
      gapBelow: 'Ниже PRO',
      gapImprove: 'Возможность для улучшения',
      matchupGapTitle: 'Разрывы в матчапах',
      matchupGapHint: 'Матчапы с наибольшим отличием от PRO',
      proBadgeTooltip: 'На основе {count} про-боёв',
      proWR: 'PRO {wr}%',
      yourWR: 'Вы {wr}%',
      windowLabel: 'Период',
      window7d: '7 дней',
      window14d: '14 дней',
      window30d: '30 дней',
      window90d: '90 дней',
      noDataForMap: 'Недостаточно про-данных для этой карты',
      upgradeForGap: 'Перейдите на PRO для анализа разрывов'
    },
    advancedAnalytics: {
      modePerformance: 'Эффективность по режиму',
      mapPerformance: 'Эффективность по карте',
      brawlerTierList: 'Ваш тир-лист бойцов'
    }
  },
  tr: {
    metaPro: {
      tabMetaPro: 'Meta PRO',
      mapSelectorTitle: 'Harita Seç',
      liveMaps: 'Rotasyonda',
      historicalMaps: 'Geçmiş Haritalar',
      historicalLocked: 'Sadece Premium',
      topBrawlersTitle: "En İyi Brawler'lar (PRO)",
      totalBattles: '{count} pro savaş analiz edildi',
      trendRising: 'Yükseliyor',
      trendFalling: 'Düşüyor',
      trendStable: 'Sabit',
      trendDelta: 'Bu hafta {delta}%',
      counterTitle: 'Karşı Seçimler',
      counterHint: 'Düşman {name} seçerse, oyna:',
      proTriosTitle: 'En İyi Takım Kompozisyonları (PRO)',
      gapTitle: "PRO'larla Farkınız",
      gapAbove: 'PRO Üstü',
      gapOnPar: 'Eşit',
      gapBelow: 'PRO Altı',
      gapImprove: 'Gelişim fırsatı',
      matchupGapTitle: 'Eşleşme Farkları',
      matchupGapHint: "PRO'lardan en çok farklılaştığınız eşleşmeler",
      proBadgeTooltip: '{count} pro savaşa dayalı',
      proWR: 'PRO {wr}%',
      yourWR: 'Sen {wr}%',
      windowLabel: 'Zaman Aralığı',
      window7d: '7 gün',
      window14d: '14 gün',
      window30d: '30 gün',
      window90d: '90 gün',
      noDataForMap: 'Bu harita için yeterli pro veri yok',
      upgradeForGap: "Fark analizini görmek için PRO'ya geç"
    },
    advancedAnalytics: {
      modePerformance: 'Mod Bazında Performans',
      mapPerformance: 'Harita Bazında Performans',
      brawlerTierList: 'Brawler Sıralaman'
    }
  },
  pl: {
    metaPro: {
      tabMetaPro: 'Meta PRO',
      mapSelectorTitle: 'Wybierz mapę',
      liveMaps: 'W rotacji',
      historicalMaps: 'Mapy historyczne',
      historicalLocked: 'Tylko Premium',
      topBrawlersTitle: 'Najlepsi Brawlerzy (PRO)',
      totalBattles: '{count} bitew pro przeanalizowanych',
      trendRising: 'Rośnie',
      trendFalling: 'Spada',
      trendStable: 'Stabilny',
      trendDelta: '{delta}% w tym tygodniu',
      counterTitle: 'Kontr-picki',
      counterHint: 'Jeśli wróg wybierze {name}, graj:',
      proTriosTitle: 'Najlepsze składy (PRO)',
      gapTitle: 'Twoja różnica vs PRO',
      gapAbove: 'Powyżej PRO',
      gapOnPar: 'Na równi',
      gapBelow: 'Poniżej PRO',
      gapImprove: 'Szansa na poprawę',
      matchupGapTitle: 'Różnice w starciach',
      matchupGapHint: 'Starcia, w których najbardziej różnisz się od PRO',
      proBadgeTooltip: 'Na podstawie {count} bitew pro',
      proWR: 'PRO {wr}%',
      yourWR: 'Ty {wr}%',
      windowLabel: 'Okres',
      window7d: '7 dni',
      window14d: '14 dni',
      window30d: '30 dni',
      window90d: '90 dni',
      noDataForMap: 'Za mało danych pro dla tej mapy',
      upgradeForGap: 'Przejdź na PRO, aby zobaczyć analizę'
    },
    advancedAnalytics: {
      modePerformance: 'Wydajność wg trybu',
      mapPerformance: 'Wydajność wg mapy',
      brawlerTierList: 'Twoja lista rangowa Brawlerów'
    }
  }
};

const locales = Object.keys(translations);
for (const locale of locales) {
  const filePath = `C:/Proyectos_Agentes/brawlValue/messages/${locale}.json`;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Replace metaPro entirely
  data.metaPro = translations[locale].metaPro;

  // Update advancedAnalytics keys
  if (data.advancedAnalytics) {
    data.advancedAnalytics.modePerformance = translations[locale].advancedAnalytics.modePerformance;
    data.advancedAnalytics.mapPerformance = translations[locale].advancedAnalytics.mapPerformance;
    data.advancedAnalytics.brawlerTierList = translations[locale].advancedAnalytics.brawlerTierList;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Updated ${locale}.json`);
}
console.log('All done!');
