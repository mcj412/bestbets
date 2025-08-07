const fs = require('fs');

// Smart filtering functions
function isJunkText(text) {
  if (!text || typeof text !== 'string') return true;

  const lowerText = text.toLowerCase();

  // Gambling problem hotlines and disclaimers
  const junkPatterns = [
    /gambling problem\? call/i,
    /1-800-gambler/i,
    /gamblinghelplinema\.org/i,
    /ccpg\.org/i,
    /mdgamblinghelp\.org/i,
    /gambleaware\.org/i,
    /ncpgambling\.org/i,
    /gamcare\.org\.uk/i,
    /new customers only/i,
    /deposit min\. \$10/i,
    /place first bet/i,
    /get \$150 in bonus bets/i,
    /terms and conditions/i,
    /eligibility restrictions apply/i,
    /void in/i,
    /21\+ and present in/i,
    /sponsored by/i,
    /on behalf of/i,
    /must register new account/i,
    /single-use and non-withdrawable/i,
    /bonus bets expire/i,
    /stake removed from payout/i,
    /sportsbook\.draftkings\.com/i,
    /the handicapping, sports odds information/i,
    /for entertainment purposes only/i,
    /please confirm the wagering regulations/i,
    /using this information to contravene/i,
    /the site is not associated with/i,
    /odds shark does not target/i,
    /please visit/i,
    /guidelines on responsible gaming/i
  ];

  return junkPatterns.some(pattern => pattern.test(lowerText));
}

function isDuplicateText(text, seenTexts) {
  if (!text || typeof text !== 'string') return true;

  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  if (seenTexts.has(normalized)) return true;

  seenTexts.add(normalized);
  return false;
}

function cleanParagraphs(paragraphs) {
  const seenTexts = new Set();
  return paragraphs
    .filter(text => !isJunkText(text))
    .filter(text => !isDuplicateText(text, seenTexts))
    .filter(text => text.trim().length > 10) // Remove very short text
    .map(text => text.trim());
}

function cleanHeadings(headings) {
  const seenTexts = new Set();
  return headings
    .filter(heading => !isJunkText(heading.text))
    .filter(heading => !isDuplicateText(heading.text, seenTexts))
    .filter(heading => !heading.text.toLowerCase().includes('terms and conditions'))
    .filter(heading => !heading.text.toLowerCase().includes('on this page'))
    .filter(heading => heading.text.trim().length > 3);
}

function cleanLists(lists) {
  const seenTexts = new Set();
  return lists
    .filter(list => !isJunkText(list.text))
    .filter(list => !isDuplicateText(list.text, seenTexts))
    .filter(list => list.text.trim().length > 5);
}

function cleanBettingTrends(trends) {
  const seenTexts = new Set();
  return trends
    .filter(trend => !isJunkText(trend))
    .filter(trend => !isDuplicateText(trend, seenTexts))
    .filter(trend => trend.trim().length > 10);
}

function cleanPicks(picks) {
  const seenTexts = new Set();
  return picks
    .filter(pick => !isJunkText(pick))
    .filter(pick => !isDuplicateText(pick, seenTexts))
    .filter(pick => pick.trim().length > 10);
}

function cleanAnalysis(analysis) {
  const seenTexts = new Set();
  return analysis
    .filter(item => !isJunkText(item))
    .filter(item => !isDuplicateText(item, seenTexts))
    .filter(item => item.trim().length > 10);
}

function cleanKeyInsights(insights) {
  const seenTexts = new Set();
  return insights
    .filter(insight => !isJunkText(insight))
    .filter(insight => !isDuplicateText(insight, seenTexts))
    .filter(insight => insight.trim().length > 10);
}

function saveComprehensiveData(enhancedData) {
  try {
    console.log('🧹 Cleaning and filtering comprehensive data...');

    const cleanedArticles = enhancedData.articlesWithOdds?.map(article => {
      const rssItem = article.rssItem;
      const oddsData = article.oddsData;

      // Clean all content sections
      const cleanedFullContent = {
        paragraphs: cleanParagraphs(oddsData.fullContent?.paragraphs || []),
        headings: cleanHeadings(oddsData.fullContent?.headings || []),
        lists: cleanLists(oddsData.fullContent?.lists || []),
        bettingTrends: cleanBettingTrends(oddsData.fullContent?.bettingTrends || []),
        picks: cleanPicks(oddsData.fullContent?.picks || []),
        analysis: cleanAnalysis(oddsData.fullContent?.analysis || []),
        keyInsights: cleanKeyInsights(oddsData.fullContent?.keyInsights || [])
      };

      return {
        title: rssItem.title,
        link: rssItem.link,
        pubDate: rssItem.pubDate,
        category: rssItem.category,
        fullContent: cleanedFullContent,
        oddsData: {
          tables: oddsData.tables || [],
          odds: oddsData.odds || [],
          text: oddsData.text || ''
        },
        aiAnalysis: {
          keyInsights: [],
          bettingRecommendations: [],
          trends: [],
          riskAssessment: '',
          summary: ''
        }
      };
    }) || [];

    const comprehensiveData = {
      metadata: {
        totalArticles: cleanedArticles.length,
        lastUpdated: new Date().toISOString(),
        source: 'Oddsshark RSS Feed',
        dataFormat: 'AI-Ready Clean Sports Data',
        filteringApplied: true,
        junkDataRemoved: true
      },
      articles: cleanedArticles
    };

    fs.writeFileSync('comprehensive_sports_data.json', JSON.stringify(comprehensiveData, null, 2));
    console.log('✅ Clean comprehensive data saved to comprehensive_sports_data.json');
    console.log(`📊 Processed ${cleanedArticles.length} articles with junk data filtered out`);

    return comprehensiveData;
  } catch (error) {
    console.error('❌ Error saving comprehensive data:', error);
    throw error;
  }
}

module.exports = { saveComprehensiveData };
