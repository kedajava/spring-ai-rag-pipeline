package com.example.rag.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class RagMetrics {

    private final Counter queryCounter;
    private final Counter streamCounter;
    private final Counter preciseCounter;
    private final Counter uploadCounter;
    private final Counter chunkCounter;
    private final Timer streamTimer;
    private final Timer preciseTimer;
    private final AtomicLong estimatedCostMicros = new AtomicLong(0);

    public RagMetrics(MeterRegistry registry) {
        this.queryCounter = Counter.builder("rag.queries.total")
                .description("Total RAG queries")
                .register(registry);

        this.streamCounter = Counter.builder("rag.queries.stream")
                .description("Stream endpoint queries")
                .register(registry);

        this.preciseCounter = Counter.builder("rag.queries.precise")
                .description("Precise endpoint queries")
                .register(registry);

        this.uploadCounter = Counter.builder("rag.uploads.total")
                .description("Total PDF uploads")
                .register(registry);

        this.chunkCounter = Counter.builder("rag.chunks.indexed")
                .description("Total chunks indexed")
                .register(registry);

        this.streamTimer = Timer.builder("rag.latency.stream")
                .description("Stream endpoint latency")
                .register(registry);

        this.preciseTimer = Timer.builder("rag.latency.precise")
                .description("Precise endpoint latency")
                .register(registry);
    }

    public void recordStreamQuery(Duration latency) {
        queryCounter.increment();
        streamCounter.increment();
        streamTimer.record(latency);
    }

    public void recordPreciseQuery(Duration latency) {
        queryCounter.increment();
        preciseCounter.increment();
        preciseTimer.record(latency);
    }

    public void recordUpload(int chunks) {
        uploadCounter.increment();
        chunkCounter.increment(chunks);
    }

    // GPT-4o-mini pricing: $0.15/1M input, $0.60/1M output tokens
    public void recordTokenUsage(int inputTokens, int outputTokens) {
        double cost = (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
        estimatedCostMicros.addAndGet((long)(cost * 1_000_000));
    }
}