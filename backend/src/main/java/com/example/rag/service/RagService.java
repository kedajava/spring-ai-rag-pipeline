package com.example.rag.service;

import com.example.rag.metrics.RagMetrics;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.document.Document;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class RagService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;
    private final RagMetrics ragMetrics;

    // Remove Message import from james.mime4j — use Spring AI's Message types
    private final ConcurrentHashMap<String, List<org.springframework.ai.chat.messages.Message>>
            chatHistory = new ConcurrentHashMap<>();

    public RagService(ChatClient.Builder builder,
                      VectorStore vectorStore,
                      RagMetrics ragMetrics) {
        this.chatClient = builder.build();
        this.vectorStore = vectorStore;
        this.ragMetrics = ragMetrics;
    }

    // ── ENDPOINT 1: stream ──────────────────────────────────────
    public Flux<String> streamWithReranker(String question) {
        Instant start = Instant.now();

        List<Document> candidates = vectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(question)
                        .topK(10)
                        .build()
        );

        List<Document> bestDocs = rerankDocuments(question, candidates);

        String context = bestDocs.stream()
                .map(doc -> cleanText(doc.getText()))
                .collect(Collectors.joining("\n\n"));

        return chatClient.prompt()
                .system("You are a precise assistant. Use ONLY the context to answer.")
                .user("Context:\n" + context + "\n\nQuestion: " + question)
                .stream()
                .content()
                .doOnComplete(() ->
                        ragMetrics.recordStreamQuery(
                                Duration.between(start, Instant.now())
                        )
                );
    }

    // ── ENDPOINT 2: precise ────────────────────────────────────
    public String askWithJudge(String question) {
        Instant start = Instant.now();

        List<Document> candidates = vectorStore.similaritySearch(
                SearchRequest.builder().query(question).topK(10).build()
        );
        List<Document> bestDocs = rerankDocuments(question, candidates);

        String context = bestDocs.stream()
                .map(doc -> cleanText(doc.getText()))
                .collect(Collectors.joining("\n\n"));

        String draftAnswer = chatClient.prompt()
                .user("Context:\n" + context + "\n\nQuestion: " + question)
                .call().content();

        String finalAnswer = performJudgeStep(question, context, draftAnswer);

        // Record AFTER judge completes — captures full precise latency
        ragMetrics.recordPreciseQuery(Duration.between(start, Instant.now()));

        return finalAnswer;
    }

    // ── ENDPOINT 3: chat with memory ───────────────────────────
    public Flux<String> streamWithMemory(String question, String chatId) {
        Instant start = Instant.now();

        List<org.springframework.ai.chat.messages.Message> history =
                chatHistory.computeIfAbsent(chatId, k -> new java.util.ArrayList<>());

        // Retrieve context from vector store
        List<Document> docs = vectorStore.similaritySearch(
                SearchRequest.builder().query(question).topK(5).build()
        );

        String context = docs.stream()
                .map(Document::getText)
                .collect(Collectors.joining("\n\n"));

        String systemContent = """
                You are a precise assistant.
                Answer using ONLY the context below.
                If the answer is not in the context, say "I don't have that information."
                
                Context:
                %s
                """.formatted(context);

        // Build full message list: system + history + new question
        List<org.springframework.ai.chat.messages.Message> messages = new java.util.ArrayList<>();
        messages.add(new org.springframework.ai.chat.messages.SystemMessage(systemContent));
        messages.addAll(history);
        messages.add(new UserMessage(question));

        StringBuilder buffer = new StringBuilder();

        return chatClient.prompt()
                .messages(messages)
                .stream()
                .content()
                .doOnNext(buffer::append)
                .doOnComplete(() -> {
                    // Save turn to history
                    history.add(new UserMessage(question));
                    history.add(new AssistantMessage(buffer.toString()));

                    // Trim to last 10 turns (20 messages)
                    while (history.size() > 20) {
                        history.remove(0);
                        history.remove(0);
                    }
                    chatHistory.put(chatId, history);
                    ragMetrics.recordStreamQuery(Duration.between(start, Instant.now()));
                });
    }

    public void clearSession(String chatId) {
        chatHistory.remove(chatId);
    }

    // ── Private helpers ────────────────────────────────────────
    private String performJudgeStep(String question, String context, String answer) {
        String judgePrompt = """
        You are a strict factual auditor. Your ONLY job is to verify accuracy.

        RULES — follow exactly:
        1. Compare the answer to the context word by word
        2. Remove ANY sentence not directly supported by the context
        3. Do NOT add new sentences, summaries, or conclusions
        4. Do NOT rephrase to sound more complete
        5. If a sentence is partially supported, remove the unsupported part only
        6. Return only what is fully grounded in the context below

        Context:
        %s

        Question: %s

        Answer to audit:
        %s

        Audited answer (only grounded content, nothing added):
        """.formatted(context, question, answer);

        return chatClient.prompt(judgePrompt)
                .options(OpenAiChatOptions.builder().temperature(0.0).build())
                .call().content();
    }

    private List<Document> rerankDocuments(String question, List<Document> candidates) {
        if (candidates.isEmpty()) return List.of();

        String snippets = IntStream.range(0, candidates.size())
                .mapToObj(i -> i + ": " + cleanText(candidates.get(i).getText()))
                .collect(Collectors.joining("\n---\n"));

        String rerankPrompt = """
            You are a relevance ranking system.
            Question: %s
            Select the 3 most relevant snippets for answering the question.
            Return ONLY the indices as comma-separated values (example: 0,2,5).
            Snippets:
            %s
            """.formatted(question, snippets);

        String response = chatClient.prompt(rerankPrompt)
                .options(OpenAiChatOptions.builder().temperature(0.0).build())
                .call().content();

        List<Integer> selectedIndexes = java.util.regex.Pattern.compile("\\d+")
                .matcher(Objects.requireNonNullElse(response, ""))
                .results()
                .map(m -> Integer.parseInt(m.group()))
                .filter(i -> i >= 0 && i < candidates.size())
                .limit(3)
                .toList();

        return selectedIndexes.isEmpty()
                ? candidates.stream().limit(3).toList()
                : selectedIndexes.stream().map(candidates::get).toList();
    }

    private String cleanText(String text) {
        if (text == null) return "";
        String fixed = text.replaceAll("(?<=\\b\\p{L}) (?=\\p{L}\\b)", "");
        return fixed.replaceAll("\\s{2,}", " ").trim();
    }
}