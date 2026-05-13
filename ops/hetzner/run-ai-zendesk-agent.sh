#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${LEGEND_AGENT_ROOT:-/opt/legend/ai-zendesk-agent}"
REPO_URL="${LEGEND_AGENT_REPO:-https://github.com/AnnaHrunova/legend.git}"
BRANCH="${LEGEND_AGENT_BRANCH:-codex/ai-zendesk-agent}"
BASE_URL="${LEGEND_AGENT_BASE_URL:-https://app.legenddesk.com}"
MODE="${LEGEND_AGENT_MODE:-triage}"
MODEL="${LEGEND_AGENT_MODEL:-${OPENAI_MODEL:-gpt-5.5}}"
MAX_STEPS="${LEGEND_AGENT_MAX_STEPS:-8}"
RUN_ID="${LEGEND_AGENT_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
ENV_FILE="${LEGEND_AGENT_ENV_FILE:-${ROOT_DIR}/env/legend-ai-zendesk-agent.env}"
PLAYWRIGHT_IMAGE="${LEGEND_AGENT_PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.60.0-noble}"
SOURCE_TGZ="${LEGEND_AGENT_SOURCE_TGZ:-}"

REPO_DIR="${ROOT_DIR}/repo"
RUN_DIR="${ROOT_DIR}/runs/${RUN_ID}"
LOG_DIR="${ROOT_DIR}/logs"
LOG_FILE="${LOG_DIR}/${RUN_ID}.log"
LATEST_DIR="${ROOT_DIR}/latest"
ARTIFACT_TGZ="${ROOT_DIR}/runs/${RUN_ID}.tar.gz"

main() {
  mkdir -p "${ROOT_DIR}" "${LOG_DIR}" "${RUN_DIR}" "${LATEST_DIR}" "$(dirname "${ENV_FILE}")"

  if [ -n "${OPENAI_API_KEY:-}" ]; then
    umask 077
    {
      printf 'OPENAI_API_KEY=%s\n' "${OPENAI_API_KEY}"
      printf 'OPENAI_MODEL=%s\n' "${MODEL}"
    } > "${ENV_FILE}"
  fi

  if [ ! -s "${ENV_FILE}" ]; then
    echo "Missing ${ENV_FILE}; OPENAI_API_KEY must be provided through the Hetzner env file or GitHub Actions secret."
    exit 1
  fi
  chmod 600 "${ENV_FILE}"

  if [ -n "${SOURCE_TGZ}" ] && [ -f "${SOURCE_TGZ}" ]; then
    rm -rf "${REPO_DIR}"
    mkdir -p "${REPO_DIR}"
    tar -xzf "${SOURCE_TGZ}" -C "${REPO_DIR}"
  elif [ ! -d "${REPO_DIR}/.git" ]; then
    if ! command -v git >/dev/null 2>&1; then
      echo "git is required when LEGEND_AGENT_SOURCE_TGZ is not provided."
      exit 1
    fi
    git clone --no-tags "${REPO_URL}" "${REPO_DIR}"
    cd "${REPO_DIR}"
    git fetch --prune origin "${BRANCH}" main
    git checkout -B "${BRANCH}" "origin/${BRANCH}"
    git reset --hard "origin/${BRANCH}"
    git clean -fdx
  else
    cd "${REPO_DIR}"
    git fetch --prune origin "${BRANCH}" main
    git checkout -B "${BRANCH}" "origin/${BRANCH}"
    git reset --hard "origin/${BRANCH}"
    git clean -fdx
  fi

  cd "${REPO_DIR}"

  docker pull "${PLAYWRIGHT_IMAGE}"

  docker run --rm \
    --env-file "${ENV_FILE}" \
    -e "OPENAI_MODEL=${MODEL}" \
    -e "LEGEND_AGENT_BASE_URL=${BASE_URL}" \
    -e "LEGEND_AGENT_MODE=${MODE}" \
    -e "LEGEND_AGENT_MAX_STEPS=${MAX_STEPS}" \
    -v "${REPO_DIR}:/work" \
    -v "${RUN_DIR}:/work/.legend-ai-audits" \
    -w /work \
    "${PLAYWRIGHT_IMAGE}" \
    bash -lc 'npm ci && npm run audit:ai:zendesk:prod -- --url "$LEGEND_AGENT_BASE_URL" --out .legend-ai-audits --mode "$LEGEND_AGENT_MODE" --model "$OPENAI_MODEL" --max-steps "$LEGEND_AGENT_MAX_STEPS"'

  rm -rf "${LATEST_DIR}"
  mkdir -p "${LATEST_DIR}"
  cp -a "${RUN_DIR}/." "${LATEST_DIR}/"
  tar -C "${RUN_DIR}" -czf "${ARTIFACT_TGZ}" .

  echo "Legend AI Zendesk Agent completed."
  echo "Run directory: ${RUN_DIR}"
  echo "Latest directory: ${LATEST_DIR}"
  echo "Artifact: ${ARTIFACT_TGZ}"
  echo "Summary: ${RUN_DIR}/latest-ai-summary.md"
  echo "Full report: ${RUN_DIR}/latest-ai.md"
  echo "Fix prompt: ${RUN_DIR}/latest-ai-fix-prompt.md"
}

mkdir -p "${LOG_DIR}"
set +e
main "$@" 2>&1 | tee "${LOG_FILE}"
status="${PIPESTATUS[0]}"
set -e
exit "${status}"
