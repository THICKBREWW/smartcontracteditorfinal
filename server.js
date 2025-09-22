const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const { ChromaClient } = require('chromadb');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: process.env.LOG_FILE || './logs/app.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Initialize ChromaDB client
let chromaClient = null;
let policyCollection = null;

try {
    chromaClient = new ChromaClient({
        path: process.env.CHROMA_URL || 'http://localhost:8000'
    });
} catch (error) {
    logger.warn('ChromaDB client initialization failed:', error.message);
}

// Initialize Anthropic client
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
    } catch (error) {
        logger.warn('Anthropic client initialization failed:', error.message);
    }
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://appsforoffice.microsoft.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.anthropic.com"]
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});

if (process.env.NODE_ENV === 'production') {
    app.use(limiter);
}

// General middleware
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(cors({
    origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads', 'policies');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${originalName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
        files: 10
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || '.txt,.doc,.docx,.pdf').split(',');
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} files are allowed.`));
        }
    }
});

// In-memory storage for metadata and results
let policies = [];
let analysisResults = [];

// Initialize ChromaDB collection
async function initializeChromaDB() {
    if (!chromaClient) {
        logger.warn('ChromaDB client not available, running in basic mode');
        return false;
    }

    try {
        policyCollection = await chromaClient.getOrCreateCollection({
            name: "policy_documents",
            metadata: { "description": "Legal policy documents for compliance analysis" }
        });

        logger.info('ChromaDB collection initialized successfully');
        await loadExistingPolicies();
        return true;
    } catch (error) {
        logger.error('Failed to initialize ChromaDB:', error);
        return false;
    }
}

// Load existing policies into ChromaDB
async function loadExistingPolicies() {
    try {
        const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads', 'policies');
        const files = await fs.readdir(uploadsDir).catch(() => []);

        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const policy = {
                    id: generateId(),
                    name: file,
                    filename: file,
                    path: filePath,
                    content: content,
                    uploadDate: new Date().toISOString(),
                    size: content.length,
                    keywords: extractKeywords(content)
                };

                policies.push(policy);

                if (policyCollection) {
                    const chunks = chunkDocument(content, policy.name);
                    await addPolicyToChromaDB(policy, chunks);
                }
            } catch (fileError) {
                logger.warn(`Could not load existing policy ${file}:`, fileError.message);
            }
        }

        logger.info(`Loaded ${policies.length} existing policies`);
    } catch (error) {
        logger.error('Error loading existing policies:', error);
    }
}

// Basic routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'taskpane.html'));
});

app.get('/taskpane.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'taskpane.html'));
});

app.get('/commands.html', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
        </head>
        <body>
            <script>
                Office.onReady(() => {
                    console.log('Commands ready');
                });
            </script>
        </body>
        </html>
    `);
});

// Policy management endpoints
app.post('/api/policies/upload', upload.array('policies'),
    [body('policies').optional()],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No files uploaded'
                });
            }

            const uploadedPolicies = [];

            for (const file of req.files) {
                try {
                    const content = await fs.readFile(file.path, 'utf8');
                    const policy = {
                        id: generateId(),
                        name: file.originalname,
                        filename: file.filename,
                        path: file.path,
                        content: content,
                        uploadDate: new Date().toISOString(),
                        size: file.size,
                        keywords: extractKeywords(content)
                    };

                    policies.push(policy);

                    // Add to ChromaDB if available
                    if (policyCollection) {
                        try {
                            const chunks = chunkDocument(content, policy.name);
                            await addPolicyToChromaDB(policy, chunks);
                        } catch (chromaError) {
                            logger.warn('Could not add to ChromaDB:', chromaError.message);
                        }
                    }

                    uploadedPolicies.push({
                        id: policy.id,
                        name: policy.name,
                        uploadDate: policy.uploadDate,
                        size: policy.size,
                        keywordCount: policy.keywords.length
                    });
                } catch (fileError) {
                    logger.error(`Error processing file ${file.filename}:`, fileError);
                }
            }

            logger.info(`Uploaded ${uploadedPolicies.length} policies`);
            res.json({
                success: true,
                message: `Uploaded ${uploadedPolicies.length} policy document(s)`,
                policies: uploadedPolicies
            });
        } catch (error) {
            logger.error('Policy upload error:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading policies: ' + error.message
            });
        }
    }
);

app.get('/api/policies', (req, res) => {
    try {
        const policyList = policies.map(policy => ({
            id: policy.id,
            name: policy.name,
            uploadDate: policy.uploadDate,
            size: policy.size,
            keywordCount: policy.keywords.length
        }));

        res.json({
            success: true,
            policies: policyList,
            totalCount: policies.length,
            vectorDbStatus: policyCollection ? 'connected' : 'disconnected'
        });
    } catch (error) {
        logger.error('Error fetching policies:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching policies'
        });
    }
});

app.delete('/api/policies/:id', async (req, res) => {
    try {
        const policyId = req.params.id;
        const policyIndex = policies.findIndex(p => p.id === policyId);

        if (policyIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Policy not found'
            });
        }

        const policy = policies[policyIndex];

        // Remove from ChromaDB
        if (policyCollection) {
            try {
                await policyCollection.delete({
                    where: { "policy_id": policyId }
                });
            } catch (chromaError) {
                logger.warn('Could not delete from ChromaDB:', chromaError);
            }
        }

        // Delete file
        try {
            await fs.unlink(policy.path);
        } catch (fileError) {
            logger.warn('Could not delete policy file:', fileError.message);
        }

        // Remove from array
        policies.splice(policyIndex, 1);

        logger.info(`Deleted policy: ${policy.name}`);
        res.json({
            success: true,
            message: 'Policy deleted successfully'
        });
    } catch (error) {
        logger.error('Policy deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting policy: ' + error.message
        });
    }
});

// Document analysis endpoint
app.post('/api/analyze',
    [body('documentText').notEmpty().withMessage('Document text is required')],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid input',
                    errors: errors.array()
                });
            }

            const { documentText, options = {} } = req.body;

            if (policies.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No policies uploaded. Please upload policy documents first.'
                });
            }

            // Perform analysis
            const analysisResult = await performEnhancedAnalysis(documentText, policies, options);

            // Store result
            const result = {
                id: generateId(),
                analysisDate: new Date().toISOString(),
                documentLength: documentText.length,
                wordCount: documentText.split(/\s+/).length,
                ...analysisResult
            };

            analysisResults.push(result);

            // Keep only last 100 results to manage memory
            if (analysisResults.length > 100) {
                analysisResults = analysisResults.slice(-100);
            }

            logger.info(`Analysis completed for ${result.wordCount} word document`);
            res.json({
                success: true,
                result: result
            });
        } catch (error) {
            logger.error('Analysis error:', error);
            res.status(500).json({
                success: false,
                message: 'Error analyzing document: ' + error.message
            });
        }
    }
);

// Grammar check endpoint
app.post('/api/grammar-check',
    [body('text').notEmpty().withMessage('Text is required')],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { text } = req.body;
            const grammarIssues = await performAdvancedGrammarCheck(text);

            res.json({
                success: true,
                issues: grammarIssues,
                issueCount: grammarIssues.length
            });
        } catch (error) {
            logger.error('Grammar check error:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking grammar: ' + error.message
            });
        }
    }
);

// Results endpoints
app.get('/api/results', (req, res) => {
    try {
        const results = analysisResults.map(result => ({
            id: result.id,
            analysisDate: result.analysisDate,
            complianceScore: result.complianceScore,
            issueCount: result.issues ? result.issues.length : 0,
            suggestionCount: result.suggestions ? result.suggestions.length : 0,
            wordCount: result.wordCount,
            riskLevel: result.riskLevel
        }));

        res.json({
            success: true,
            results: results,
            totalCount: results.length
        });
    } catch (error) {
        logger.error('Error fetching results:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching results'
        });
    }
});

app.get('/api/results/:id', (req, res) => {
    try {
        const result = analysisResults.find(r => r.id === req.params.id);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Analysis result not found'
            });
        }

        res.json({
            success: true,
            result: result
        });
    } catch (error) {
        logger.error('Error fetching result:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching result'
        });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            services: {
                chromadb: policyCollection ? 'connected' : 'disconnected',
                anthropic: anthropic ? 'configured' : 'not_configured',
                server: 'running'
            },
            stats: {
                policiesLoaded: policies.length,
                analysisResultsStored: analysisResults.length,
                uptime: process.uptime()
            },
            memory: process.memoryUsage()
        };

        res.json({
            success: true,
            health: health
        });
    } catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({
            success: false,
            message: 'Health check failed'
        });
    }
});

// Enhanced analysis functions
async function performEnhancedAnalysis(documentText, policies, options) {
    try {
        // Try RAG analysis first if available
        if (policyCollection && anthropic) {
            return await performRAGAnalysis(documentText, options);
        } else if (anthropic) {
            return await performAIAnalysis(documentText, policies, options);
        }
    } catch (error) {
        logger.error('Enhanced analysis failed, falling back to basic:', error);
    }

    // Fallback to basic analysis
    return await performBasicAnalysis(documentText, policies, options);
}

async function performRAGAnalysis(documentText, options) {
    try {
        // 1. Retrieve relevant policy chunks
        const relevantPolicies = await retrieveRelevantPolicies(documentText);

        // 2. Analyze with Claude
        const claudeAnalysis = await analyzeWithClaude(documentText, relevantPolicies, options);

        // 3. Combine with rule-based analysis
        const basicAnalysis = await performBasicAnalysis(documentText, [], options);

        return {
            complianceScore: claudeAnalysis.complianceScore,
            issues: [
                ...claudeAnalysis.issues,
                ...basicAnalysis.issues
            ],
            suggestions: [
                ...claudeAnalysis.suggestions,
                ...basicAnalysis.suggestions
            ].slice(0, 25),
            riskLevel: claudeAnalysis.riskLevel,
            policiesAnalyzed: relevantPolicies.length,
            analysis: {
                wordCount: documentText.split(/\s+/).length,
                characterCount: documentText.length,
                sentenceCount: (documentText.match(/[.!?]+/g) || []).length,
                paragraphCount: documentText.split(/\n\s*\n/).length,
                aiAnalyzed: true,
                ragUsed: true
            }
        };
    } catch (error) {
        logger.error('RAG analysis error:', error);
        throw error;
    }
}

async function retrieveRelevantPolicies(documentText, topK = 10) {
    try {
        const docChunks = chunkDocument(documentText, 'current_document');
        const allResults = [];

        for (const chunk of docChunks.slice(0, 3)) {
            const results = await policyCollection.query({
                queryTexts: [chunk],
                nResults: Math.ceil(topK / 3),
                include: ['documents', 'metadatas', 'distances']
            });

            if (results.documents && results.documents[0]) {
                for (let i = 0; i < results.documents[0].length; i++) {
                    allResults.push({
                        document: results.documents[0][i],
                        metadata: results.metadatas[0][i],
                        distance: results.distances[0][i]
                    });
                }
            }
        }

        return allResults
            .sort((a, b) => a.distance - b.distance)
            .slice(0, topK);

    } catch (error) {
        logger.error('Error retrieving relevant policies:', error);
        return [];
    }
}

async function analyzeWithClaude(documentText, relevantPolicies, options) {
    try {
        const policyContext = relevantPolicies
            .map(p => `Policy: ${p.metadata.policy_name}\nSection: ${p.document}`)
            .join('\n\n');

        const prompt = `You are a legal compliance expert. Analyze this contract for policy compliance and provide improvement suggestions.

POLICY CONTEXT:
${policyContext}

DOCUMENT TO ANALYZE:
${documentText}

Provide analysis in JSON format:
{
  "complianceScore": <number 0-100>,
  "riskLevel": "<Low/Medium/High>",
  "issues": [
    {
      "type": "<string>",
      "severity": "<low/medium/high>",
      "title": "<string>",
      "description": "<string>"
    }
  ],
  "suggestions": [
    {
      "type": "<string>",
      "priority": "<low/medium/high>",
      "title": "<string>",
      "description": "<string>"
    }
  ]
}`;

        const response = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 4000,
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE) || 0.1,
            messages: [{ role: 'user', content: prompt }]
        });

        return JSON.parse(response.content[0].text);

    } catch (error) {
        logger.error('Claude API error:', error);
        return {
            complianceScore: 60,
            riskLevel: 'Medium',
            issues: [{
                type: 'Analysis Error',
                severity: 'medium',
                title: 'AI analysis unavailable',
                description: 'Using basic analysis only'
            }],
            suggestions: [{
                type: 'General',
                priority: 'medium',
                title: 'Manual review recommended',
                description: 'Please have document reviewed by legal counsel'
            }]
        };
    }
}

async function performAIAnalysis(documentText, policies, options) {
    try {
        const policyContext = policies.map(p => `Policy: ${p.name}\nKeywords: ${p.keywords.join(', ')}`).join('\n');

        const prompt = `You are a legal compliance expert. Analyze this contract and provide improvement suggestions.

AVAILABLE POLICIES:
${policyContext}

DOCUMENT TO ANALYZE:
${documentText}

Provide analysis in JSON format:
{
  "complianceScore": <number 0-100>,
  "riskLevel": "<Low/Medium/High>",
  "issues": [
    {
      "type": "<string>",
      "severity": "<low/medium/high>",
      "title": "<string>",
      "description": "<string>"
    }
  ],
  "suggestions": [
    {
      "type": "<string>",
      "priority": "<low/medium/high>",
      "title": "<string>",
      "description": "<string>"
    }
  ]
}`;

        const response = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 4000,
            temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE) || 0.1,
            messages: [{ role: 'user', content: prompt }]
        });

        const result = JSON.parse(response.content[0].text);
        result.analysis = {
            aiAnalyzed: true,
            ragUsed: false
        };

        return result;

    } catch (error) {
        logger.error('AI analysis error:', error);
        throw error;
    }
}

async function performAdvancedGrammarCheck(text) {
    try {
        if (!anthropic) {
            return checkGrammarBasic(text);
        }

        const prompt = `Analyze this text for grammar, spelling, and style issues. Return JSON:
{
  "issues": [
    {
      "position": <number>,
      "length": <number>,
      "issue": "<description>",
      "suggestion": "<correction>",
      "severity": "<low/medium/high>",
      "category": "<grammar/spelling/punctuation/style>"
    }
  ]
}

TEXT: ${text}`;

        const response = await anthropic.messages.create({
            model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 3000,
            temperature: 0.1,
            messages: [{ role: 'user', content: prompt }]
        });

        const result = JSON.parse(response.content[0].text);
        return result.issues || [];

    } catch (error) {
        logger.error('Advanced grammar check error:', error);
        return checkGrammarBasic(text);
    }
}

async function performBasicAnalysis(documentText, policies, options) {
    const issues = [];
    const suggestions = [];
    let complianceScore = 100;

    // Language analysis
    const languageRules = [
        {
            pattern: /\bshall\b/gi,
            issue: "Use of 'shall' - ambiguous legal term",
            suggestion: "Replace 'shall' with 'will', 'must', or 'agrees to' for clarity",
            severity: 'low',
            penalty: 2
        },
        {
            pattern: /\bhereby\b/gi,
            issue: "Unnecessary use of 'hereby'",
            suggestion: "Remove 'hereby' for cleaner, modern language",
            severity: 'low',
            penalty: 1
        },
        {
            pattern: /[.]{2,}/g,
            issue: "Multiple consecutive periods",
            suggestion: "Use single periods for proper punctuation",
            severity: 'medium',
            penalty: 2
        }
    ];

    for (const rule of languageRules) {
        const matches = documentText.match(rule.pattern);
        if (matches && matches.length > 0) {
            issues.push({
                type: 'Language Issue',
                severity: rule.severity,
                title: rule.issue,
                description: `Found ${matches.length} instance(s)`
            });

            suggestions.push({
                type: 'Language Improvement',
                priority: rule.severity === 'high' ? 'high' : 'medium',
                title: rule.suggestion,
                description: `Apply to ${matches.length} instance(s)`
            });

            complianceScore -= Math.min(matches.length * rule.penalty, 20);
        }
    }

    // Structure analysis
    const essentialSections = [
        { name: 'Parties', patterns: [/parties/i, /party/i], required: true },
        { name: 'Term/Duration', patterns: [/term/i, /duration/i, /expir/i], required: true },
        { name: 'Termination', patterns: [/terminat/i, /end/i, /cancel/i], required: true }
    ];

    for (const section of essentialSections) {
        const hasSection = section.patterns.some(pattern => pattern.test(documentText));
        if (!hasSection && section.required) {
            issues.push({
                type: 'Structure Issue',
                severity: 'high',
                title: `Missing ${section.name} section`,
                description: `Contract should include ${section.name.toLowerCase()} information`
            });
            complianceScore -= 10;
        }
    }

    // Policy compliance (basic keyword matching)
    for (const policy of policies) {
        const docKeywords = extractKeywords(documentText);
        const policyKeywords = policy.keywords;

        const missingKeywords = policyKeywords
            .slice(0, 10)
            .filter(keyword =>
                !docKeywords.some(docKeyword =>
                    docKeyword.includes(keyword) || keyword.includes(docKeyword)
                )
            );

        if (missingKeywords.length > 0) {
            issues.push({
                type: 'Policy Compliance',
                severity: 'high',
                title: `Missing key terms from ${policy.name}`,
                description: `Document may not comply with policy requirements`
            });

            suggestions.push({
                type: 'Policy Alignment',
                priority: 'high',
                title: `Add required terms from ${policy.name}`,
                description: `Consider including: ${missingKeywords.slice(0, 3).join(', ')}`
            });

            complianceScore -= Math.min(missingKeywords.length * 3, 15);
        }
    }

    return {
        complianceScore: Math.max(Math.round(complianceScore), 0),
        issues: issues,
        suggestions: suggestions.slice(0, 20),
        riskLevel: complianceScore >= 80 ? 'Low' : complianceScore >= 60 ? 'Medium' : 'High',
        policiesAnalyzed: policies.length,
        analysis: {
            wordCount: documentText.split(/\s+/).length,
            characterCount: documentText.length,
            sentenceCount: (documentText.match(/[.!?]+/g) || []).length,
            paragraphCount: documentText.split(/\n\s*\n/).length,
            aiAnalyzed: false,
            ragUsed: false
        }
    };
}

function checkGrammarBasic(text) {
    const grammarIssues = [];

    const grammarRules = [
        {
            pattern: /\s{2,}/g,
            issue: 'Multiple consecutive spaces',
            suggestion: 'Use single spaces between words',
            category: 'formatting',
            severity: 'low'
        },
        {
            pattern: /([a-z])([A-Z])/g,
            issue: 'Missing space between words',
            suggestion: 'Add space between words',
            category: 'formatting',
            severity: 'medium'
        },
        {
            pattern: /\s+([,.;:!?])/g,
            issue: 'Space before punctuation',
            suggestion: 'Remove space before punctuation marks',
            category: 'punctuation',
            severity: 'low'
        },
        {
            pattern: /([.!?])([a-zA-Z])/g,
            issue: 'Missing space after sentence-ending punctuation',
            suggestion: 'Add space after sentence-ending punctuation',
            category: 'punctuation',
            severity: 'medium'
        }
    ];

    grammarRules.forEach((rule, ruleIndex) => {
        const matches = [...text.matchAll(rule.pattern)];
        matches.forEach((match, matchIndex) => {
            grammarIssues.push({
                id: `basic_${ruleIndex}_${matchIndex}_${match.index}`,
                position: match.index,
                length: match[0].length,
                issue: rule.issue,
                suggestion: rule.suggestion,
                text: match[0],
                severity: rule.severity,
                category: rule.category
            });
        });
    });

    return grammarIssues.slice(0, 50);
}

// ChromaDB helper functions
async function addPolicyToChromaDB(policy, chunks) {
    try {
        const documents = [];
        const metadatas = [];
        const ids = [];

        chunks.forEach((chunk, index) => {
            documents.push(chunk);
            metadatas.push({
                policy_id: policy.id,
                policy_name: policy.name,
                chunk_index: index,
                chunk_id: `${policy.id}_chunk_${index}`,
                upload_date: policy.uploadDate,
                total_chunks: chunks.length
            });
            ids.push(`${policy.id}_chunk_${index}`);
        });

        await policyCollection.add({
            documents: documents,
            metadatas: metadatas,
            ids: ids
        });

        logger.info(`Added policy "${policy.name}" to ChromaDB (${chunks.length} chunks)`);
    } catch (error) {
        logger.error('Error adding policy to ChromaDB:', error);
    }
}

function chunkDocument(content, docName, chunkSize = null, overlap = null) {
    const maxSize = chunkSize || parseInt(process.env.MAX_CHUNK_SIZE) || 1000;
    const overlapSize = overlap || parseInt(process.env.CHUNK_OVERLAP) || 200;

    const chunks = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
        const sentenceWithPeriod = sentence.trim() + '.';

        if (currentSize + sentenceWithPeriod.length > maxSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());

            // Add overlap
            const words = currentChunk.split(/\s+/);
            const overlapWords = words.slice(-Math.floor(overlapSize / 10));
            currentChunk = overlapWords.join(' ') + ' ' + sentenceWithPeriod;
            currentSize = currentChunk.length;
        } else {
            currentChunk += ' ' + sentenceWithPeriod;
            currentSize = currentChunk.length;
        }
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 50);
}

// Utility functions
function generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function extractKeywords(text) {
    const commonWords = [
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
        'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may',
        'might', 'must', 'shall', 'this', 'that', 'these', 'those'
    ];

    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.includes(word));

    const wordFreq = {};
    words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 50)
        .map(([word]) => word);
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Server error:', error);

    if (error instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: `File upload error: ${error.message}`
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Create necessary directories
const createDirectories = async () => {
    const dirs = [
        path.join(__dirname, process.env.UPLOAD_DIR || 'uploads', 'policies'),
        path.join(__dirname, 'public', 'assets'),
        path.join(__dirname, 'logs'),
        path.join(__dirname, 'data', 'chromadb'),
        path.join(__dirname, 'data', 'redis')
    ];

    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            logger.info(`Created directory: ${dir}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                logger.error(`Error creating directory ${dir}:`, error);
            }
        }
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
const startServer = async () => {
    try {
        logger.info('Starting Smart Contract Editor Server...');

        // Check environment
        if (!process.env.ANTHROPIC_API_KEY) {
            logger.warn('ANTHROPIC_API_KEY not set - AI analysis will be limited');
        }

        // Create directories
        await createDirectories();

        // Initialize ChromaDB
        const chromaInitialized = await initializeChromaDB();

        if (chromaInitialized) {
            logger.info('ChromaDB initialized successfully');
        } else {
            logger.warn('ChromaDB not available - using basic analysis mode');
        }

        // Start HTTP server
        const server = app.listen(PORT, () => {
            logger.info(`Server running on http://localhost:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`Policies loaded: ${policies.length}`);
            logger.info(`AI Analysis: ${anthropic ? 'Enabled' : 'Disabled'}`);
            logger.info(`Vector Search: ${policyCollection ? 'Enabled' : 'Disabled'}`);
        });

        // Handle server errors
        server.on('error', (error) => {
            logger.error('Server error:', error);
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Export for testing
module.exports = app;

// Start server if this file is run directly
if (require.main === module) {
    startServer();
}