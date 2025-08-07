const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Google Generative AI
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function processSportsDataWithAI() {
    try {
        console.log('🤖 Starting AI analysis of sports data...');

        // Check if comprehensive data exists
        if (!fs.existsSync('comprehensive_sports_data.json')) {
            console.log('❌ No comprehensive data found. Run puppeteer_rss.js first.');
            return;
        }

        // Load the comprehensive data
        const data = JSON.parse(fs.readFileSync('comprehensive_sports_data.json', 'utf8'));
        console.log(`📊 Found ${data.articles.length} articles to analyze`);

        // Check if Gemini API key is available
        if (!process.env.GEMINI_API_KEY) {
            console.log('❌ GEMINI_API_KEY not found in environment variables');
            console.log('💡 Please add your GEMINI_API_KEY to the .env file');
            return;
        }

        // Initialize Gemini AI
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        console.log('✅ Gemini AI initialized successfully');
        const enhancedArticles = [];

        for (let i = 0; i < data.articles.length; i++) {
            const article = data.articles[i];
            console.log(`\n🤖 Analyzing article ${i + 1}/${data.articles.length}: ${article.title}`);

            // Create real AI analysis
            const aiAnalysis = await createRealAIAnalysis(article, model);

            // Add AI analysis to article
            const enhancedArticle = {
                ...article,
                aiAnalysis: aiAnalysis
            };

            enhancedArticles.push(enhancedArticle);

            // Small delay between processing to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Save AI-enhanced data
        const aiEnhancedData = {
            ...data,
            articles: enhancedArticles,
            aiProcessed: true,
            lastAIUpdate: new Date().toISOString(),
            aiVersion: '1.0.0',
            totalArticlesAnalyzed: enhancedArticles.length
        };

        fs.writeFileSync('ai_enhanced_sports_data.json', JSON.stringify(aiEnhancedData, null, 2));
        console.log('✅ AI-enhanced data saved to ai_enhanced_sports_data.json');

        // Show summary
        console.log('\n🤖 AI Analysis Summary:');
        enhancedArticles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   Confidence: ${article.aiAnalysis.confidencePercentage}%`);
            console.log(`   Risk: ${article.aiAnalysis.riskAssessment}`);
            console.log(`   Key Insights: ${article.aiAnalysis.keyInsights.length}`);
            console.log('');
        });

        console.log('\n✅ AI Analysis Complete!');
        console.log('   - Real AI analysis has been performed using Gemini');
        console.log('   - The AI-enhanced data is ready for the frontend');
        console.log('   - Check ai_enhanced_sports_data.json for results');

    } catch (error) {
        console.error('❌ Error processing articles with AI:', error);
    }
}

async function createRealAIAnalysis(article, model) {
    try {
        // Prepare the data for AI analysis
        const analysisData = {
            title: article.title,
            oddsData: article.oddsData || {},
            fullContent: article.fullContent || {},
            link: article.link
        };

        // Create a comprehensive prompt for the AI
        const prompt = `You are a professional sports betting analyst with expertise in analyzing odds, trends, and betting opportunities.

Please analyze the following sports betting data and provide a comprehensive analysis in JSON format:

TITLE: ${analysisData.title}
ODDS DATA: ${JSON.stringify(analysisData.oddsData, null, 2)}
CONTENT: ${JSON.stringify(analysisData.fullContent, null, 2)}

Provide your analysis in the following JSON format (respond ONLY with valid JSON):
{
  "keyInsights": ["3-5 key insights about the betting situation"],
  "bettingRecommendations": ["3-5 specific betting recommendations"],
  "trends": ["3-5 relevant betting trends"],
  "riskAssessment": "Low/Medium/High - Brief explanation",
  "summary": "2-3 sentence summary of the overall betting situation",
  "generalConsensus": "What is the general market sentiment and why? Include contrarian opportunities if any exist",
  "blackSwanEvents": ["2-3 potential unexpected events that could significantly impact the outcome"],
  "confidencePercentage": 85,
  "lineHistory": "Analysis of how the line has moved and what it indicates about market sentiment",
  "toCover": "Mathematical analysis of what needs to happen for bets to cover, including key scenarios",
  "sharpMovement": "Analysis of any sharp money movements, line movements, or professional betting patterns"
}

Focus on actionable insights and be specific about the teams, odds, and betting opportunities.`;

        // Call the Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse the JSON response - handle markdown code blocks
        let jsonText = text.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const aiAnalysis = JSON.parse(jsonText);

        // Ensure all required fields are present
        return {
            keyInsights: aiAnalysis.keyInsights || [],
            bettingRecommendations: aiAnalysis.bettingRecommendations || [],
            trends: aiAnalysis.trends || [],
            riskAssessment: aiAnalysis.riskAssessment || "Medium - Analysis completed",
            summary: aiAnalysis.summary || "AI analysis completed",
            generalConsensus: aiAnalysis.generalConsensus || "Market sentiment analyzed",
            blackSwanEvents: aiAnalysis.blackSwanEvents || [],
            confidencePercentage: aiAnalysis.confidencePercentage || 75,
            lineHistory: aiAnalysis.lineHistory || "Line history analyzed",
            toCover: aiAnalysis.toCover || "Cover analysis provided",
            sharpMovement: aiAnalysis.sharpMovement || "Sharp movement analyzed"
        };
    } catch (error) {
        console.log(`Error in AI analysis: ${error.message}`);
        throw error;
    }
}



// Run the AI analysis
if (require.main === module) {
    processSportsDataWithAI();
}

module.exports = { processSportsDataWithAI };
