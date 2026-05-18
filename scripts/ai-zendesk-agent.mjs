#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'https://app.legenddesk.com';
const DEFAULT_OUT_DIR = '.legend-ai-audits';
const DEFAULT_MODEL = 'gpt-5.5';
const DEFAULT_MAX_STEPS = 8;
const DEFAULT_MODE = 'triage';
const DEFAULT_CODEX_BACKEND_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const MAX_BODY_CHARS = 5_500;
const MAX_HISTORY_CHARS = 8_000;
const MODEL_TIMEOUT_MS = 120_000;

const persona = {
  name: 'Mara Quinn',
  role: 'Senior Support Operations Lead',
  frame: 'Zendesk power user validating a support desk prototype before real operational rollout.',
  goals: [
    'find workflow gaps that would slow down real queue triage',
    'spot risky customer-visible actions before they create support debt',
    'verify whether support leads can understand workload, SLA risk, collaboration, and reporting',
    'avoid fantasy findings: every issue must have URL, steps, expected behavior, actual behavior, and evidence',
  ],
};

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    outDir: DEFAULT_OUT_DIR,
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    maxSteps: DEFAULT_MAX_STEPS,
    mode: DEFAULT_MODE,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url') {
      args.baseUrl = argv[++index];
    } else if (arg === '--out') {
      args.outDir = argv[++index];
    } else if (arg === '--model') {
      args.model = argv[++index];
    } else if (arg === '--max-steps') {
      args.maxSteps = Number.parseInt(argv[++index], 10);
    } else if (arg === '--mode') {
      args.mode = argv[++index];
    } else if (arg === '--headed') {
      args.headed = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.maxSteps) || args.maxSteps < 1 || args.maxSteps > 20) {
    throw new Error('--max-steps must be an integer from 1 to 20');
  }
  if (args.mode !== 'triage') {
    throw new Error('--mode currently supports only triage');
  }

  return args;
}

function printHelp() {
  console.log(`Usage: npm run audit:ai:zendesk:prod -- [options]

Options:
  --url <url>          Site URL. Default: ${DEFAULT_BASE_URL}
  --out <dir>          Output directory. Default: ${DEFAULT_OUT_DIR}
  --model <model>      OpenAI model. Default: ${DEFAULT_MODEL}
  --max-steps <n>      Exploration steps, 1-20. Default: ${DEFAULT_MAX_STEPS}
  --mode <mode>        Agent mode. Default: ${DEFAULT_MODE}
  --headed             Show the browser window.
`);
}

function resolveCodexModelAuth() {
  const authPath = process.env.CODEX_AUTH_JSON || path.join(
    process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
    'auth.json',
  );
  const auth = readJsonFile(authPath);
  const authMode = auth.auth_mode || (auth.OPENAI_API_KEY ? 'apikey' : 'chatgpt');

  if (authMode === 'apikey' || auth.OPENAI_API_KEY) {
    throw new Error(`AI Zendesk agent requires Codex/ChatGPT auth, not OPENAI_API_KEY auth: ${authPath}`);
  }

  const accessToken = auth.tokens?.access_token;
  if (!accessToken) {
    throw new Error(`AI Zendesk agent requires Codex auth tokens in ${authPath}`);
  }

  const accountId = auth.tokens?.account_id || readChatGptClaim(auth.tokens?.id_token, 'chatgpt_account_id');
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (accountId) headers['ChatGPT-Account-ID'] = accountId;
  if (readChatGptClaim(auth.tokens?.id_token, 'chatgpt_account_is_fedramp')) {
    headers['X-OpenAI-Fedramp'] = 'true';
  }

  return {
    baseUrl: (process.env.CODEX_BACKEND_BASE_URL || DEFAULT_CODEX_BACKEND_BASE_URL).replace(/\/+$/, ''),
    headers,
  };
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read Codex auth file ${filePath}: ${error.message}`);
  }
}

function readChatGptClaim(jwt, claimName) {
  const claims = decodeJwtPayload(jwt);
  return claims?.['https://api.openai.com/auth']?.[claimName];
}

function decodeJwtPayload(jwt) {
  if (typeof jwt !== 'string') return undefined;
  const payload = jwt.split('.')[1];
  if (!payload) return undefined;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(process.cwd(), args.outDir);
  const screenshotDir = path.join(outDir, 'screenshots');
  await mkdir(screenshotDir, { recursive: true });

  const modelAuth = resolveCodexModelAuth();

  const result = await runAgent({ ...args, outDir, screenshotDir, modelAuth });
  await writeReportFiles(result, outDir);
  console.log(`AI Zendesk agent report: ${path.join(outDir, 'latest-ai.md')}`);
  console.log(`Summary: ${path.join(outDir, 'latest-ai-summary.md')}`);
  console.log(`Codex prompt: ${path.join(outDir, 'latest-ai-codex-prompt.md')}`);
  console.log(`Fix prompt: ${path.join(outDir, 'latest-ai-fix-prompt.md')}`);
}

async function runAgent(args) {
  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((profile) => {
    window.localStorage.setItem('legendDeskTesterProfile', JSON.stringify(profile));
  }, {
    testerId: 'ai-zendesk-support-lead',
    fullName: persona.name,
    email: 'mara.quinn.ai@example.test',
    role: persona.role,
    createdAt: new Date().toISOString(),
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`.trim());
  });

  const history = [];
  const findings = [];
  const visited = [];

  try {
    await page.goto(args.baseUrl, { waitUntil: 'networkidle' });
    for (let step = 1; step <= args.maxSteps; step += 1) {
      const evidence = await captureEvidence(page, args.baseUrl, args.screenshotDir, step);
      evidence.consoleErrors = consoleErrors.splice(0);
      evidence.failedRequests = failedRequests.splice(0);
      visited.push(evidence);

      const decision = await requestAgentDecision({
        modelAuth: args.modelAuth,
        model: args.model,
        baseUrl: args.baseUrl,
        step,
        maxSteps: args.maxSteps,
        evidence,
        history,
        findings,
      });

      history.push({
        step,
        url: evidence.url,
        title: evidence.title,
        decision,
      });

      if (decision.finding) {
        findings.push(normalizeFinding(decision.finding, evidence, step));
      }

      if (decision.action === 'finish') break;
      await executeAction(page, args.baseUrl, decision);
    }
  } finally {
    await browser.close();
  }

  const finalFindings = await requestFinalFindings({
    modelAuth: args.modelAuth,
    model: args.model,
    baseUrl: args.baseUrl,
    visited,
    history,
    findings,
  });

  return {
    generatedAt: new Date().toISOString(),
    mode: args.mode,
    baseUrl: args.baseUrl,
    model: args.model,
    workspaceCwd: process.cwd(),
    outDir: args.outDir,
    persona,
    visited,
    history,
    findings: mergeFindings(findings, finalFindings),
  };
}

async function captureEvidence(page, baseUrl, screenshotDir, step) {
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(300);
  const screenshot = path.join(screenshotDir, `step-${String(step).padStart(2, '0')}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const controls = await collectControls(page);
  const headings = await page
    .locator('h1,h2,h3')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean))
    .catch(() => []);
  const url = page.url();
  const pathName = safePathname(url, baseUrl);

  return {
    step,
    url,
    path: pathName,
    title: await page.title().catch(() => ''),
    screenshot,
    headings,
    controls,
    bodyText: truncate(bodyText, MAX_BODY_CHARS),
  };
}

async function collectControls(page) {
  return page
    .locator('a,button,input,select,textarea,[role="button"],[role="link"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const element = /** @type {HTMLElement} */ (node);
          const tag = element.tagName.toLowerCase();
          const text = (element.innerText || element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || '').trim();
          const href = element.getAttribute('href');
          const disabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
          return { tag, text, href, disabled };
        })
        .filter((control) => control.text || control.href)
        .slice(0, 80)
    )
    .catch(() => []);
}

async function requestAgentDecision({ modelAuth, model, baseUrl, step, maxSteps, evidence, history, findings }) {
  const content = [
    {
      type: 'input_text',
      text: [
        `You are ${persona.name}, ${persona.role}.`,
        persona.frame,
        '',
        'Explore the Legend Desk UI like a real Zendesk power user.',
        'Every finding must be evidence-backed. Do not invent features or backend behavior that is not visible.',
        'Prefer broad workflow coverage over clicking randomly.',
        '',
        `Base URL: ${baseUrl}`,
        `Step: ${step}/${maxSteps}`,
        `Known findings so far: ${JSON.stringify(findings.map(compactFinding), null, 2)}`,
        `Recent history: ${truncate(JSON.stringify(history.slice(-5), null, 2), MAX_HISTORY_CHARS)}`,
        '',
        'Current page evidence:',
        JSON.stringify(compactEvidence(evidence), null, 2),
        '',
        'Return only JSON with this shape:',
        '{"action":"goto|click|fill|finding|finish","reason":"short reason","path":"/optional-path","text":"visible text to click","field":"label/name/placeholder to fill","value":"value to fill","finding":{"severity":"high|medium|low","area":"workflow area","title":"short title","steps":["step"],"expected":"expected","actual":"actual","evidence":"specific URL/text/screenshot clue","recommendation":"concrete fix"}}',
      ].join('\n'),
    },
  ];

  return parseJsonResponse(await createResponse({ modelAuth, model, content }));
}

async function requestFinalFindings({ modelAuth, model, baseUrl, visited, history, findings }) {
  const content = [
    {
      type: 'input_text',
      text: [
        `You are ${persona.name}, ${persona.role}.`,
        'Produce final evidence-backed findings for the Legend Desk prototype.',
        'Use only observed evidence below. If a problem is only a product idea without evidence, omit it.',
        'Return only JSON: {"findings":[...]} using the same finding shape.',
        '',
        `Base URL: ${baseUrl}`,
        `Visited pages: ${JSON.stringify(visited.map(compactEvidence), null, 2)}`,
        `Exploration decisions: ${truncate(JSON.stringify(history, null, 2), MAX_HISTORY_CHARS)}`,
        `Inline findings: ${JSON.stringify(findings.map(compactFinding), null, 2)}`,
      ].join('\n'),
    },
  ];

  const parsed = parseJsonResponse(await createResponse({ modelAuth, model, content }));
  return Array.isArray(parsed.findings) ? parsed.findings : [];
}

async function createResponse({ modelAuth, model, content }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(`${modelAuth.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...modelAuth.headers,
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'medium' },
        input: [{ role: 'user', content }],
      }),
      signal: controller.signal,
    });

    const json = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new Error(`Codex Responses API failed: HTTP ${response.status} ${JSON.stringify(json)}`);
    }
    return extractOutputText(json);
  } finally {
    clearTimeout(timer);
  }
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response?.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

function parseJsonResponse(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Model did not return JSON: ${truncate(trimmed, 800)}`);
  }
}

async function executeAction(page, baseUrl, decision) {
  if (decision.action === 'goto') {
    const target = new URL(decision.path || '/', baseUrl);
    await page.goto(target.toString(), { waitUntil: 'networkidle' });
    return;
  }
  if (decision.action === 'click') {
    await clickVisibleText(page, decision.text);
    return;
  }
  if (decision.action === 'fill') {
    await fillField(page, decision.field, decision.value ?? 'AI Zendesk validation note');
    return;
  }
}

async function clickVisibleText(page, text) {
  if (!text) return;
  const candidates = [
    page.getByRole('button', { name: text }).first(),
    page.getByRole('link', { name: text }).first(),
    page.getByText(text, { exact: false }).first(),
  ];
  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 5_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }
  }
}

async function fillField(page, field, value) {
  if (!field) return;
  const candidates = [
    page.getByLabel(field).first(),
    page.getByPlaceholder(field).first(),
    page.locator(`[name="${cssEscape(field)}"]`).first(),
  ];
  for (const locator of candidates) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.fill(value, { timeout: 5_000 });
      return;
    }
  }
}

function normalizeFinding(finding, evidence, step) {
  return {
    severity: normalizeSeverity(finding.severity),
    area: String(finding.area || 'General workflow'),
    title: String(finding.title || 'Untitled finding'),
    steps: Array.isArray(finding.steps) ? finding.steps.map(String) : [`Observed at ${evidence.url}`],
    expected: String(finding.expected || ''),
    actual: String(finding.actual || ''),
    evidence: String(finding.evidence || `URL: ${evidence.url}; screenshot: ${evidence.screenshot}`),
    recommendation: String(finding.recommendation || ''),
    url: evidence.url,
    screenshot: evidence.screenshot,
    observedAtStep: step,
  };
}

function normalizeSeverity(value) {
  return ['high', 'medium', 'low'].includes(value) ? value : 'low';
}

function mergeFindings(primary, secondary) {
  const findings = [...primary];
  for (const raw of secondary) {
    const finding = {
      severity: normalizeSeverity(raw.severity),
      area: String(raw.area || 'General workflow'),
      title: String(raw.title || 'Untitled finding'),
      steps: Array.isArray(raw.steps) ? raw.steps.map(String) : [],
      expected: String(raw.expected || ''),
      actual: String(raw.actual || ''),
      evidence: String(raw.evidence || ''),
      recommendation: String(raw.recommendation || ''),
      url: String(raw.url || ''),
      screenshot: String(raw.screenshot || ''),
      observedAtStep: Number.isInteger(raw.observedAtStep) ? raw.observedAtStep : undefined,
    };
    const duplicate = findings.some((existing) => existing.title.toLowerCase() === finding.title.toLowerCase());
    if (!duplicate) findings.push(finding);
  }
  return findings;
}

async function writeReportFiles(result, outDir) {
  const summary = renderSummary(result);
  const resultWithSummary = { ...result, summary };
  await writeFile(path.join(outDir, 'latest-ai.json'), `${JSON.stringify(resultWithSummary, null, 2)}\n`);
  const report = renderMarkdownReport(result);
  await writeFile(path.join(outDir, 'latest-ai-summary.md'), summary);
  await writeFile(path.join(outDir, 'latest-ai.md'), report);
  await writeFile(path.join(outDir, 'latest-ai-codex-prompt.md'), renderCodexPrompt(result));
  await writeFile(path.join(outDir, 'latest-ai-fix-prompt.md'), renderCodexFixPrompt(result));
}

function reportPath(result, fileName) {
  return path.join(result.outDir, fileName);
}

function renderSummary(result) {
  const counts = countFindingsBySeverity(result.findings);
  const lines = [
    `Legend AI Zendesk triage: ${result.findings.length} evidence-backed findings.`,
    `Severity: high ${counts.high}, medium ${counts.medium}, low ${counts.low}.`,
  ];
  if (result.findings.length === 0) {
    lines.push('No safe fix prompt is needed unless you want broader product exploration.');
  } else {
    lines.push('Top findings:');
    for (const finding of sortFindingsBySeverity(result.findings).slice(0, 3)) {
      lines.push(`- [${finding.severity}] ${finding.title}: ${finding.recommendation || finding.actual}`);
    }
  }
  lines.push(`Report: ${path.join(process.cwd(), DEFAULT_OUT_DIR, 'latest-ai.md')}`);
  return `${lines.join('\n')}\n`;
}

function renderMarkdownReport(result) {
  const lines = [
    '# AI Zendesk Agent Report',
    '',
    `Generated: ${result.generatedAt}`,
    `Base URL: ${result.baseUrl}`,
    `Model: ${result.model}`,
    `Persona: ${persona.name}, ${persona.role}`,
    '',
    '## Findings',
    '',
  ];
  if (result.findings.length === 0) {
    lines.push('No evidence-backed findings were reported.');
  } else {
    for (const finding of result.findings) {
      lines.push(`### [${finding.severity}] ${finding.title}`);
      lines.push('');
      lines.push(`Area: ${finding.area}`);
      if (finding.url) lines.push(`URL: ${finding.url}`);
      if (finding.screenshot) lines.push(`Screenshot: ${finding.screenshot}`);
      lines.push(`Expected: ${finding.expected}`);
      lines.push(`Actual: ${finding.actual}`);
      lines.push(`Evidence: ${finding.evidence}`);
      lines.push(`Recommendation: ${finding.recommendation}`);
      if (finding.steps.length > 0) {
        lines.push('Steps:');
        for (const step of finding.steps) lines.push(`- ${step}`);
      }
      lines.push('');
    }
  }
  lines.push('## Visited Pages');
  lines.push('');
  for (const page of result.visited) {
    lines.push(`- Step ${page.step}: ${page.url} (${page.screenshot})`);
  }
  return `${lines.join('\n')}\n`;
}

function renderCodexPrompt(result) {
  const lines = [
    `You are working in ${result.workspaceCwd}.`,
    '',
    'An AI-powered Zendesk support lead agent audited the deployed Legend Desk prototype.',
    'Treat this as evidence-backed product validation, not as permission for broad rewrites.',
    '',
    'Your task:',
    '1. Triage the findings.',
    '2. Propose a short implementation plan for the top safe fixes.',
    '3. Do not change code or deploy unless explicitly asked to run fix mode.',
    '',
    `Model: ${result.model}`,
    `Base URL: ${result.baseUrl}`,
    `Full report: ${reportPath(result, 'latest-ai.md')}`,
    '',
    'Findings:',
  ];
  if (result.findings.length === 0) {
    lines.push('- No evidence-backed findings were reported.');
  } else {
    for (const finding of result.findings) {
      lines.push(`- [${finding.severity}] ${finding.area}: ${finding.title}`);
      lines.push(`  Evidence: ${finding.evidence}`);
      if (finding.url) lines.push(`  URL: ${finding.url}`);
      if (finding.screenshot) lines.push(`  Screenshot: ${finding.screenshot}`);
      lines.push(`  Expected: ${finding.expected}`);
      lines.push(`  Actual: ${finding.actual}`);
      lines.push(`  Recommendation: ${finding.recommendation}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderCodexFixPrompt(result) {
  const lines = [
    `You are working in ${result.workspaceCwd}.`,
    '',
    'Bagutka received explicit owner confirmation to fix the AI Zendesk agent findings.',
    'This is fix mode, not open-ended redesign.',
    '',
    'Required workflow:',
    '1. Fetch the latest origin/main.',
    '2. Create a new branch from origin/main before editing. Use a branch name like codex/legend-ai-fixes-YYYYMMDD-HHMM.',
    '3. Inspect the current app and the report artifacts before changing code.',
    '4. Implement only safe, evidence-backed fixes from the findings below.',
    '5. Update README or local docs when behavior or validation workflow changes.',
    '6. Run npm run lint and npm run build. If npm is missing from PATH, try /opt/homebrew/opt/node@22/bin/npm before stopping.',
    '7. Commit the fixes on the new branch with a concise message.',
    '8. Push the fix branch to origin.',
    '9. Deploy the pushed branch to production by dispatching the Hetzner workflow for that branch: gh workflow run deploy-hetzner.yml --ref <branch>. Then watch the workflow until it completes successfully.',
    '10. Do not merge to main and do not open a PR unless explicitly asked after the deployed branch is reviewed.',
    '',
    'Bagutka status contract:',
    'Send these as standalone progress updates so Bagutka can relay them to Telegram:',
    '1. LEGEND FIX STATUS 1/3: code ready. Include branch name and local checks.',
    '2. LEGEND FIX STATUS 2/3: code pushed. Include branch name and commit SHA.',
    '3. LEGEND FIX STATUS 3/3: branch deployed. Include workflow run URL and production URL.',
    'If any milestone fails, stop and send LEGEND FIX FAILED: <stage> - <specific reason>.',
    '',
    `Model: ${result.model}`,
    `Mode: ${result.mode}`,
    `Base URL: ${result.baseUrl}`,
    `Full report: ${reportPath(result, 'latest-ai.md')}`,
    `Raw JSON: ${reportPath(result, 'latest-ai.json')}`,
    '',
    'Findings to fix:',
  ];
  if (result.findings.length === 0) {
    lines.push('- No evidence-backed findings were reported. Stop and explain that there is nothing safe to fix from this run.');
  } else {
    for (const finding of sortFindingsBySeverity(result.findings)) {
      lines.push(`- [${finding.severity}] ${finding.area}: ${finding.title}`);
      if (finding.url) lines.push(`  URL: ${finding.url}`);
      if (finding.screenshot) lines.push(`  Screenshot: ${finding.screenshot}`);
      lines.push(`  Expected: ${finding.expected}`);
      lines.push(`  Actual: ${finding.actual}`);
      lines.push(`  Evidence: ${finding.evidence}`);
      lines.push(`  Recommendation: ${finding.recommendation}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function compactEvidence(evidence) {
  return {
    step: evidence.step,
    url: evidence.url,
    path: evidence.path,
    title: evidence.title,
    screenshot: evidence.screenshot,
    headings: evidence.headings,
    controls: evidence.controls,
    consoleErrors: evidence.consoleErrors,
    failedRequests: evidence.failedRequests,
    bodyText: evidence.bodyText,
  };
}

function compactFinding(finding) {
  return {
    severity: finding.severity,
    area: finding.area,
    title: finding.title,
    url: finding.url,
    evidence: finding.evidence,
  };
}

function sortFindingsBySeverity(findings) {
  const severityRank = { high: 0, medium: 1, low: 2 };
  return [...findings].sort((left, right) => {
    const leftRank = severityRank[left.severity] ?? 99;
    const rightRank = severityRank[right.severity] ?? 99;
    return leftRank - rightRank || left.title.localeCompare(right.title);
  });
}

function countFindingsBySeverity(findings) {
  return findings.reduce(
    (counts, finding) => {
      counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

function safePathname(rawUrl, baseUrl) {
  try {
    const url = new URL(rawUrl);
    const base = new URL(baseUrl);
    return url.origin === base.origin ? url.pathname : rawUrl;
  } catch {
    return rawUrl;
  }
}

function loadEnvFile(fileName) {
  let content;
  try {
    content = readFileSync(path.resolve(process.cwd(), fileName), 'utf8');
  } catch {
    return;
  }
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
    }
  }
}

function truncate(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 3)}...`;
}

function cssEscape(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
