// Development configuration for Smart Contract Editor
// This file helps configure development environment for Office Add-in with RAG backend

const path = require('path');
const fs = require('fs');

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        https: process.env.NODE_ENV === 'production',
        cors: {
            origin: [
                'https://localhost:3000',
                'https://outlook.office.com',
                'https://outlook-web.office.com',
                'https://outlook.live.com',
                'https://word.office.com',
                'https://excel.office.com',
                'https://powerpoint.office.com'
            ],
            credentials: true
        }
    },

    // Office Add-in configuration
    office: {
        manifestPath: path.join(__dirname, 'public', 'manifest.xml'),
        taskpanePath: path.join(__dirname, 'public', 'taskpane.html'),
        assetsPath: path.join(__dirname, 'public', 'assets'),

        // Auto-reload settings for development
        watchFiles: [
            'taskpane.html',
            'manifest.xml',
            'public/**/*'
        ]
    },

    // RAG system configuration
    rag: {
        chromaUrl: process.env.CHROMA_URL || 'http://localhost:8000',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,

        // Chunking strategy for legal documents
        chunking: {
            maxSize: parseInt(process.env.MAX_CHUNK_SIZE) || 1000,
            overlap: parseInt(process.env.CHUNK_OVERLAP) || 200,
            separators: ['\n\n', '\n', '. ', '! ', '? ']
        },

        // Retrieval settings
        retrieval: {
            topK: parseInt(process.env.MAX_RETRIEVED_POLICIES) || 10,
            similarityThreshold: 0.7,
            maxContextLength: 8000
        },

        // Analysis settings
        analysis: {
            includeBasicChecks: true,
            includeAiAnalysis: true,
            maxSuggestions: 25,
            confidenceThreshold: 0.6
        }
    },

    // File upload configuration
    uploads: {
        directory: path.join(__dirname, 'uploads', 'policies'),
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['.txt', '.doc', '.docx', '.pdf'],
        maxFiles: 10
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || path.join(__dirname, 'logs', 'app.log'),
        console: process.env.NODE_ENV !== 'production',
        format: 'combined'
    },

    // Development tools
    development: {
        hotReload: true,
        debugMode: process.env.DEBUG_MODE === 'true',
        mockAi: process.env.MOCK_AI === 'true', // For testing without API
        verboseLogging: process.env.VERBOSE_LOGGING === 'true'
    },

    // Feature flags
    features: {
        batchAnalysis: process.env.ENABLE_BATCH_ANALYSIS !== 'false',
        grammarCheck: process.env.ENABLE_GRAMMAR_CHECK !== 'false',
        exportResults: process.env.ENABLE_EXPORT !== 'false',
        searchEndpoint: process.env.ENABLE_SEARCH_ENDPOINT !== 'false',
        healthCheck: true,
        rateLimiting: process.env.NODE_ENV === 'production'
    },

    // Rate limiting (for production)
    rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        message: 'Too many requests from this IP, please try again later.'
    }
};

// Validation functions
config.validate = () => {
    const errors = [];

    // Check required files
    const requiredFiles = [
        { path: config.office.manifestPath, name: 'manifest.xml' },
        { path: config.office.taskpanePath, name: 'taskpane.html' }
    ];

    for (const file of requiredFiles) {
        if (!fs.existsSync(file.path)) {
            errors.push(`Missing required file: ${file.name} at ${file.path}`);
        }
    }

    // Check required directories
    const requiredDirs = [
        config.uploads.directory,
        path.dirname(config.logging.file),
        config.office.assetsPath
    ];

    for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
            errors.push(`Missing required directory: ${dir}`);
        }
    }

    // Check environment variables
    if (config.rag.anthropicApiKey && !config.rag.anthropicApiKey.startsWith('sk-ant-')) {
        errors.push('Invalid ANTHROPIC_API_KEY format');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// Helper to get full server URL
config.getServerUrl = (path = '') => {
    const protocol = config.server.https ? 'https' : 'http';
    return `${protocol}://${config.server.host}:${config.server.port}${path}`;
};

// Helper to get Office Add-in URLs
config.getOfficeUrls = () => {
    return {
        manifest: config.getServerUrl('/manifest.xml'),
        taskpane: config.getServerUrl('/taskpane.html'),
        api: config.getServerUrl('/api')
    };
};

// Development middleware configuration
config.getMiddleware = () => {
    const middleware = [];

    if (config.development.hotReload) {
        // Add development middleware for file watching
        middleware.push('development-reload');
    }

    if (config.features.rateLimiting) {
        middleware.push({
            name: 'rate-limit',
            config: config.rateLimiting
        });
    }

    return middleware;
};

// Export configuration
module.exports = config;

// Print configuration summary in development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    console.log('📋 Smart Contract Editor Configuration');
    console.log('=====================================');
    console.log(`🌐 Server: ${config.getServerUrl()}`);
    console.log(`📱 Office Add-in: ${config.features.batchAnalysis ? 'Enabled' : 'Disabled'}`);
    console.log(`🤖 AI Analysis: ${config.rag.anthropicApiKey ? 'Enabled' : 'Disabled'}`);
    console.log(`🔍 Vector DB: ${config.rag.chromaUrl}`);
    console.log(`📁 Uploads: ${config.uploads.directory}`);

    const validation = config.validate();
    if (validation.isValid) {
        console.log('✅ Configuration valid');
    } else {
        console.log('❌ Configuration errors:');
        validation.errors.forEach(error => console.log(`   - ${error}`));
    }
}