# Contributing to Coin Daemon MCP

Thank you for your interest in contributing to the Coin Daemon MCP project! This document provides guidelines and instructions for contributing.

## Security Considerations

Given that this project interfaces with cryptocurrency daemons, security is our top priority. Please keep these points in mind:

1. All contributions must go through thorough security review
2. No credentials or sensitive data should be committed to the repository
3. All dependencies must be carefully vetted
4. Security-related issues should be reported privately

## Development Setup

1. Clone the repository:
\`\`\`bash
git clone https://github.com/pooly-canada/coin_daemon_mcp.git
cd coin_daemon_mcp
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Build the project:
\`\`\`bash
npm run build
\`\`\`

4. Run tests:
\`\`\`bash
npm test
\`\`\`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/my-new-feature\`)
3. Make your changes
4. Run all tests
5. Update documentation as needed
6. Commit your changes (\`git commit -am 'Add some feature'\`)
7. Push to the branch (\`git push origin feature/my-new-feature\`)
8. Create a Pull Request

## Code Style

- Follow TypeScript best practices
- Use consistent indentation (2 spaces)
- Include JSDoc comments for public APIs
- Write meaningful commit messages
- Include tests for new features

## Testing

- All new features must include tests
- Run the full test suite before submitting PRs
- Include both unit and integration tests where appropriate
- Test edge cases and error conditions

## Documentation

- Update README.md with details of changes to the interface
- Update examples if needed
- Include JSDoc comments for all public methods
- Update type definitions as needed

## Reporting Issues

1. Check if the issue already exists
2. Use the issue template
3. Include detailed reproduction steps
4. Include version information
5. For security issues, follow private disclosure procedure

## Security Issues

If you discover a security vulnerability, please do NOT open an issue. Email security@pooly.ca instead.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/). By participating, you are expected to uphold this code.

## Questions?

If you have questions about contributing, feel free to:
1. Open a discussion in the GitHub repository
2. Email community@pooly.ca

Thank you for contributing to make cryptocurrency daemon management safer and more accessible!