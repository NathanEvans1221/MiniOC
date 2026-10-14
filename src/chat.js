#!/usr/bin/env node
require('dotenv').config();
const { processMessage } = require('./ai');

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node chat.js <message>');
        console.log('Example: node chat.js "Hello"');
        process.exit(1);
    }

    const message = args.join(' ');
    
    try {
        const response = await processMessage(1, message, []);
        console.log(response);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
