const puppeteer = require('puppeteer');
const fs = require('fs');

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

        // Extract odds data from various table formats
        const oddsData = await page.evaluate(() => {
            const data = {
                title: document.title,
                url: window.location.href,
                odds: [],
                tables: [],
                text: ''
            };

            // Get main content text
            const contentSelectors = [
                '.field--name-body',
                '.article-content',
                '.content-body',
                'article',
                '.main-content'
            ];

            for (const selector of contentSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    data.text = element.textContent.trim();
                    break;
                }
            }

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

                // Get rows
                const rows = table.querySelectorAll('tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length > 0) {
                        const rowData = [];
                        cells.forEach(cell => {
                            rowData.push(cell.textContent.trim());
                        });
                        tableData.rows.push(rowData);
                    }
                });

                data.tables.push(tableData);
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
        headless: false, // Set to true if you don't want to see the browser
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
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

            // Show summary
            console.log('\n📊 Summary of extracted odds:');
            articlesWithOdds.forEach((article, index) => {
                console.log(`${index + 1}. ${article.rssItem.title}`);
                console.log(`   Tables found: ${article.oddsData.tables.length}`);
                console.log(`   Odds patterns: ${article.oddsData.odds.length}`);
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
        return null;
    } finally {
        await browser.close();
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
