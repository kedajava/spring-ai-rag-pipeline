package com.example.rag.evaluation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class RagEvaluator {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RagEvaluator(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    public record EvalResult(
            String question,
            String answer,
            double groundednessScore,  // 0.0 - 1.0
            boolean hallucinated,
            String reason
    ) {}

    public EvalResult evaluate(String question,
                               String context,
                               String answer) {
        String evalPrompt = """
                You are a strict RAG evaluator.
                Score this answer on groundedness.
                
                Rules:
                - 1.0 = every sentence directly from context
                - 0.7 = mostly grounded, minor synthesis
                - 0.5 = some sentences not in context
                - 0.0 = hallucination or fabricated facts
                
                Context:
                %s
                
                Question: %s
                
                Answer: %s
                
                Respond ONLY in valid JSON, no markdown:
                {"score": 0.9, "hallucinated": false, "reason": "All facts present in context"}
                """.formatted(context, question, answer);

        try {
            String raw = chatClient.prompt(evalPrompt)
                    .options(OpenAiChatOptions.builder()
                            .temperature(0.0).build())
                    .call()
                    .content();

            // Strip markdown fences if present
            String cleaned = raw
                    .replace("```json", "")
                    .replace("```", "")
                    .trim();

            JsonNode node = objectMapper.readTree(cleaned);

            return new EvalResult(
                    question,
                    answer,
                    node.get("score").asDouble(),
                    node.get("hallucinated").asBoolean(),
                    node.get("reason").asText()
            );
        } catch (Exception e) {
            return new EvalResult(question, answer, -1.0, false,
                    "Eval failed: " + e.getMessage());
        }
    }

    // Run a batch of test questions
    public List<EvalResult> runBenchmark(List<String> questions,
                                         String context) {
        return questions.stream()
                .map(q -> {
                    // This would call your RAG service in real usage
                    // Here simplified to show the pattern
                    return evaluate(q, context, "answer-from-rag");
                })
                .toList();
    }
}