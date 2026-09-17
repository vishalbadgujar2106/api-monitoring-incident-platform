import { AppError } from '../../middleware/errorHandler.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 30000;

const CONFIDENCE_LEVELS = ['low', 'medium', 'high'];

// Only these fields ever leave the process for analysis — the incident's
// own record plus the health checks already scoped to its failure window.
// No .env contents, no data from other incidents/services, no secrets.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'A one-sentence plain-English summary of what happened.',
    },
    likelyCause: {
      type: 'string',
      description: 'The most likely root cause, in 1-3 sentences.',
    },
    suggestedSteps: {
      type: 'string',
      description: 'A short numbered list (as plain text, one step per line) of concrete next steps.',
    },
    evidence: {
      type: 'string',
      description: 'The specific data points from the health checks that support this diagnosis.',
    },
    confidence: {
      type: 'string',
      enum: CONFIDENCE_LEVELS,
      description: 'How confident this diagnosis is, given the available data.',
    },
  },
  required: ['summary', 'likelyCause', 'suggestedSteps', 'evidence', 'confidence'],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  'You are an SRE assistant analyzing API monitoring incidents. Be concise and concrete. ' +
  'Only rely on the incident data provided in the input — do not assume access to anything ' +
  'else about the system.';

// Reads AI config on every call (not cached at module load) so a config
// fix can take effect without restarting the process.
function getConfig() {
  const provider = process.env.AI_PROVIDER;

  // Fail loudly on an unsupported provider rather than silently falling
  // back to OpenAI (or anything else) — the operator asked for something
  // this build doesn't implement.
  if (provider && provider !== 'openai') {
    throw new AppError(
      `Unsupported AI_PROVIDER "${provider}" — this build only supports "openai"`,
      500,
      'AI_PROVIDER_UNSUPPORTED',
    );
  }

  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (provider !== 'openai' || !apiKey || !model) {
    throw new AppError(
      'AI analysis is not configured — set AI_PROVIDER=openai, AI_MODEL, and AI_API_KEY in backend/.env',
      500,
      'AI_NOT_CONFIGURED',
    );
  }

  return { apiKey, model };
}

function buildPrompt({ incident, healthChecks }) {
  const service = incident.service ?? {};

  const checksSummary = healthChecks
    .slice(-30)
    .map((check) => {
      const parts = [
        check.checkedAt,
        check.status,
        `code=${check.statusCode ?? 'n/a'}`,
        `response_time_ms=${check.responseTimeMs ?? 'n/a'}`,
      ];
      if (check.errorMessage) parts.push(`error="${check.errorMessage}"`);
      return `- ${parts.join(' ')}`;
    })
    .join('\n');

  return `Incident for service "${service.name ?? 'unknown'}"
URL: ${service.method ?? 'GET'} ${service.url ?? 'unknown'}
Expected status: ${service.expectedStatus ?? 'n/a'}
Incident status: ${incident.status}
Started at: ${incident.startedAt}
Resolved at: ${incident.resolvedAt ?? 'still open'}
Failure count: ${incident.failureCount}

Health checks around the failure window (chronological, oldest first):
${checksSummary || '(no health checks recorded)'}

Based only on the information above, explain the most likely root cause and suggest concrete next steps for an on-call engineer.`;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Defense in depth: even though the request enforces a strict JSON schema,
// never trust provider output blindly before it's persisted and shown to
// the user — validate shape and field types ourselves too.
function validateAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  const { summary, likelyCause, suggestedSteps, evidence, confidence } = parsed;
  return (
    isNonEmptyString(summary) &&
    isNonEmptyString(likelyCause) &&
    isNonEmptyString(suggestedSteps) &&
    isNonEmptyString(evidence) &&
    CONFIDENCE_LEVELS.includes(confidence)
  );
}

async function callOpenAi({ apiKey, model, input }) {
  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_PROMPT,
        input,
        text: {
          format: {
            type: 'json_schema',
            name: 'incident_analysis',
            schema: RESPONSE_SCHEMA,
            strict: true,
          },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new AppError('AI provider request timed out', 504, 'AI_TIMEOUT');
    }
    throw new AppError('Failed to reach AI provider', 502, 'AI_PROVIDER_UNREACHABLE');
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AppError('AI provider rejected the configured API key', 500, 'AI_AUTH_FAILED');
    }
    if (response.status === 429) {
      throw new AppError('AI provider rate limit exceeded, try again shortly', 429, 'AI_RATE_LIMITED');
    }
    // Only forward the provider's message for non-auth errors — an auth
    // error's message can echo back a masked fragment of the key.
    let providerMessage = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      providerMessage = errorBody?.error?.message ?? providerMessage;
    } catch {
      // ignore unparsable error bodies, fall back to the status code
    }
    throw new AppError(`AI provider error: ${providerMessage}`, 502, 'AI_PROVIDER_ERROR');
  }

  return response.json();
}

function extractOutputText(data) {
  if (data.status === 'incomplete') {
    throw new AppError('AI provider returned an incomplete analysis', 502, 'AI_INCOMPLETE_RESPONSE');
  }

  const message = (data.output ?? []).find((item) => item.type === 'message');
  const content = message?.content ?? [];

  if (content.some((part) => part.type === 'refusal')) {
    throw new AppError('AI provider declined to analyze this incident', 502, 'AI_REFUSED');
  }

  const textPart = content.find((part) => part.type === 'output_text');
  if (!textPart?.text) {
    throw new AppError('AI provider returned no analysis text', 502, 'AI_EMPTY_RESPONSE');
  }

  return textPart.text;
}

// Calls OpenAI with the incident's own context (service config, incident
// timing, and the health checks already scoped to its failure window) and
// returns a structured { rootCauseSummary, suggestedSteps } result. Never
// send anything beyond that context — no env contents, no unrelated data.
export async function analyzeIncident({ incident, healthChecks }) {
  const { apiKey, model } = getConfig();

  const data = await callOpenAi({ apiKey, model, input: buildPrompt({ incident, healthChecks }) });
  const text = extractOutputText(data);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError('AI provider returned malformed analysis output', 502, 'AI_INVALID_OUTPUT');
  }

  if (!validateAnalysis(parsed)) {
    throw new AppError('AI provider returned an unexpected analysis structure', 502, 'AI_INVALID_OUTPUT');
  }

  // The API/DB/UI contract (rootCauseSummary + suggestedSteps) predates
  // this richer 5-field schema — fold the extra fields into the root
  // cause text rather than changing that contract.
  return {
    rootCauseSummary: `${parsed.summary}\n\nLikely cause: ${parsed.likelyCause}\n\nEvidence: ${parsed.evidence}\n\nConfidence: ${parsed.confidence}`,
    suggestedSteps: parsed.suggestedSteps,
  };
}
