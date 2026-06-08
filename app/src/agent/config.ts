/**
 * Shared model configuration for BOTH the braindump agent and the LLM judge.
 * See CLAUDE.md "Agent tech stack".
 *
 * The model is served through **Vertex AI** — initialize `vertexAI()` from
 * `@genkit-ai/google-genai` and rely on the machine's preconfigured GCP project
 * and Application Default Credentials (no API keys in code).
 */
export const AGENT_MODEL = "gemini-3.5-flash"

/**
 * Deterministic Gemini generation config (Genkit shape): temperature 0 and
 * thinking disabled (thinkingBudget 0), so extraction, recall, and judging are
 * reproducible and fast rather than exploratory.
 */
export const AGENT_CONFIG = {
  temperature: 0,
  thinkingConfig: { thinkingBudget: 0 },
} as const
