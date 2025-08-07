import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../utils/config';
import logger from '../utils/logger';

interface AIAnalysisResult {
  keyInsights: string[];
  bettingRecommendations: string[];
  trends: string[];
  riskAssessment: string;
  summary: string;
  generalConsensus: string;
  blackSwanEvents: string[];
  confidencePercentage: number;
  lineHistory: string;
  toCover: string;
  sharpMovement: string;
}

interface SportsArticleData {
  title: string;
  link: string;
  pubDate: string;
  category: string;
  fullContent: {
    paragraphs: string[];
    headings: any[];
    bettingTrends?: string[];
    picks?: string[];
    analysis?: string[];
    keyInsights?: string[];
  };
  oddsData?: any;
}

export class AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!config.api.geminiApiKey) {
      logger.warn('GEMINI_API_KEY not found in environment variables');
      return;
    }

    this.genAI = new GoogleGenerativeAI(config.api.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  private createAnalysisPrompt(articleData: SportsArticleData): string {
    return `
You are an expert sports betting analyst with deep knowledge of odds analysis, line movements, and market psychology. Analyze the following sports betting article and provide comprehensive insights.

ARTICLE DATA:
Title: ${articleData.title}
Link: ${articleData.link}
Publication Date: ${articleData.pubDate}

CONTENT:
${articleData.fullContent.paragraphs?.join('\n\n') || 'No content available'}

ODDS DATA:
${articleData.oddsData ? JSON.stringify(articleData.oddsData, null, 2) : 'No odds data available'}

BETTING TRENDS:
${articleData.fullContent.bettingTrends?.join('\n') || 'No trends identified'}

PICKS & ANALYSIS:
${articleData.fullContent.picks?.join('\n') || 'No picks available'}
${articleData.fullContent.analysis?.join('\n') || 'No analysis available'}

TASK:
Provide a comprehensive analysis in the following JSON format:

{
  "keyInsights": [
    "List 3-5 key insights about the matchup, teams, or betting situation"
  ],
  "bettingRecommendations": [
    "List 2-3 specific betting recommendations with reasoning"
  ],
  "trends": [
    "List 2-3 important trends or patterns identified"
  ],
  "riskAssessment": "Low/Medium/High - Brief explanation of risk level",
  "summary": "2-3 sentence summary of the overall betting situation",
  "generalConsensus": "What is the general market sentiment and why? Include contrarian opportunities if any exist",
  "blackSwanEvents": [
    "List 2-3 potential unexpected events that could significantly impact the outcome"
  ],
  "confidencePercentage": 85,
  "lineHistory": "Analysis of how the line has moved and what it indicates about market sentiment",
  "toCover": "Mathematical analysis of what needs to happen for bets to cover, including key scenarios",
  "sharpMovement": "Analysis of any sharp money movements, line movements, or professional betting patterns"
}

IMPORTANT GUIDELINES:
- Be specific and actionable in recommendations
- Confidence percentage should be 0-100 based on data quality and certainty
- Focus on actionable insights for bettors
- Consider market psychology and line movements
- Identify both obvious and contrarian opportunities
- Be realistic about risk levels
- Use sports betting terminology appropriately
- Consider historical context and current market conditions

Respond ONLY with valid JSON. Do not include any other text or formatting.
    `;
  }

  async analyzeSportsData(articleData: SportsArticleData): Promise<AIAnalysisResult> {
    try {
      if (!this.model) {
        throw new Error('AI model not initialized - check GEMINI_API_KEY');
      }

      logger.info(`🤖 Starting AI analysis for: ${articleData.title}`);

      const prompt = this.createAnalysisPrompt(articleData);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const analysis: AIAnalysisResult = JSON.parse(cleanedText);

      logger.info(`✅ AI analysis completed for: ${articleData.title} (Confidence: ${analysis.confidencePercentage}%)`);

      return analysis;

    } catch (error) {
      logger.error('❌ Error in AI analysis:', error);

      // Return fallback analysis
      return {
        keyInsights: ["Unable to analyze data - AI service error"],
        bettingRecommendations: ["Check back later for updated analysis"],
        trends: ["Analysis temporarily unavailable"],
        riskAssessment: "Unable to assess - service error",
        summary: "AI analysis failed. Please try again later.",
        generalConsensus: "Unable to determine market consensus due to analysis error",
        blackSwanEvents: ["Analysis error prevents identification of unexpected events"],
        confidencePercentage: 0,
        lineHistory: "Line history analysis unavailable",
        toCover: "Cover analysis unavailable",
        sharpMovement: "Sharp movement analysis unavailable"
      };
    }
  }

  async analyzeAllArticles(articles: SportsArticleData[]): Promise<any[]> {
    const enhancedArticles = [];

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      if (!article) continue;

      logger.info(`📊 Processing article ${i + 1}/${articles.length}: ${article.title}`);

      try {
        const aiAnalysis = await this.analyzeSportsData(article);

        // Add AI analysis to article
        const enhancedArticle = {
          ...article,
          aiAnalysis
        };

        enhancedArticles.push(enhancedArticle);

        // Rate limiting - wait between API calls
        if (i < articles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        logger.error(`❌ Failed to analyze article ${i + 1}:`, error);
        // Continue with next article
        enhancedArticles.push(article);
      }
    }

    return enhancedArticles;
  }
}

export const aiService = new AIService();
