const fetch = require('node-fetch');

async function testServer() {
    try {
        console.log('🧪 Testing server connection...');

        // Test basic server endpoint
        const testResponse = await fetch('http://localhost:3000/api/test');
        if (testResponse.ok) {
            const testData = await testResponse.json();
            console.log('✅ Server is running:', testData);
        } else {
            console.log('❌ Server test failed:', testResponse.status);
            return;
        }

        // Test RSS feed endpoint
        console.log('\n📡 Testing RSS feed endpoint...');
        const rssResponse = await fetch('http://localhost:3000/api/rss/feed');
        if (rssResponse.ok) {
            const rssData = await rssResponse.json();
            console.log('✅ RSS feed endpoint working');
            console.log(`   Found ${rssData.items?.length || 0} items`);
        } else {
            console.log('❌ RSS feed endpoint failed:', rssResponse.status);
        }

        console.log('\n🎯 Server appears to be working correctly!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n💡 Make sure the server is running with: npm run dev');
    }
}

testServer();
