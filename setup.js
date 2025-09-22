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

async function setupEnvironment() {
    console.log('🚀 Smart Contract Editor Setup\n');

    try {
        // Check if .env already exists
        try {
            await fs.access('.env');
            const overwrite = await question('.env file already exists. Overwrite? (y/N): ');
            if (overwrite.toLowerCase() !== 'y') {
                console.log('Setup cancelled.');
                process.exit(0);
            }
        } catch (error) {
            // .env doesn't exist, continue
        }

        console.log('Please provide the following configuration:\n');

        // Get Anthropic API key
        const anthropicKey = await question('Anthropic API Key (required for AI analysis): ');
        if (!anthropicKey.trim()) {
            console.warn('⚠️  No Anthropic API key provided. AI analysis will be limited.');
        }

        // Get ChromaDB URL
        const chromaUrl = await question('ChromaDB URL (default: http://localhost:8000): ') || 'http://localhost:8000';

        // Get port
        const port = await question('Server port (default: 3000): ') || '3000';

        // Get environment
        const nodeEnv = await question('Environment (development/production, default: development): ') || 'development';

        // Create .env file
        const envContent = `# Smart Contract Editor Configuration
# Generated on ${new Date().toISOString()}

# Server Configuration
NODE_ENV=${nodeEnv}
PORT=${port}

# Anthropic Claude API Configuration
ANTHROPIC_API_KEY=${anthropicKey}

# ChromaDB Configuration
CHROMA_URL=${chromaUrl}

# Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
ALLOWED_FILE_TYPES=.txt,.doc,.docx,.pdf

# Analysis Configuration
MAX_CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_RETRIEVED_POLICIES=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Security
CORS_ORIGIN=*
TRUST_PROXY=false

# Feature Flags
ENABLE_BATCH_ANALYSIS=true
ENABLE_GRAMMAR_CHECK=true
ENABLE_EXPORT=true
ENABLE_SEARCH_ENDPOINT=true
`;

        await fs.writeFile('.env', envContent);
        console.log('✅ .env file created successfully!\n');

        // Create necessary directories
        const directories = [
            'uploads/policies',
            'public/assets',
            'logs',
            'scripts'
        ];

        for (const dir of directories) {
            await fs.mkdir(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }

        // Copy Office Add-in files if they exist
        try {
            // Copy taskpane.html to public directory
            try {
                await fs.access('taskpane.html');
                await fs.copyFile('taskpane.html', 'public/taskpane.html');
                console.log('📋 Copied taskpane.html to public directory');
            } catch (error) {
                console.log('⚠️  taskpane.html not found - please ensure it exists for Office Add-in functionality');
            }

            // Copy manifest.xml to public directory
            try {
                await fs.access('manifest.xml');
                await fs.copyFile('manifest.xml', 'public/manifest.xml');
                console.log('📋 Copied manifest.xml to public directory');
            } catch (error) {
                console.log('⚠️  manifest.xml not found - please ensure it exists for Office Add-in functionality');
            }
        } catch (error) {
            console.warn('Warning copying Office Add-in files:', error.message);
        }

        console.log('\n🎉 Setup completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Start ChromaDB: npm run chroma:start');
        console.log('2. Start the development server: npm run dev-server');
        console.log('3. Load the Office Add-in in Microsoft Word:');
        console.log('   - Insert > Get Add-ins > Upload My Add-in');
        console.log('   - Select public/manifest.xml');
        console.log('4. Test the Smart Contract Editor functionality\n');

        // Ask if user wants to start ChromaDB
        const startChroma = await question('Start ChromaDB with Docker Compose now? (Y/n): ');
        if (startChroma.toLowerCase() !== 'n') {
            const { spawn } = require('child_process');

            console.log('🐳 Starting ChromaDB...\n');
            const docker = spawn('docker-compose', ['up', '-d', 'chromadb'], {
                stdio: 'inherit'
            });

            docker.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ ChromaDB started successfully!');
                    console.log('You can now run: npm run dev');
                } else {
                    console.log('❌ Failed to start ChromaDB. Please run manually: docker-compose up -d chromadb');
                }
                process.exit(code);
            });

            docker.on('error', (error) => {
                console.log('❌ Docker Compose not available. Please install Docker and try again.');
                console.log('Or run ChromaDB manually according to the documentation.');
                process.exit(1);
            });
        } else {
            process.exit(0);
        }

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

async function validateSetup() {
    console.log('🔍 Validating setup...\n');

            const checks = [
        {
            name: 'Node.js version',
            check: () => {
                const version = process.version;
                const major = parseInt(version.slice(1).split('.')[0]);
                return major >= 18;
            },
            message: 'Node.js 18+ required'
        },
        {
            name: '.env file',
            check: async () => {
                try {
                    await fs.access('.env');
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Run setup first: npm run setup'
        },
        {
            name: 'Upload directory',
            check: async () => {
                try {
                    await fs.access('uploads/policies');
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'Upload directory missing'
        },
        {
            name: 'Office Add-in manifest',
            check: async () => {
                try {
                    await fs.access('public/manifest.xml');
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'manifest.xml missing from public directory'
        },
        {
            name: 'Office Add-in taskpane',
            check: async () => {
                try {
                    await fs.access('public/taskpane.html');
                    return true;
                } catch {
                    return false;
                }
            },
            message: 'taskpane.html missing from public directory'
        }
    ];

    let allPassed = true;

    for (const check of checks) {
        try {
            const result = await check.check();
            console.log(`${result ? '✅' : '❌'} ${check.name}`);

            if (!result) {
                console.log(`   ${check.message}`);
                allPassed = false;
            }
        } catch (error) {
            console.log(`❌ ${check.name} - ${error.message}`);
            allPassed = false;
        }
    }

    console.log(`\n${allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed'}`);
    return allPassed;
}

// Main execution
const command = process.argv[2];

if (command === 'validate') {
    validateSetup().then(() => {
        rl.close();
    });
} else {
    setupEnvironment().catch((error) => {
        console.error('Setup error:', error);
        rl.close();
        process.exit(1);
    });
}
