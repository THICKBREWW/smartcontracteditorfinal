# Smart Contract Editor - Installation Guide

## Quick 15-Minute Setup

### Prerequisites
- Node.js (16+ recommended) - [Download here](https://nodejs.org/)
- Microsoft Word (2016 or later)
- Git (optional) - [Download here](https://git-scm.com/)

### Step 1: Create Project Directory
```bash
# Create project folder
mkdir smart-contract-editor
cd smart-contract-editor

# Initialize npm project
npm init -y
```

### Step 2: Install Dependencies
```bash
npm install express cors multer helmet compression morgan dotenv express-rate-limit express-validator uuid
npm install --save-dev nodemon concurrently jest supertest
```

### Step 3: Create Project Files

Create the following files in your project directory:

1. **server.js** - Copy from the server.js artifact above
2. **package.json** - Copy from the package.json artifact above  
3. **manifest.xml** - Copy from the manifest.xml artifact above
4. **taskpane.html** - Copy from the taskpane.html artifact above
5. **.env** - Copy from the .env.example artifact above (rename to .env)
6. **setup.js** - Copy from the setup.js artifact above

### Step 4: Run Setup Script
```bash
# Run the automated setup
node setup.js

# Or manually create directories
mkdir -p public public/assets uploads/policies uploads/temp logs
```

### Step 5: Start the Server
```bash
# Development mode with auto-reload
npm run dev

# Or standard mode
npm start
```

The server will start at `http://localhost:3000`

### Step 6: Install in Microsoft Word

1. **Open Microsoft Word**
2. **Go to Insert Tab → My Add-ins**
3. **Click "Upload My Add-in"**
4. **Browse and select** `manifest.xml` from your project folder
5. **Click "Upload"**

The Smart Contract Editor panel should now appear in Word!

## Project Structure

```
smart-contract-editor/
├── server.js              # Main server file
├── package.json           # Dependencies
├── manifest.xml           # Office Add-in configuration
├── taskpane.html          # Main UI interface
├── setup.js               # Automated setup script
├── .env                   # Environment variables
├── README.md              # Project documentation
├── public/                # Static files
│   ├── taskpane.html      # UI served to Word
│   ├── manifest.xml       # Add-in manifest
│   └── assets/            # Icons and images
├── uploads/               # File storage
│   ├── policies/          # Policy documents
│   └── temp/              # Temporary files
└── logs/                  # Application logs
```

## Usage Instructions

### 1. Upload Policy Documents
- Drag and drop or click to upload policy files (.txt, .docx, .pdf)
- Supported formats: Text, Word documents, PDFs
- Multiple files can be uploaded at once

### 2. Analyze Contracts
- Open any contract document in Word
- Click "Analyze Current Document" in the plugin panel
- Wait for analysis to complete (2-5 seconds)

### 3. Review Results
- **Compliance Score**: Overall percentage (0-100%)
- **Issues Found**: Problems detected in the contract
- **Suggestions**: AI-powered recommendations
- **Risk Assessment**: High/Medium/Low risk classification

### 4. Apply Improvements
- Review individual suggestions
- Use "Apply All Suggestions" for automatic fixes
- Manual editing for complex changes

## Features Overview

### Core Features ✅
- **Policy Compliance Checking** - Compare contracts against uploaded policies
- **AI-Powered Suggestions** - Intelligent recommendations for improvements
- **Grammar & Spell Check** - Language analysis and correction
- **Risk Assessment** - Identify high-risk clauses and terms
- **Real-time Analysis** - Live feedback as you edit
- **Document Export** - Save analysis reports

### Analysis Categories
1. **Policy Compliance** - Missing required terms and clauses
2. **Language Issues** - Archaic terms, clarity problems
3. **Structure Problems** - Missing essential contract sections  
4. **Risk Factors** - High-risk terms and unlimited liability
5. **Grammar Errors** - Spelling, punctuation, formatting

## API Endpoints

### Policy Management
- `POST /api/policies/upload` - Upload policy documents
- `GET /api/policies` - List all policies
- `DELETE /api/policies/:id` - Remove policy

### Document Analysis  
- `POST /api/analyze` - Analyze contract text
- `POST /api/grammar-check` - Grammar and spell check
- `GET /api/results` - Fetch analysis history
- `GET /api/results/:id` - Get specific analysis

## Configuration Options

Edit `.env` file to customize:

```bash
# Server settings
PORT=3000
NODE_ENV=development

# File upload limits
MAX_FILE_SIZE=10485760  # 10MB
MAX_FILES=10

# Security keys (auto-generated)
SESSION_SECRET=your-secret-here
JWT_SECRET=your-jwt-secret
```

## Troubleshooting

### Common Issues

**1. Add-in won't load in Word**
- Check that server is running on localhost:3000
- Verify manifest.xml file path is correct
- Try clearing Word's add-in cache
- Restart Word completely

**2. Policy upload fails**
- Check file size limits (10MB default)
- Ensure supported file formats (.txt, .docx, .pdf)
- Verify uploads/policies directory exists

**3. Analysis not working**
- Upload at least one policy document first
- Check that document has text content
- Look at server logs for errors (npm run dev shows logs)

**4. Server won't start**
- Check if port 3000 is already in use
- Verify Node.js version (16+ required)
- Run `npm install` to ensure dependencies are installed

### Debug Mode
```bash
# Run with detailed logging
NODE_ENV=development npm run dev
```

### Reset Everything
```bash
# Clear all data and restart
rm -rf uploads/* logs/*
npm run dev
```

## Development Tips

### Adding New Features
1. Server-side logic goes in `server.js`
2. UI changes go in `taskpane.html`
3. Test with sample contracts and policies

### Performance Optimization
- Large documents may take longer to analyze
- Consider implementing caching for repeated analyses
- File upload size limits can be adjusted in `.env`

### Security Considerations
- All file uploads are stored locally
- No data is sent to external services by default
- Implement authentication for production use

## Production Deployment

### Requirements
- HTTPS certificate (required for Office Add-ins)
- Domain name
- Proper database setup (optional)

### Steps
1. Set `NODE_ENV=production` in `.env`
2. Configure HTTPS certificates
3. Update manifest.xml with production URLs
4. Deploy to cloud service (Azure, AWS, etc.)
5. Submit to Microsoft AppSource (optional)

## Support and Updates

### Getting Help
- Check the troubleshooting section above
- Review server logs for error details
- Test with simple contracts first

### Regular Updates
- Keep dependencies updated: `npm update`
- Monitor for security patches
- Backup policy documents and configurations

---

**That's it! Your Smart Contract Editor should now be running successfully in Microsoft Word. Happy contract editing! 🎉**