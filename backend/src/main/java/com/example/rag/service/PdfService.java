package com.example.rag.service;

import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.reader.pdf.config.PdfDocumentReaderConfig;
import org.springframework.ai.document.Document;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PdfService {

    private final IndexService indexService;

    public PdfService(IndexService indexService) {
        this.indexService = indexService;
    }

    public int processPdf(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename() != null
                    ? file.getOriginalFilename()
                    : "unknown.pdf";

            // 1. Read PDF keeping page metadata
            ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return originalFilename; // critical — gives file_name in metadata
                }
            };

            PdfDocumentReaderConfig config = PdfDocumentReaderConfig.builder()
                    .withPageTopMargin(0)
                    .withPageBottomMargin(0)
                    .withPagesPerDocument(1) // one Document per page
                    .build();

            PagePdfDocumentReader reader = new PagePdfDocumentReader(resource, config);
            List<Document> pages = reader.get();

            // 2. Enrich metadata on each page with filename + timestamp
            pages.forEach(doc -> {
                doc.getMetadata().put("file_name", originalFilename);
                doc.getMetadata().put("ingested_at", LocalDateTime.now().toString());
                // page_number is already added by PagePdfDocumentReader
            });

            // 3. Chunk into smaller pieces for better retrieval
            TokenTextSplitter splitter = new TokenTextSplitter(
                    800,   // chunk size in tokens
                    150,   // overlap between chunks
                    5,     // min chunk size
                    10000, // max chunk size
                    true   // keep separator
            );
            List<Document> chunks = splitter.apply(pages);

            // 4. Index into Chroma
            indexService.indexDocuments(chunks);

            System.out.println("Ingested: " + originalFilename
                    + " → " + pages.size() + " pages → "
                    + chunks.size() + " chunks");

            return chunks.size();

        } catch (IOException e) {
            throw new RuntimeException("Failed to process PDF: " + e.getMessage(), e);
        }
    }
}