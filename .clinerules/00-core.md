# 00-core.md: Core Operating Principles

1. **Environment**:
   - OS: Windows 11 x64.
   - Shell: PowerShell 7 (`pwsh`).
   - Runtimes: Node.js 24+, Python 3.12+, uv, Docker Desktop.

2. **Communication & Output Style (ADHD)**:
   - Lead with code snippet, command, or file path first.
   - One bounded action per step; cap lists to 5 items.
   - End with one concrete next action (< 2 minutes).
   - No fluff, preamble, or redundant recaps.

3. **Safety & Zero Destructive Actions**:
   - NEVER run `git reset --hard` or `git clean -fd`.
   - NEVER delete existing branches, configurations, or Docker volumes without confirmation.
   - NEVER expose or log secrets, tokens, or API keys.
