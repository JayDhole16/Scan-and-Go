# Contributing

Thanks for your interest in contributing to Scan & Go.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/scan-and-go`
3. Create a branch: `git checkout -b feat/your-feature`
4. Set up your environment: `cp .env.example .env` and fill in values
5. Install dependencies: `npm install`
6. Start dev server: `npm run dev`

## Development Guidelines

- Keep PRs focused — one feature or fix per PR
- Run `npm run lint` before committing
- Run `npm run test` to make sure tests pass
- Follow the existing code style (TypeScript, functional components, hooks)
- Don't commit `.env` files or secrets

## Commit Style

Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `chore:` maintenance, deps, config
- `docs:` documentation only
- `refactor:` code change without feature/fix

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Environment (OS, Node version, browser)
