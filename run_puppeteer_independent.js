const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting independent Puppeteer process...');

// Run puppeteer_rss.js in a completely detached process
const child = spawn('node', ['puppeteer_rss.js'], {
    detached: true,
    stdio: 'inherit', // Let it use the current terminal
    shell: true
});

// Don't wait for the child process
child.unref();

console.log('✅ Puppeteer process started independently');
console.log('📝 Check the terminal for Puppeteer output');
console.log('💾 Files will be updated when Puppeteer completes');
console.log('🔄 You can now use the web interface normally');

// Exit this script immediately
process.exit(0);
