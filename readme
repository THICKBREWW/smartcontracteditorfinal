# Smart Contract Editor

An intelligent Microsoft Word Add-in that uses RAG (Retrieval-Augmented Generation) with ChromaDB and Claude API to provide advanced contract compliance analysis and document improvement suggestions.

## Features

- **AI-Powered Analysis**: Claude API for intelligent document analysis
- **RAG-Based Compliance**: Vector similarity search against policy documents
- **Microsoft Word Integration**: Seamless Office Add-in experience
- **Real-time Grammar Check**: Advanced grammar and style suggestions
- **Policy Management**: Upload and manage compliance policies
- **Semantic Search**: Find relevant policy sections using ChromaDB
- **Risk Assessment**: Identify potential legal and compliance risks
- **Export Results**: Save analysis results in JSON format

## Prerequisites

- **Node.js 18+** and **npm 8+**
- **Docker** (for ChromaDB)
- **Microsoft Word** (for testing the add-in)
- **Anthropic API Key** (for AI analysis)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd smart-contract-editor
npm install
```

### 2. Setup Environment

Run the interactive setup:

```bash
npm run setup
```

Or manually create `.env` from `.env.example`:

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Services

```bash
# Start ChromaDB
npm run chroma:start

# Start development server
npm run dev-server
```

### 4. Load Office Add-in

1. Open Microsoft Word
2. Go to **Insert** > **Get Add-ins** > **Upload My Add-in**
3. Upload `public/manifest.xml`
4. The Smart Contract Editor will appear in your ribbon

## Architecture

```mermaid
graph TB
    A[Microsoft Word] --> B[Office Add-in Frontend]
    B --> C[Express Server]
    C --> D[ChromaDB Vector Store]
    C --> E[Claude API]
    C --> F[Policy Storage]

    D --> G[Semantic Search]
    E --> H[AI Analysis]
    F --> I[Document Processing]
```

### Components

- **Frontend**: Office Add-in UI (taskpane.html)
- **Backend**: Express server with RAG capabilities
- **Vector DB**: ChromaDB for semantic policy search
- **AI Engine**: Anthropic Claude for analysis
- **Storage**: Local file system for policies

## Usage Guide

### Upload Policy Documents

1. Click "Upload Policies" in the add-in
2. Select your compliance documents (.txt, .doc, .docx, .pdf)
3. Policies are automatically chunked and stored in ChromaDB

### Analyze Contracts

1. Select text in your Word document
2. Click "Analyze Document"
3. Review compliance scores, issues, and suggestions
4. Apply suggested improvements

### Grammar & Style Check

1. Select text for review
2. Click "Check Grammar"
3. Review and apply AI-powered corrections

## API Endpoints

### Policy Management
- `POST /api/policies/upload` - Upload policy documents
- `GET /api/policies` - List all policies
- `DELETE /api/policies/:id` - Remove policy

### Document Analysis
- `POST /api/analyze` - Analyze single document
- `POST /api/grammar-check` - Grammar checking

### System
- `GET /api/health` - System health check
- `GET /api/results` - Analysis history
- `GET /api/results/:id` - Get specific result

## How RAG Works

1. **Policy Ingestion**: Documents are split into semantic chunks
2. **Vector Storage**: Chunks stored in ChromaDB with embeddings
3. **Query Processing**: When analyzing a contract:
   - Document is chunked for analysis
   - Relevant policy sections retrieved via similarity search
   - Claude API analyzes document against retrieved context
4. **Result Synthesis**: AI insights combined with rule-based checks

## Analysis Features

### Compliance Scoring
- 0-100 scale based on policy adherence
- Risk levels: Low, Medium, High
- Issue categorization: Structure, Language, Risk, Policy

### Issue Detection
- Missing required clauses
- Problematic language patterns
- Policy violations
- Legal risks and ambiguities

### Improvement Suggestions
- Specific text replacements
- Structural improvements
- Style enhancements
- Compliance recommendations

## Development

### Available Scripts

```bash
npm run dev-server     # Development with file watching
npm run chroma:start   # Start ChromaDB
npm run validate       # Check setup
npm run build          # Build for production
npm test               # Run tests
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
```

### Project Structure

```
smart-contract-editor/
├── server.js              # Main server with RAG
├── taskpane.html          # Office Add-in UI
├── manifest.xml           # Add-in manifest
├── public/                # Static assets
│   ├── taskpane.html      # Copied from root
│   └── manifest.xml       # Copied from root
├── uploads/               # Policy storage
│   └── policies/
├── scripts/               # Setup utilities
│   └── setup.js
├── logs/                  # Application logs
├── data/                  # Database files
│   ├── chromadb/
│   └── redis/
├── tests/                 # Test files
├── docker-compose.yml     # ChromaDB setup
├── .env.example          # Environment template
└── package.json          # Dependencies and scripts
```

### Environment Variables

Key configuration options in `.env`:

```bash
# Required
ANTHROPIC_API_KEY=your_claude_api_key_here
CHROMA_URL=http://localhost:8000

# Optional
NODE_ENV=development
PORT=3000
MAX_CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_RETRIEVED_POLICIES=10
```

See `.env.example` for all configuration options.

## Docker Setup

The project includes Docker Compose for easy ChromaDB deployment:

```bash
# Start all services
docker-compose up -d

# Start only ChromaDB
docker-compose up -d chromadb

# Stop services
docker-compose down

# View logs
docker-compose logs chromadb
```

## Troubleshooting

### ChromaDB Connection Failed

```bash
# Check if ChromaDB is running
docker ps | grep chroma

# Restart ChromaDB
npm run chroma:start

# Check logs
npm run chroma:logs
```

### Office Add-in Not Loading

- Ensure `manifest.xml` is properly configured
- Check if server is running on correct port
- Verify HTTPS certificates for production

### API Key Issues

- Confirm `ANTHROPIC_API_KEY` is set correctly
- Check API key permissions and rate limits
- Verify key format starts with `sk-ant-`

### Memory Issues

For large documents, increase Node.js memory:

```bash
node --max-old-space-size=4096 server.js
```

## Security Considerations

- **API Keys**: Store securely, never commit to version control
- **File Uploads**: Validated file types and size limits
- **Rate Limiting**: Prevents API abuse
- **Input Sanitization**: All user inputs validated
- **HTTPS**: Required for production Office Add-ins

## Performance Tips

- **Chunking Strategy**: Adjust `MAX_CHUNK_SIZE` for your documents
- **Vector DB**: ChromaDB provides fast similarity search
- **Caching**: Enable Redis for improved performance
- **Batch Processing**: Use for multiple documents

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test specific endpoint
npm run health-check
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-username/smart-contract-editor/issues)
- **Documentation**: [Wiki](https://github.com/your-username/smart-contract-editor/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/smart-contract-editor/discussions)

## Acknowledgments

- [Anthropic](https://anthropic.com) for Claude API
- [ChromaDB](https://www.trychroma.com/) for vector database
- [Microsoft](https://developer.microsoft.com/en-us/office/add-ins) for Office Add-ins platform
- Open source community for various dependencies

---

Built with ❤️ by the Smart Contract Editor Team