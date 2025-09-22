#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (prompt) => {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
};

async function quickSetup() {
    console.log('Smart Contract Editor Quick Setup\n');

    // Create basic .env if it doesn't exist
    try {
        await fs.access('.env');
        console.log('.env file already exists');
    } catch (error) {
        const envContent = `NODE_ENV=development
PORT=3000
ANTHROPIC_API_KEY=
CHROMA_URL=http://localhost:8000
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
LOG_LEVEL=info
LOG_FILE=./logs/app.log
`;
        await fs.writeFile('.env', envContent);
        console.log('Created basic .env file');
        console.log('Please add your Anthropic API key to the .env file');
    }

    console.log('\nSetup complete!');
    console.log('Next steps:');
    console.log('1. Edit .env file with your Anthropic API key');
    console.log('2. Start ChromaDB: npm run chroma:start');
    console.log('3. Start server: npm run dev-server');
    
    rl.close();
}

quickSetup().catch(console.error);