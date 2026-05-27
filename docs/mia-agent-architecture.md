# MIA Assistant Architecture - MiCuadre

This document describes the architectural design, security boundaries, and database model of MIA, the secure personal financial assistant in MiCuadre.

## Architectural Overview

MIA follows a secure, server-mediated agentic workflow. The model (Gemini 1.5 Flash) never interacts directly with the database or external services. Instead, it operates through a custom **Context Builder** and a **Structured Action Proposal** model.

```
                  +-----------------------------------+
                  |        Frontend (/coach-ia)       |
                  +-----------------+-----------------+
                                    |
                                    | Secure API POST
                                    v
                  +-----------------+-----------------+
                  |       API (/api/mia/chat)         |
                  +--------+-----------------+--------+
                           |                 |
     Queries & Aggregates  |                 | Structured Action Proposal
                           v                 v
                  +--------+-------+ +-------+--------+
                  |  Financial     | | Action         |
                  |  Insights      | | Confirmation   |
                  +--------+-------+ +-------+--------+
                           |                 |
                           v                 v
                  +--------+-----------------+--------+
                  |            Database               |
                  |   (Row Level Security Enabled)    |
                  +-----------------------------------+
```

---

## Data Model

All conversation histories and state parameters are stored in user-scoped PostgreSQL tables. Row-Level Security (RLS) is strictly enforced on all tables, bound to the authenticated user's ID (`auth.uid() = user_id`).

### `mia_conversations`
Represents a chat session.
- `id` UUID PRIMARY KEY DEFAULT `uuid_generate_v4()`
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE
- `title` TEXT (auto-generated or custom title)
- `created_at` TIMESTAMPTZ (defaults to NOW)
- `updated_at` TIMESTAMPTZ (defaults to NOW)

### `mia_messages`
Stores individual chat messages in a conversation.
- `id` UUID PRIMARY KEY DEFAULT `uuid_generate_v4()`
- `conversation_id` UUID NOT NULL REFERENCES `public.mia_conversations(id)` ON DELETE CASCADE
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE
- `role` TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool'))
- `content` TEXT NOT NULL
- `metadata` JSONB NOT NULL DEFAULT '{}'::jsonb (stores frontend-specific structures like `uiBlocks` or `actions`)
- `created_at` TIMESTAMPTZ (defaults to NOW)

### `mia_tool_calls`
Audit trail of actions proposed by MIA and confirmed by the user.
- `id` UUID PRIMARY KEY DEFAULT `uuid_generate_v4()`
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE
- `conversation_id` UUID NOT NULL REFERENCES `public.mia_conversations(id)` ON DELETE CASCADE
- `tool_name` TEXT NOT NULL
- `arguments` JSONB NOT NULL DEFAULT '{}'::jsonb
- `result` JSONB NOT NULL DEFAULT '{}'::jsonb
- `status` TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled'))
- `created_at` TIMESTAMPTZ (defaults to NOW)

### `mia_memory`
Stores key-value preferences per user to tailor conversations.
- `id` UUID PRIMARY KEY DEFAULT `uuid_generate_v4()`
- `user_id` UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE
- `key` TEXT NOT NULL
- `value` JSONB NOT NULL DEFAULT '{}'::jsonb
- `created_at` TIMESTAMPTZ (defaults to NOW)
- `updated_at` TIMESTAMPTZ (defaults to NOW)
- UNIQUE(`user_id`, `key`)

---

## Security Boundaries & Guardrails

### 1. Row Level Security (RLS)
Every query to the MIA database tables is isolated to the authenticated user:
```sql
CREATE POLICY "mia_messages_select_own" ON public.mia_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
```
No user can ever query or modify messages belonging to another user.

### 2. Domain Restriction
MIA is strictly configured to refuse out-of-domain requests (e.g. recipes, general coding, political opinions) using a hardcoded guardrail system prompt and a structured response model. If a request is out of domain, MIA returns:
```json
{
  "type": "refusal",
  "message": "Solo puedo ayudarte con tus finanzas dentro de MiCuadre: cuentas, gastos, metas, tarjetas, suscripciones, reportes y planificación financiera.",
  "action": null
}
```

### 3. Separation of Concerns for Write Actions
MIA **cannot** directly modify user assets or transactions. Write operations require explicit user confirmation.
- **Phase 1 (Proposal):** User asks MIA to record an expense. MIA responds with `type: "action_proposal"`. The backend formats this into a client-safe draft block.
- **Phase 2 (Confirmation):** The frontend renders a confirmation card. When the user clicks "Confirm", a POST request is sent to the backend to execute the mutation. Only at this point is the transaction created and the account balance modified.

---

## Tools Architecture

### Read-Only Tools (Automatic Context Injection)
MIA gets a pre-built snapshot of the user's financial status to avoid expensive round-trips and prevent the model from hallucinating numbers:
- `get_financial_summary` -> monthly income/expense and savings rate.
- `get_spending_by_category` -> breakdown of current month's expenses.
- `get_recurring_expenses` -> active recurring subscriptions.
- `get_credit_card_status` -> statement balances and payment dates.
- `get_goals_status` -> active goals progress.
- `get_account_balances` -> current cash and debit assets.

### Write Tools (Require Confirmation Flow)
- `create_transaction` -> Creates an income or expense transaction and updates the account balance.
- `create_goal` -> Configures a new savings goal.
- `create_subscription` -> Adds a recurring service subscription.
- `add_money_to_goal` -> Contributes cash/debit balance to a savings goal.

---

## Setup & Configuration

To enable MIA, verify that the following environment variables are set in `.env.local` or production settings:
- `GEMINI_API_KEY`: API key from Google AI Studio.
- `GEMINI_MODEL`: Model name (defaults to `gemini-1.5-flash`).
- `COACH_IA_ALLOWED_EMAILS`: Comma-separated list of emails whitelisted for testing/development. Pro plan users bypass this whitelist and have automatic access.
- `NEXT_PUBLIC_COACH_IA_ALLOWED_EMAILS`: Client-accessible copy of the whitelist (optional, for client-side visibility checks).
