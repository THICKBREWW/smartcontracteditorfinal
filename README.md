# Smart Contract Editor

An AI-powered Microsoft Word Add-in that provides intelligent contract compliance analysis using RAG (Retrieval-Augmented Generation) with ChromaDB vector database and Claude API.

## Overview

This tool integrates directly into Microsoft Word to analyze contracts against uploaded policy documents. It uses semantic search to find relevant policy sections and combines AI analysis with rule-based checking to provide compliance scores, identify issues, and suggest improvements.

## Core Features

- **Microsoft Word Integration**: Native Office Add-in with taskpane interface
- **AI-Powered Analysis**: Uses Anthropic's Claude API for intelligent document review
- **RAG Implementation**: ChromaDB vector database for semantic policy matching
- **Policy Management**: Upload and manage compliance documents (.txt, .doc, .docx, .pdf)
- **Real-time Analysis**: Instant compliance scoring and risk assessment
- **Grammar Checking**: AI-enhanced grammar and style suggestions
- **Export Functionality**: Save analysis results as JSON reports

## Technical Architecture

### Backend Components
- **Express.js Server**: RESTful API with comprehensive error handling
- **ChromaDB**: Vector database for semantic document similarity search
- **File Processing**: Multer-based document upload with validation
- **Logging**: Winston-based structured logging system

### Frontend Components
- **Office.js Integration**: Native Microsoft Word Add-in framework
- **Drag-and-Drop Interface**: Policy document upload functionality
- **Real-time Results**: Dynamic analysis display with scoring visualization

### Analysis Pipeline
1. **Document Chunking**: Intelligent text segmentation for optimal processing
2. **Vector Search**: Semantic similarity matching against policy database
3. **AI Analysis**: Claude API integration for contextual compliance review
4. **Rule-based Validation**: Traditional pattern matching for common issues
5. **Result Synthesis**: Combined scoring and recommendation generation

## Prerequisites

- Node.js 18.0 or higher
- npm 8.0 or higher
- Docker and Docker Compose (for ChromaDB)
- Microsoft Word (for testing the add-in)
- Anthropic API key

## Installation

### 1. Initial Setup
```bash
git clone <repository-url>
cd smart-contract-editor
npm install
```

### 2. Environment Configuration
Create environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
NODE_ENV=development
PORT=3000
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
CHROMA_URL=http://localhost:8000
```

### 3. Start Services
```bash
# Start ChromaDB vector database
npm run chroma:start

# Copy UI files to public directory
npm run copy-files

# Start development server
npm run dev-server
```

### 4. Office Add-in Installation
1. Open Microsoft Word
2. Navigate to Insert → Get Add-ins → Upload My Add-in
3. Select `public/manifest.xml`
4. The Smart Contract Editor will appear in your Word ribbon

## Usage

### Policy Document Management
1. Click "Upload Policies" in the Word Add-in taskpane
2. Select compliance documents (supports .txt, .doc, .docx, .pdf)
3. Documents are automatically chunked and indexed in ChromaDB

### Contract Analysis
1. Open or create a contract document in Word
2. Click "Analyze Current Document" in the taskpane
3. Review the generated compliance score, identified issues, and improvement suggestions
4. Apply suggested changes directly to your document

### Grammar and Style Review
1. Select text in your Word document
2. Click "Grammar Check" for AI-powered language analysis
3. Review and apply corrections as needed

## API Endpoints

### Policy Management
- `POST /api/policies/upload` - Upload policy documents
- `GET /api/policies` - Retrieve policy list
- `DELETE /api/policies/:id` - Remove specific policy

### Document Analysis
- `POST /api/analyze` - Analyze document text
- `POST /api/grammar-check` - Grammar and style checking

### System Monitoring
- `GET /api/health` - System status and service connectivity
- `GET /api/results` - Analysis history
- `GET /api/results/:id` - Specific analysis result

## Configuration Options

### Environment Variables
```env
# Core Configuration
NODE_ENV=development|production
PORT=3000
ANTHROPIC_API_KEY=sk-ant-...
CHROMA_URL=http://localhost:8000

# Analysis Settings
MAX_CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MAX_RETRIEVED_POLICIES=10

# File Upload Limits
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=.txt,.doc,.docx,.pdf

# Security Settings
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Available Scripts
```bash
npm start              # Production server
npm run dev-server     # Development with file watching
npm run chroma:start   # Start ChromaDB container
npm run chroma:stop    # Stop ChromaDB container
npm run chroma:logs    # View ChromaDB logs
npm run health-check   # Test server connectivity
npm run validate       # Verify setup configuration
npm test               # Run test suite
```

## Data Persistence

### Persistent Data
- **Policy Documents**: Stored in ChromaDB with persistent Docker volumes
- **Vector Embeddings**: Maintained across container restarts
- **Configuration**: Environment variables and uploaded files
- **Application Logs**: Stored in `logs/app.log`

### Non-Persistent Data
- **Analysis Results**: Stored in server memory (cleared on restart)
- **Session Data**: Temporary analysis state

## Docker Configuration

ChromaDB runs in a containerized environment with persistent storage:

```yaml
# docker-compose.yml
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chromadb_data:/chroma/chroma
```

Persistent volume mapping ensures data survives container restarts.

## Fallback Mechanisms

The system implements graceful degradation:

1. **RAG Analysis**: Full AI + vector search (optimal)
2. **AI Analysis**: Claude API without vector search (reduced context)
3. **Basic Analysis**: Rule-based pattern matching (minimal functionality)

This ensures functionality even when ChromaDB or the Anthropic API is unavailable.

## Development

### Project Structure
```
smart-contract-editor/
├── server.js              # Main application server
├── taskpane.html          # Office Add-in UI
├── manifest.xml           # Office Add-in configuration
├── public/                # Static assets and copied files
├── uploads/policies/      # Uploaded policy documents
├── logs/                  # Application logs
├── data/chromadb/        # Persistent vector database
├── scripts/setup.js      # Environment setup utility
└── docker-compose.yml    # ChromaDB container configuration
```

### Testing
```bash
# Run test suite
npm test

# Check system health
npm run health-check

# Validate configuration
npm run validate
```

## Security Considerations

- **API Key Protection**: Environment variables prevent credential exposure
- **File Validation**: Upload restrictions by type and size
- **Rate Limiting**: Prevents API abuse in production environments
- **Input Sanitization**: All user inputs are validated and sanitized
- **HTTPS Requirements**: SSL/TLS required for production Office Add-ins

## Performance Optimization

- **Document Chunking**: Configurable chunk size for optimal processing
- **Vector Similarity Search**: Fast semantic matching via ChromaDB
- **Memory Management**: Automatic cleanup of old analysis results
- **Caching**: Optional Redis integration for improved response times

## Troubleshooting

### Common Issues

**ChromaDB Connection Failed**
```bash
# Check container status
docker ps | grep chroma

# View logs
npm run chroma:logs

# Restart service
npm run chroma:start
```

**Office Add-in Not Loading**
- Verify `manifest.xml` is properly configured
- Ensure server is running on the correct port
- Check browser developer console for errors

**API Key Issues**
- Confirm `ANTHROPIC_API_KEY` format starts with `sk-ant-`
- Verify API key has sufficient usage limits
- Check for rate limiting restrictions

### System Requirements
- Sufficient RAM for document processing (minimum 4GB recommended)
- Docker Desktop or Docker Engine for ChromaDB
- Modern web browser for Office Add-in functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with appropriate tests
4. Submit pull request with detailed description

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues for bug reports
- GitHub Discussions for questions and feature requests
- Check logs in `logs/app.log` for debugging information