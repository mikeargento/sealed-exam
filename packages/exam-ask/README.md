# @mikeargento/exam-ask

Asks a model the twenty questions of a sealed paper, one request per question, with the caller's own key from the environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`). Every request and reply is kept verbatim; the answer sheet names each raw file by digest. A rate limit is waited out and asked again; any other refusal is the model's answer and is recorded as one.

Used by `@mikeargento/exam-cli`. Nothing here is needed to verify a sitting.
