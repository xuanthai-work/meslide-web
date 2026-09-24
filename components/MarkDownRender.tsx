"use client";

import React, { useState, useEffect } from "react";

import { marked } from "marked";
import { cn } from "@/lib/utils";
import { sanitizeMarkdownHtml } from "@/lib/sanitize-markdown-html";

interface MarkdownRendererProps {
    content?: string | null;
    className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
    const [markdownContent, setMarkdownContent] = useState<string>("");

    useEffect(() => {
        const safeContent = typeof content === "string" ? content : "";

        if (!safeContent) {
            setMarkdownContent("");
            return;
        }

        const parseMarkdown = async () => {
            try {
                const parsed = await marked.parse(safeContent);
                setMarkdownContent(sanitizeMarkdownHtml(String(parsed)));
            } catch (error) {
                console.error("Error parsing markdown:", error);
                setMarkdownContent("");
            }
        };

        parseMarkdown();
    }, [content]);

    return (
        <div
            className={cn("prose prose-slate max-w-none mb-10", className)}
            dangerouslySetInnerHTML={{ __html: markdownContent }}
        />
    );
};

export default MarkdownRenderer;
