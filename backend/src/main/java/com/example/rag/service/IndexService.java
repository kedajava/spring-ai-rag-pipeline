package com.example.rag.service;

import org.springframework.ai.chroma.vectorstore.ChromaVectorStore;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class IndexService {

    private final VectorStore vectorStore;

    public IndexService(VectorStore vectorStore) {
        this.vectorStore = vectorStore;
    }

    public void indexDocuments(List<Document> documents) {
        vectorStore.add(documents);
        System.out.println("Indexed " + documents.size() + " chunks");
    }

    public int clearAll() {
        try {
            // More reliable: use multiple broad queries and collect all unique IDs
            // Chroma doesn't support "get all" directly via Spring AI
            // so we use a very low threshold with generic terms
            List<String> queries = List.of("the", "a", "and", "is", "of");
            java.util.Set<String> allIds = new java.util.HashSet<>();

            for (String q : queries) {
                List<Document> docs = vectorStore.similaritySearch(
                        SearchRequest.builder()
                                .query(q)
                                .topK(10000)
                                .similarityThreshold(0.0)
                                .build()
                );
                docs.stream().map(Document::getId).forEach(allIds::add);
            }

            if (!allIds.isEmpty()) {
                vectorStore.delete(allIds.stream().toList());
                System.out.println("Cleared " + allIds.size() + " documents");
                return allIds.size();
            }
            return 0;
        } catch (Exception e) {
            System.err.println("Error clearing: " + e.getMessage());
            throw new RuntimeException("Failed to clear vector store", e);
        }
    }
}