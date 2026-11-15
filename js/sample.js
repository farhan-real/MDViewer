/**
 * Default Sample Markdown Document
 * Demonstrates code block filename extraction, tables, and full LaTeX rendering.
 */
window.SAMPLE_MARKDOWN = `# MDViewer System Architecture
A professional AMOLED markdown viewer with contextual code extraction and full $\\LaTeX$ support.

## Core Infrastructure

### \`gateway.config.json\`
The block below has no filename in its code fence, but its filename is automatically detected and validated from the heading above:

\`\`\`json
{
  "service": "api-gateway",
  "port": 8443,
  "rateLimit": {
    "windowMs": 60000,
    "maxRequests": 5000
  },
  "ssl": {
    "enabled": true,
    "cert": "/etc/ssl/certs/bundle.crt"
  }
}
\`\`\`

### File: \`src/engine/dispatcher.ts\`
This block also extracts its filename directly from the heading pattern using regex validation:

\`\`\`typescript
export interface TaskEnvelope<T> {
  id: string;
  payload: T;
  priority: number;
}

export class TaskDispatcher {
  public execute<T>(task: TaskEnvelope<T>): boolean {
    console.info(\`[Task \${task.id}] executing with priority \${task.priority}\`);
    return true;
  }
}
\`\`\`

### Deployment Configuration via \`docker-compose.yml\`

\`\`\`yaml
version: '3.9'
services:
  worker:
    build: .
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4096M
\`\`\`

### Mathematical & $\\LaTeX$ Rendering ($\\hat{H}\\ket{\\psi} = E\\ket{\\psi}$)
Inline formulas like $E = mc^2$, $12 \\div 3 = 4$, and \\(\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}\\) render alongside multi-line derivations, boxed answers, chemistry (\\(\\ce{2H2 + O2 -> 2H2O}\\)), and matrices:

> **Gaussian Integral:**
> $$
> \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\boxed{\\sqrt{\\pi}}
> $$

\\begin{align}
\\mathcal{L}(\\theta) &= -\\frac{1}{N} \\sum_{i=1}^{N} \\Big[ y_i \\log(\\hat{y}_i) + (1 - y_i)\\log(1 - \\hat{y}_i) \\Big] \\\\
\\mathbf{A} &= \\begin{bmatrix} \\cos\\theta & -\\sin\\theta \\\\ \\sin\\theta & \\cos\\theta \\end{bmatrix}, \\quad \\bra{\\psi}\\hat{H}\\ket{\\phi} = \\cancel{0} + \\hbar\\omega
\\end{align}

\`\`\`math
P(A \\mid B) = \\frac{P(B \\mid A) \\, P(A)}{P(B)}
\`\`\`

### Comprehensive System Health Metrics

| Service Component | Operational Status | Latency Window | Formulation |
| :--- | :--- | :--- | :--- |
| Core Dispatcher | Active | $< 1.2\\text{ ms}$ | $\\mathcal{O}(\\log n)$ |
| Task Persistence | Active | $< 4.5\\text{ ms}$ | $\\|x\\|_2 \\le \\epsilon$ |
| Edge Ingress | Active | $< 0.8\\text{ ms}$ | $\\lambda \\approx 1.25\\times 10^4$ |

### \`scripts/backup.sh\`
Routine cold snapshotting utility:

\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/var/backups/mdviewer/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/data.tar.gz" /var/lib/mdviewer
echo "Backup saved to $BACKUP_DIR"
\`\`\`

Use the bottom-right **Code Copy Menu** or the copy button on any block header to copy code instantly.`;