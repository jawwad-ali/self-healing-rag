-- Phase 2: doc-change detector needs INSERT ... ON CONFLICT (source) DO UPDATE.
-- Add UNIQUE constraint on rag.documents.source. Idempotent via DO block.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'documents_source_unique'
    ) THEN
        ALTER TABLE rag.documents
            ADD CONSTRAINT documents_source_unique UNIQUE (source);
    END IF;
END $$;
