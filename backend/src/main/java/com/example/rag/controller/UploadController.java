package com.example.rag.controller;

import com.example.rag.metrics.RagMetrics;
import com.example.rag.service.IndexService;
import com.example.rag.service.PdfService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class UploadController {

    private final PdfService pdfService;
    private final IndexService indexService;
    private final RagMetrics ragMetrics;

    public UploadController(PdfService pdfService, IndexService indexService, RagMetrics ragMetrics) {
        this.pdfService = pdfService;
        this.indexService = indexService;
        this.ragMetrics = ragMetrics;
    }

    // React calls POST /upload — keep this mapping
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadPdf(
            @RequestParam("file") MultipartFile file) {
        try {
            int chunks = pdfService.processPdf(file);
            ragMetrics.recordUpload(chunks);
            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "filename", file.getOriginalFilename(),
                    "chunks", chunks,
                    "message", "PDF indexed successfully!"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "status", "error",
                    "message", e.getMessage()
            ));
        }
    }

    // Keep the /pdf path too for backward compatibility
    @PostMapping("/upload/pdf")
    public ResponseEntity<Map<String, Object>> uploadPdfAlt(
            @RequestParam("file") MultipartFile file) {
        return uploadPdf(file);
    }

    @DeleteMapping("/upload/clear")
    public ResponseEntity<Map<String, Object>> clear() {
        int deleted = indexService.clearAll();
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "deleted", deleted,
                "message", "Vector database cleared"
        ));
    }
}