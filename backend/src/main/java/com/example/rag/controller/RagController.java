package com.example.rag.controller;

import com.example.rag.evaluation.RagEvaluator;
import com.example.rag.service.RagService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class RagController {

    private final RagService ragService;
    private final RagEvaluator ragEvaluator;

    public RagController(RagService ragService, RagEvaluator ragEvaluator) {
        this.ragService = ragService;
        this.ragEvaluator = ragEvaluator;
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> streamWithReranker(@RequestParam String q) {
        return ragService.streamWithReranker(q);
    }

    @GetMapping("/precise")
    public String askWithJudge(@RequestParam String q) {
        return ragService.askWithJudge(q);
    }

    @GetMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(
            @RequestParam String q,
            @RequestParam(defaultValue = "default") String chatId) {
        return ragService.streamWithMemory(q, chatId);
    }

    @DeleteMapping("/chat/{chatId}")
    public String clearSession(@PathVariable String chatId) {
        ragService.clearSession(chatId);
        return "Session cleared: " + chatId;
    }

    @GetMapping("/evaluate")
    public Map<String, Object> evaluate(
            @RequestParam String q,
            @RequestParam String answer,
            @RequestParam String context) {

        RagEvaluator.EvalResult result =
                ragEvaluator.evaluate(q, context, answer);

        return Map.of(
                "question", result.question(),
                "score", result.groundednessScore(),
                "hallucinated", result.hallucinated(),
                "reason", result.reason(),
                "grade", result.groundednessScore() >= 0.8 ? "PASS" : "FAIL"
        );
    }
}