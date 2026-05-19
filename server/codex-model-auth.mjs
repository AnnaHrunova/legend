import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_CODEX_BACKEND_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const DEFAULT_CODEX_OAUTH_TOKEN_URL = 'https://auth.openai.com/oauth/token';
const DEFAULT_CODEX_OAUTH_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;

export function resolveCodexModelAuth({ agentName }) {
  const authPath = resolveAuthPath();
  const auth = readJsonFile(authPath, agentName);
  return buildModelAuth({ auth, authPath, agentName });
}

export async function resolveFreshCodexModelAuth({ agentName }) {
  const modelAuth = resolveCodexModelAuth({ agentName });
  if (!isExpired(modelAuth.expiresAt)) return modelAuth;
  return refreshCodexModelAuth({ agentName });
}

export async function refreshCodexModelAuth({ agentName }) {
  const authPath = resolveAuthPath();
  const auth = readJsonFile(authPath, agentName);
  const authMode = auth.auth_mode || (auth.OPENAI_API_KEY ? 'apikey' : 'chatgpt');

  if (authMode === 'apikey' || auth.OPENAI_API_KEY) {
    throw new Error(`${agentName} requires Codex/ChatGPT auth, not OPENAI_API_KEY auth: ${authPath}`);
  }

  const refreshToken = auth.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error(`${agentName} requires a Codex refresh_token in ${authPath}`);
  }

  const tokenUrl = process.env.CODEX_REFRESH_TOKEN_URL_OVERRIDE || DEFAULT_CODEX_OAUTH_TOKEN_URL;
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.CODEX_OAUTH_CLIENT_ID || DEFAULT_CODEX_OAUTH_CLIENT_ID,
    }),
  });

  const refreshed = await tokenResponse.json().catch(() => undefined);
  if (!tokenResponse.ok || !refreshed?.access_token) {
    throw new Error(`${agentName} could not refresh Codex auth: HTTP ${tokenResponse.status} ${JSON.stringify(redactTokenResponse(refreshed))}`);
  }

  const nextTokens = {
    ...auth.tokens,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token || auth.tokens.refresh_token,
    id_token: refreshed.id_token || auth.tokens.id_token,
  };
  const accountId =
    nextTokens.account_id ||
    readChatGptClaim(nextTokens.id_token, 'chatgpt_account_id') ||
    readChatGptClaim(nextTokens.access_token, 'chatgpt_account_id');
  if (accountId) nextTokens.account_id = accountId;

  const nextAuth = {
    ...auth,
    auth_mode: 'chatgpt',
    tokens: nextTokens,
    last_refresh: new Date().toISOString(),
  };

  writeJsonFile(authPath, nextAuth, agentName);
  return buildModelAuth({ auth: nextAuth, authPath, agentName });
}

function buildModelAuth({ auth, authPath, agentName }) {
  const authMode = auth.auth_mode || (auth.OPENAI_API_KEY ? 'apikey' : 'chatgpt');

  if (authMode === 'apikey' || auth.OPENAI_API_KEY) {
    throw new Error(`${agentName} requires Codex/ChatGPT auth, not OPENAI_API_KEY auth: ${authPath}`);
  }

  const accessToken = auth.tokens?.access_token;
  if (!accessToken) {
    throw new Error(`${agentName} requires Codex auth tokens in ${authPath}`);
  }

  const accountId =
    auth.tokens?.account_id ||
    readChatGptClaim(auth.tokens?.id_token, 'chatgpt_account_id') ||
    readChatGptClaim(auth.tokens?.access_token, 'chatgpt_account_id');
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (accountId) headers['chatgpt-account-id'] = accountId;
  if (
    readChatGptClaim(auth.tokens?.id_token, 'chatgpt_account_is_fedramp') ||
    readChatGptClaim(auth.tokens?.access_token, 'chatgpt_account_is_fedramp')
  ) {
    headers['X-OpenAI-Fedramp'] = 'true';
  }

  return {
    baseUrl: (process.env.CODEX_BACKEND_BASE_URL || DEFAULT_CODEX_BACKEND_BASE_URL).replace(/\/+$/, ''),
    headers,
    authPath,
    expiresAt: readJwtExpiry(accessToken),
  };
}

function resolveAuthPath() {
  return process.env.CODEX_AUTH_JSON || path.join(
    process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
    'auth.json',
  );
}

function readJsonFile(filePath, agentName) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${agentName} could not read Codex auth file ${filePath}: ${error.message}`);
  }
}

function writeJsonFile(filePath, value, agentName) {
  try {
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    throw new Error(`${agentName} could not write refreshed Codex auth file ${filePath}: ${error.message}`);
  }
}

function readChatGptClaim(jwt, claimName) {
  const claims = decodeJwtPayload(jwt);
  return claims?.['https://api.openai.com/auth']?.[claimName];
}

function readJwtExpiry(jwt) {
  const claims = decodeJwtPayload(jwt);
  return Number.isFinite(claims?.exp) ? new Date(claims.exp * 1000) : undefined;
}

function isExpired(expiresAt) {
  return expiresAt instanceof Date && expiresAt.getTime() <= Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS;
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

function redactTokenResponse(response) {
  if (!response || typeof response !== 'object') return response;
  return Object.fromEntries(
    Object.entries(response).map(([key, value]) => [
      key,
      key.includes('token') ? '[redacted]' : value,
    ]),
  );
}
