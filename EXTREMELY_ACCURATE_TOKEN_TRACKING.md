
# Extremely Accurate Token Tracking

This guide is for an AI agent working on metriq. Its job is to explain how to
track, estimate, and attribute token usage as accurately as possible for AI
chatbots and coding agents.

The key idea: token usage is not just the user's prompt. For an agent, total
usage is the sum of every model call, including hidden or generated context such
as system instructions, chat history, tool schemas, file contents, search
results, terminal output, and the assistant's responses.

## Accuracy Levels

Use the highest accuracy level available.

1. Exact provider usage
   - Best option.
   - Read the `usage` fields returned by the model provider for every model
     call.
   - Track input tokens, output tokens, cache read/write tokens, reasoning
     tokens, and tool-related tokens if the provider exposes them.

2. Exact payload tokenization
   - Use when provider usage is unavailable before the request is sent.
   - Reconstruct the exact request payload sent to the model.
   - Tokenize it with the exact tokenizer for the exact model.
   - This must include system messages, developer messages, user messages,
     assistant messages, tool definitions, tool results, attachments, and any
     serialized metadata that is part of the prompt.

3. Agent exploration estimate
   - Use when estimating future usage before the agent has acted.
   - Estimate prompt tokens, then estimate how much context the agent will need
     to collect because the prompt is vague, broad, or under-scoped.
   - This is necessarily probabilistic, but it can be made much better by
     modeling prompt quality and the likely amount of exploration.

4. Lightweight heuristic
   - Use only for instant offline feedback.
   - metriq currently uses a deterministic heuristic based on characters, words,
     and punctuation density. This is useful for relative guidance, not
     billing-grade accuracy.

## Exact Usage Tracking

For completed requests, do not estimate if actual usage is available. Add usage
from every model call:

```txt
total_input_tokens = sum(call.input_tokens)
total_output_tokens = sum(call.output_tokens)
total_tokens = total_input_tokens + total_output_tokens
```

If the provider separates token categories, preserve them instead of flattening
them too early:

```txt
total_tokens =
  input_tokens
  + output_tokens
  + cache_creation_tokens
  + cache_read_tokens
  + reasoning_tokens
  + tool_call_tokens
  + image_or_audio_tokens
```

Provider naming differs, so normalize into metriq's own internal shape:

```js
{
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  requestId: "provider-request-id",
  startedAt: "2026-07-07T20:00:00.000Z",
  endedAt: "2026-07-07T20:00:03.000Z",
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  reasoningTokens: 0,
  toolTokens: 0,
  totalTokens: 0
}
```

For agents, one user request can trigger many model calls. Store each call
separately, then aggregate at the session, task, and user-prompt level.

## Exact Preflight Counting

If estimating before a request is sent, count the exact model payload, not only
the visible prompt.

Include:

- System prompt.
- Developer instructions.
- User message.
- Prior conversation messages kept in context.
- Assistant messages kept in context.
- Tool/function schemas.
- Tool call arguments.
- Tool results returned to the model.
- Retrieved files, snippets, search output, logs, diagnostics, and terminal
  output.
- Attachments, images, audio, PDFs, or screenshots if the model accepts them.
- Any wrappers, role labels, XML tags, JSON serialization, or formatting added
  by the client.

Use the exact tokenizer for the exact model:

- OpenAI/GPT models: use the model's supported `tiktoken` encoding.
- Anthropic/Claude models: use Anthropic usage metadata or token counting API.
- Google/Gemini models: use Gemini `countTokens`.
- Local/Hugging Face models: use the exact tokenizer files for the deployed
  model revision.

Do not assume all providers tokenize the same text the same way. They do not.
The same prompt can have materially different token counts across models.

## Why Broad Prompts Waste Tokens

Broad prompts usually cost more because the agent has to build context before it
can safely act. The extra tokens are not in the user's original text; they are
spent during exploration.

Examples of exploration work:

- Searching the repo for possible files.
- Reading multiple candidate files.
- Inspecting tests, configs, routes, schemas, and call sites.
- Asking the model to reason across unrelated context.
- Running commands and feeding logs back into the model.
- Retrying after an incorrect assumption.
- Producing larger explanations because the target is unclear.

This means a short prompt can be expensive:

```txt
"Fix the dashboard"
```

The prompt itself is tiny, but the agent may need to inspect the whole app to
discover what "dashboard" and "fix" mean.

A scoped prompt is usually cheaper:

```txt
"In web/app/page.js, fix the broken compression chart label. Make the smallest
change necessary and do not refactor unrelated components."
```

This prompt is longer, but it points the agent at the likely file and prevents
unnecessary exploration.

## Estimating Exploration Tokens

When actual provider usage is unavailable, estimate:

```txt
projected_total_tokens =
  prompt_tokens
  + expected_context_tokens
  + expected_output_tokens
  + expected_retry_tokens
```

The hardest part is `expected_context_tokens`. Model it from prompt quality.

Useful signals that increase exploration cost:

- No file, path, route, command, function, class, or symbol reference.
- Vague verbs: "fix", "improve", "clean up", "optimize", "update", "polish".
- Broad nouns: "the app", "the site", "the codebase", "everything",
  "dashboard", "backend", "frontend".
- Large-change verbs: "refactor", "rewrite", "redesign", "migrate",
  "restructure", "modernize".
- Missing success criteria.
- Missing constraints.
- Multiple unrelated goals in one prompt.
- Long pasted context without saying which parts matter.
- Prior failed attempts or repeated prompts.

Useful signals that reduce exploration cost:

- A specific file path.
- A specific function, component, class, route, command, or test name.
- A clear observed behavior and expected behavior.
- A scope guard, such as "only touch this file" or "make the smallest change
  necessary".
- A command that reproduces the issue.
- Relevant error output or stack trace.
- A clear report-back format.

metriq already follows this principle in its analyzer: file references and
explicit scope guards reduce projected exploration because they bound how far an
agent needs to wander.

## Suggested Estimation Formula

Use a two-layer model:

```txt
prompt_tokens = exact_tokenizer(prompt)

exploration_multiplier =
  base
  + vague_intent_weight
  + broad_scope_weight
  + heavy_change_weight
  + missing_file_ref_weight
  + missing_constraint_weight
  + ambiguity_weight
  + repeated_attempt_weight

expected_context_tokens =
  repository_context_floor
  + repository_context_range * clamp(exploration_multiplier, 0, 1)

if has_file_or_symbol_reference:
  expected_context_tokens *= 0.45

if has_scope_guard:
  expected_context_tokens *= 0.60

projected_total_tokens =
  prompt_tokens
  + expected_context_tokens
  + expected_output_tokens
  + expected_retry_tokens
```

The exact weights should be calibrated against real telemetry. Start with
deterministic heuristics, then compare estimates against actual provider usage.

## Calibration Loop

To make estimates extremely accurate over time, collect actual usage and compare
it to predictions.

For every user prompt, store:

- Raw prompt.
- Detected prompt-quality signals.
- Prompt token estimate.
- Projected exploration tokens.
- Projected output tokens.
- Actual input tokens from every model call.
- Actual output tokens from every model call.
- Number of model calls.
- Number of tool calls.
- Files read.
- Search commands run.
- Terminal output returned to the model.
- Whether the prompt produced a retry or correction.

Then calculate:

```txt
prediction_error = actual_total_tokens - projected_total_tokens
error_ratio = actual_total_tokens / projected_total_tokens
```

Use this telemetry to tune the weights for each provider, model, repo size, and
task type.

Important: calibrate per environment. A small CLI repo, a large monorepo, and a
browser-based agent with screenshots will have very different token profiles.

## Agent-Level Attribution

Attribute tokens to the cause, not just the model call.

Recommended categories:

- `user_prompt`: the user's visible instruction.
- `system_context`: system and developer instructions.
- `conversation_history`: prior messages kept in context.
- `tool_schema`: function/tool definitions sent to the model.
- `repo_exploration`: file reads, search results, code snippets, diagnostics.
- `terminal_context`: command output and logs.
- `retrieval_context`: docs, embeddings, or search results.
- `assistant_output`: final answer and intermediate model-generated text.
- `retry_overhead`: repeated calls caused by ambiguity or errors.

This lets metriq explain not only "how many tokens were used", but why they were
used.

## What Not To Do

- Do not claim heuristic counts are exact.
- Do not count only the user's prompt for an agent workflow.
- Do not use one tokenizer for every model.
- Do not ignore tool schemas; they can be large.
- Do not ignore chat history; it often dominates input tokens.
- Do not ignore file reads and command output; they are the main cost driver for
  coding agents.
- Do not flatten provider-specific cache and reasoning token fields unless the
  UI only needs a simple total.

## Best Practical Strategy For metriq

Keep three modes:

1. Fast offline mode
   - Current heuristic.
   - No dependencies, no network, instant CLI feedback.
   - Best for prompt coaching and relative savings.

2. Precise tokenizer mode
   - Optional model-specific tokenizers or provider count APIs.
   - Counts the exact visible prompt and known context.
   - Good for preflight estimates.

3. Telemetry mode
   - Records actual provider usage for each model call.
   - Aggregates usage by prompt, session, and project.
   - Uses actual usage to calibrate future exploration estimates.

The most honest product language is:

```txt
Exact usage is available after the model call when the provider reports usage.
Before the call, metriq estimates likely usage by combining exact prompt
tokenization with a context-exploration model based on prompt scope, vagueness,
constraints, repo size, and previous agent behavior.
```

