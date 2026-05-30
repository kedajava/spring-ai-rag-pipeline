package com.example.rag.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.document.Document;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ChatMemoryService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;

    // sessionId → conversation history
    private final Map<String, List<Message>> sessions = new ConcurrentHashMap<>();

    // Max messages to keep per session (prevents token overflow)
    private static final int MAX_HISTORY = 10;

    public ChatMemoryService(ChatClient.Builder builder, VectorStore vectorStore) {
        this.chatClient = builder.build();
        this.vectorStore = vectorStore;
    }

    public Flux<String> streamWithMemory(String question, String sessionId) {
        // 1. Get or create session history
        List<Message> history = sessions.computeIfAbsent(
                sessionId, k -> new ArrayList<>()
        );

        // 2. Retrieve relevant docs from vector store
        List<Document> docs = vectorStore.similaritySearch(
                SearchRequest.builder()
                        .query(question)
                        .topK(5)
                        .build()
        );

        String context = docs.stream()
                .map(Document::getText)
                .collect(Collectors.joining("\n\n"));

        // 3. Build system message with context
        String systemContent = """
                You are a precise assistant.
                Answer using ONLY the context below.
                If the answer is not in the context, say so.
                
                Context:
                %s
                """.formatted(context);

        // 4. Build full message list: system + history + new question
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(systemContent));
        messages.addAll(history); // previous turns
        messages.add(new UserMessage(question));

        // 5. Stream the response
        StringBuilder responseBuffer = new StringBuilder();

        return chatClient.prompt()
                .messages(messages)
                .stream()
                .content()
                .doOnNext(responseBuffer::append)
                .doOnComplete(() -> {
                    // 6. Save this turn to history after completion
                    history.add(new UserMessage(question));
                    history.add(new AssistantMessage(responseBuffer.toString()));

                    // 7. Trim history to prevent token overflow
                    while (history.size() > MAX_HISTORY * 2) {
                        history.remove(0); // remove oldest user message
                        history.remove(0); // remove oldest assistant message
                    }

                    sessions.put(sessionId, history);
                    System.out.println("Session " + sessionId
                            + " history size: " + history.size());
                });
    }

    public void clearSession(String sessionId) {
        sessions.remove(sessionId);
        System.out.println("Cleared session: " + sessionId);
    }

    public int getSessionCount() {
        return sessions.size();
    }
}