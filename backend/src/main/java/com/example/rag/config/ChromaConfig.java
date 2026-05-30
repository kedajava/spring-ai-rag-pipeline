package com.example.rag.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chroma.vectorstore.ChromaApi;
import org.springframework.ai.chroma.vectorstore.ChromaVectorStore;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class ChromaConfig {

    @Bean
    public ChromaApi chromaApi() {
        return new ChromaApi(
                "http://localhost:8001",  // Chroma URL
                RestClient.builder(),
                new ObjectMapper()        // required third param in 1.0.0
        );
    }

    @Bean
    public ChromaVectorStore vectorStore(ChromaApi chromaApi,
                                         EmbeddingModel embeddingModel) {
        return ChromaVectorStore.builder(chromaApi, embeddingModel)
                .collectionName("rag-collection")
                .initializeSchema(true)
                .build();
    }
}