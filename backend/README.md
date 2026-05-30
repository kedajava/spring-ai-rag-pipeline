# Backend — Spring AI RAG Pipeline

Spring Boot 3 backend powering the RAG pipeline. Handles PDF ingestion, vector storage, and three query modes (stream, precise, chat).

## Prerequisites

- Java 21+
- Maven (wrapper included)
- Chroma running on `localhost:8001` (see root `docker-compose.yml`)
- OpenAI API key

## Running

```bash
export OPENAI_API_KEY=sk-...
./mvnw spring-boot:run
```

Server starts on `http://localhost:8080`.

## Configuration

All config lives in `src/main/resources/application.yml`:

| Setting | Value | Description |
|---|---|---|
| `spring.ai.openai.chat.options.model` | `gpt-4o-mini` | LLM for answer generation, reranking, judging |
| `spring.ai.openai.chat.options.temperature` | `0.7` | Creativity for answer generation |
| `spring.ai.openai.embedding.options.model` | `text-embedding-3-small` | Embedding model |
| Chroma URL | `http://localhost:8001` | Set in `ChromaConfig.java` |
| Chroma collection | `rag-collection` | Set in `ChromaConfig.java` |

## Key Classes

| Class | Responsibility |
|---|---|
| `PdfService` | Parse PDF pages, chunk with `TokenTextSplitter` (800 tokens, 150 overlap) |
| `IndexService` | Add chunks to Chroma via `vectorStore.add()`, clear all via similarity hack |
| `RagService` | Stream (2 LLM calls), Precise (3 LLM calls), Chat (1 call + memory) |
| `RagEvaluator` | Score answer groundedness 0.0–1.0 |
| `RagMetrics` | Micrometer counters and timers exposed via `/actuator/metrics` |
| `ChromaConfig` | Wires `ChromaApi` and `ChromaVectorStore` beans |
| `AiConfig` | Wires `ChatClient` bean |

## Endpoints

```
POST   /upload                              Upload and index a PDF
DELETE /upload/clear                        Clear all Chroma documents
GET    /api/ai/stream?q=                    Stream answer (SSE)
GET    /api/ai/precise?q=                   Grounded answer (JSON)
GET    /api/ai/chat?q=&chatId=              Multi-turn chat (SSE)
DELETE /api/ai/chat/{chatId}                Clear chat session
GET    /api/ai/evaluate?q=&answer=&context= Score groundedness
```
