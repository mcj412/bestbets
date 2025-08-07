const puppeteer = require('puppeteer');
const fs = require('fs');
const { saveComprehensiveData } = require('./save_comprehensive_data.js');

// Function to decode HTML entities
function decodeHtmlEntities(text) {
    return text
        .replace(/&amp;lt;/g, '<')
        .replace(/&amp;gt;/g, '>')
        .replace(/&amp;amp;/g, '&')
        .replace(/&amp;quot;/g, '"')
        .replace(/&amp;apos;/g, "'")
        .replace(/&amp;nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

// Function to extract XML content from HTML
function extractXMLFromHTML(htmlContent) {
    // If it's wrapped in HTML with <pre> tags, extract from there
    if (htmlContent.includes('<html>') && htmlContent.includes('<pre>')) {
        const preMatch = htmlContent.match(/<pre[^>]*>(.*?)<\/pre>/s);
        if (preMatch && preMatch[1]) {
            return decodeHtmlEntities(preMatch[1]);
        }
    }

    // If it's just encoded XML directly
    if (htmlContent.includes('&amp;lt;') || htmlContent.includes('&amp;gt;')) {
        return decodeHtmlEntities(htmlContent);
    }

    // If it's already clean XML
    if (htmlContent.includes('<?xml') || htmlContent.includes('<rss')) {
        return htmlContent;
    }

    return htmlContent; // Return as-is if we can't determine format
}

// Function to parse RSS XML to JSON
function parseRSSToJSON(xmlContent) {
    try {
        const items = [];

        // Extract all <item> elements
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;

        while ((match = itemRegex.exec(xmlContent)) !== null) {
            const itemContent = match[1];

            const title = itemContent.match(/<title>(.*?)<\/title>/)?.[1] || '';
            const link = itemContent.match(/<link>(.*?)<\/link>/)?.[1] || '';
            const description = itemContent.match(/<description>(.*?)<\/description>/)?.[1] || '';
            const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
            const category = itemContent.match(/<category>(.*?)<\/category>/)?.[1] || '';

            items.push({
                title: title.trim(),
                link: link.trim(),
                description: description.trim(),
                pubDate: pubDate.trim(),
                category: category.trim()
            });
        }

        // Extract channel info
        const channelTitle = xmlContent.match(/<title>(.*?)<\/title>/)?.[1] || 'Oddsshark RSS Feed';
        const channelLink = xmlContent.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const channelDescription = xmlContent.match(/<description>(.*?)<\/description>/)?.[1] || '';

        return {
            channel: {
                title: channelTitle.trim(),
                link: channelLink.trim(),
                description: channelDescription.trim()
            },
            items: items,
            totalItems: items.length,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error parsing RSS to JSON:', error);
        return {
            error: 'Failed to parse RSS',
            rawContent: xmlContent.substring(0, 1000) + '...'
        };
    }
}

// Function to extract odds data from article page
async function extractOddsFromArticle(page, articleUrl) {
    try {
        console.log(`📄 Scraping odds from: ${articleUrl}`);

        await page.goto(articleUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract comprehensive data from article
        const oddsData = await page.evaluate(() => {
            const data = {
                title: document.title,
                url: window.location.href,
                odds: [],
                tables: [],
                text: '',
                fullContent: {
                    paragraphs: [],
                    headings: [],
                    lists: [],
                    bettingTrends: [],
                    picks: [],
                    analysis: [],
                    keyInsights: []
                }
            };

            // Get main content text - expanded to capture everything
            const contentSelectors = [
                '.field--name-body',
                '.article-content',
                '.content-body',
                'article',
                '.main-content',
                '.post-content',
                '.entry-content',
                '.content',
                'main',
                '.story-content',
                '[role="main"]',
                '.article-body',
                '.post-body'
            ];

            let mainContent = '';
            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    mainContent = element.textContent || '';
                    break;
                }
            }

            // If no main content found, get body text
            if (!mainContent) {
                mainContent = document.body.textContent || '';
            }

            data.text = mainContent;

            // Extract all paragraphs
            const paragraphs = document.querySelectorAll('p');
            paragraphs.forEach(p => {
                const text = p.textContent?.trim();
                if (text && text.length > 20) {
                    data.fullContent.paragraphs.push(text);
                }
            });

            // Extract all headings
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headings.forEach(h => {
                const text = h.textContent?.trim();
                if (text && text.length > 0) {
                    data.fullContent.headings.push({
                        level: h.tagName.toLowerCase(),
                        text: text
                    });
                }
            });

            // Extract lists
            const lists = document.querySelectorAll('ul, ol');
            lists.forEach(list => {
                const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent?.trim()).filter(Boolean);
                if (items.length > 0) {
                    data.fullContent.lists.push(items);
                }
            });

            // Look for betting trends and picks (common patterns)
            const allText = mainContent.toLowerCase();

            // Extract betting trends
            const trendPatterns = [
                /betting trends?[:\s]+([^.!?]+)/gi,
                /trends?[:\s]+([^.!?]+)/gi,
                /(?:the|this).*?(?:trend|pattern)[:\s]+([^.!?]+)/gi,
                /(?:over|under).*?(?:trend|record)[:\s]+([^.!?]+)/gi
            ];

            trendPatterns.forEach(pattern => {
                const matches = allText.match(pattern);
                if (matches) {
                    data.fullContent.bettingTrends.push(...matches.map(m => m.trim()));
                }
            });

            // Extract picks
            const pickPatterns = [
                /(?:our|the|best|top).*?pick[:\s]+([^.!?]+)/gi,
                /pick[:\s]+([^.!?]+)/gi,
                /(?:recommend|suggest|bet).*?([^.!?]+)/gi,
                /(?:prediction|forecast)[:\s]+([^.!?]+)/gi
            ];

            pickPatterns.forEach(pattern => {
                const matches = allText.match(pattern);
                if (matches) {
                    data.fullContent.picks.push(...matches.map(m => m.trim()));
                }
            });

            // Extract analysis
            const analysisPatterns = [
                /analysis[:\s]+([^.!?]+)/gi,
                /(?:key|important).*?(?:point|factor)[:\s]+([^.!?]+)/gi,
                /(?:why|because|since).*?([^.!?]+)/gi,
                /(?:consider|note|remember).*?([^.!?]+)/gi
            ];

            analysisPatterns.forEach(pattern => {
                const matches = allText.match(pattern);
                if (matches) {
                    data.fullContent.analysis.push(...matches.map(m => m.trim()));
                }
            });

            // Extract key insights
            const insightPatterns = [
                /(?:key|important|main).*?(?:insight|takeaway)[:\s]+([^.!?]+)/gi,
                /(?:bottom line|conclusion)[:\s]+([^.!?]+)/gi,
                /(?:summary|overview)[:\s]+([^.!?]+)/gi
            ];

            insightPatterns.forEach(pattern => {
                const matches = allText.match(pattern);
                if (matches) {
                    data.fullContent.keyInsights.push(...matches.map(m => m.trim()));
                }
            });

            // Extract all tables
            const tables = document.querySelectorAll('table');
            tables.forEach((table, index) => {
                const tableData = {
                    index: index,
                    headers: [],
                    rows: []
                };

                // Get headers
                const headers = table.querySelectorAll('th');
                headers.forEach(header => {
                    tableData.headers.push(header.textContent.trim());
                });

                // If no th elements, use first row as headers
                if (tableData.headers.length === 0) {
                    const firstRow = table.querySelector('tr');
                    if (firstRow) {
                        const cells = firstRow.querySelectorAll('td');
                        cells.forEach(cell => {
                            tableData.headers.push(cell.textContent.trim());
                        });
                    }
                }

                // Get rows
                const rows = table.querySelectorAll('tr');
                rows.forEach((row, rowIndex) => {
                    if (rowIndex === 0 && tableData.headers.length > 0) return; // Skip header row

                    const cells = row.querySelectorAll('td');
                    if (cells.length > 0) {
                        const rowData = [];
                        cells.forEach(cell => {
                            rowData.push(cell.textContent.trim());
                        });
                        tableData.rows.push(rowData);
                    }
                });

                if (tableData.headers.length > 0 || tableData.rows.length > 0) {
                    data.tables.push(tableData);
                }
            });

            // Look for odds patterns in text
            const oddsPatterns = [
                /([+-]\d+\.?\d*)\s*(point|pt|pts)/gi,
                /(?:o\/u|over\/under|total)\s*(\d+\.?\d*)/gi,
                /([+-]\d{3,4})/g,
                /(\d+\.?\d*)\s*to\s*(\d+\.?\d*)/gi
            ];

            oddsPatterns.forEach(pattern => {
                const matches = data.text.match(pattern);
                if (matches) {
                    data.odds.push(...matches);
                }
            });

            return data;
        });

        console.log(`✅ Extracted odds data from article`);
        return oddsData;

    } catch (error) {
        console.error(`❌ Error extracting odds from ${articleUrl}:`, error);
        return {
            title: 'Error',
            url: articleUrl,
            odds: [],
            tables: [],
            text: '',
            error: error.message
        };
    }
}

async function getRSSWithPuppeteer() {
    console.log('Starting Puppeteer to bypass AWS WAF and extract odds data...');

    const browser = await puppeteer.launch({
        headless: true, // Run headless for server execution
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });

    try {
        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        console.log('Navigating to RSS feed...');

        // Go directly to the RSS feed
        await page.goto('https://www.oddsshark.com/rss.xml', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait a bit for any JavaScript to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get the page content
        const rawContent = await page.content();

        console.log(`Raw content length: ${rawContent.length}`);
        console.log(`First 500 chars: ${rawContent.substring(0, 500)}`);

        // Save the raw HTML-encoded content
        fs.writeFileSync('rss_puppeteer.xml', rawContent);
        console.log('✅ Saved raw HTML-encoded content to rss_puppeteer.xml');

        // Extract and decode the XML content
        const decodedXML = extractXMLFromHTML(rawContent);
        fs.writeFileSync('rss_decoded.xml', decodedXML);
        console.log('✅ Saved decoded XML to rss_decoded.xml');

        // Parse RSS to JSON
        const jsonData = parseRSSToJSON(decodedXML);
        fs.writeFileSync('rss_parsed.json', JSON.stringify(jsonData, null, 2));
        console.log('✅ Saved parsed JSON to rss_parsed.json');

        // Check if we got actual RSS content
        if (decodedXML.includes('<rss') || decodedXML.includes('<feed') || decodedXML.includes('<item>')) {
            console.log('🎉 SUCCESS! Got RSS content!');
            console.log(`📊 Found ${jsonData.totalItems || 0} RSS items`);

            // Extract odds from each article (process all articles)
            const articlesWithOdds = [];
            const maxArticles = jsonData.items.length;

            console.log(`\n🔍 Extracting odds from first ${maxArticles} articles...`);

            for (let i = 0; i < maxArticles; i++) {
                const item = jsonData.items[i];
                console.log(`\n📰 Processing article ${i + 1}/${maxArticles}: ${item.title}`);

                const oddsData = await extractOddsFromArticle(page, item.link);

                articlesWithOdds.push({
                    rssItem: item,
                    oddsData: oddsData
                });

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Save the enhanced data with odds
            const enhancedData = {
                ...jsonData,
                articlesWithOdds: articlesWithOdds,
                totalArticlesWithOdds: articlesWithOdds.length
            };

            fs.writeFileSync('rss_with_odds.json', JSON.stringify(enhancedData, null, 2));
            console.log('✅ Saved enhanced data with odds to rss_with_odds.json');

            // Save comprehensive data for AI interpretation
            saveComprehensiveData(enhancedData);

            // Show summary
            console.log('\n📊 Summary of extracted odds:');
            articlesWithOdds.forEach((article, index) => {
                console.log(`${index + 1}. ${article.rssItem.title}`);
                console.log(`   Tables found: ${article.oddsData.tables.length}`);
                console.log(`   Odds patterns: ${article.oddsData.odds.length}`);
                console.log(`   Content sections: ${Object.keys(article.oddsData.fullContent || {}).length}`);
                console.log(`   Paragraphs: ${article.oddsData.fullContent?.paragraphs?.length || 0}`);
                console.log(`   Trends found: ${article.oddsData.fullContent?.bettingTrends?.length || 0}`);
                console.log(`   Picks found: ${article.oddsData.fullContent?.picks?.length || 0}`);
                console.log(`   URL: ${article.rssItem.link}`);
                console.log('');
            });

            return {
                raw: rawContent,
                decoded: decodedXML,
                parsed: jsonData,
                enhanced: enhancedData
            };

        } else if (rawContent.includes('AWS WAF') || rawContent.includes('challenge')) {
            console.log('⚠️ Still getting AWS WAF challenge. Trying alternative approach...');

            // Try going to main page first, then RSS
            console.log('Navigating to main page first...');
            await page.goto('https://www.oddsshark.com', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('Now navigating to RSS feed...');
            await page.goto('https://www.oddsshark.com/rss.xml', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            const rawContent2 = await page.content();
            const decodedXML2 = extractXMLFromHTML(rawContent2);
            const jsonData2 = parseRSSToJSON(decodedXML2);

            fs.writeFileSync('rss_puppeteer_alt.xml', rawContent2);
            fs.writeFileSync('rss_decoded_alt.xml', decodedXML2);
            fs.writeFileSync('rss_parsed_alt.json', JSON.stringify(jsonData2, null, 2));

            console.log('✅ Saved alternative files with _alt suffix');

            if (decodedXML2.includes('<rss') || decodedXML2.includes('<feed') || decodedXML2.includes('<item>')) {
                console.log('🎉 SUCCESS with alternative approach!');
                return {
                    raw: rawContent2,
                    decoded: decodedXML2,
                    parsed: jsonData2
                };
            } else {
                console.log('❌ Still blocked. RSS feed is completely protected.');
                return null;
            }
        } else {
            console.log('⚠️ Got some content but not sure what it is.');
            return {
                raw: rawContent,
                decoded: decodedXML,
                parsed: jsonData
            };
        }

    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Error stack:', error.stack);
        return null;
    } finally {
        try {
            await browser.close();
            console.log('✅ Browser closed successfully');
        } catch (closeError) {
            console.error('❌ Error closing browser:', closeError);
        }
    }
}

// Run the script
getRSSWithPuppeteer().then(result => {
    if (result) {
        console.log('\n📁 Files created:');
        console.log('  - rss_puppeteer.xml (raw HTML-encoded)');
        console.log('  - rss_decoded.xml (clean XML)');
        console.log('  - rss_parsed.json (structured JSON data)');
        if (result.enhanced) {
            console.log('  - rss_with_odds.json (enhanced with odds data)');
        }
        console.log('\n🎯 You can now use any of these files in your application!');
    } else {
        console.log('\n❌ Failed to get RSS content with Puppeteer.');
    }
});
