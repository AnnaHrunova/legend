import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_CODEX_BACKEND_BASE_URL = 'https://chatgpt.com/backend-api/codex';

export function resolveCodexModelAuth({ agentName }) {
  const authPath = process.env.CODEX_AUTH_JSON || path.join(
    process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'),
    'auth.json',
  );
  const auth = readJsonFile(authPath, agentName);
  const authMode = auth.auth_mode || (auth.OPENAI_API_KEY ? 'apikey' : 'chatgpt');

  if (authMode === 'apikey' || auth.OPENAI_API_KEY) {
    throw new Error(`${agentName} requires Codex/ChatGPT auth, not OPENAI_API_KEY auth: ${authPath}`);
  }

  const accessToken = auth.tokens?.access_token;
  if (!accessToken) {
    throw new Error(`${agentName} requires Codex auth tokens in ${authPath}`);
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

function readJsonFile(filePath, agentName) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${agentName} could not read Codex auth file ${filePath}: ${error.message}`);
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
