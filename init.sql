CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Master data
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

INSERT INTO categories (name) VALUES
    ('ใบเสร็จ/ใบกำกับภาษี'),
    ('สัญญาจ้าง'),
    ('ใบสั่งซื้อ (PO)'),
    ('เอกสารทั่วไป'),
    ('หนังสือราชการ / เอกสารทางการ')
ON CONFLICT (name) DO NOTHING;

INSERT INTO departments (name) VALUES
    ('บัญชี/การเงิน'),
    ('ฝ่ายบุคคล (HR)'),
    ('ฝ่ายไอที (IT)'),
    ('ฝ่ายจัดซื้อ'),
    ('สำนักบริหาร')
ON CONFLICT (name) DO NOTHING;

INSERT INTO branches (name) VALUES
    ('สำนักงานใหญ่ (HQ)'),
    ('สาขารังสิต'),
    ('สาขาพระราม 9'),
    ('สาขาเชียงใหม่')
ON CONFLICT (name) DO NOTHING;

-- Users are created through the configured OAuth provider or by an administrator.
-- Do not seed predictable default passwords in UAT.
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'USER')),
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    document_date DATE DEFAULT CURRENT_DATE,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
    tags VARCHAR(255) DEFAULT '',
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64),
    mime_type VARCHAR(100) NOT NULL,
    storage_bucket VARCHAR(100) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    current_version INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'PROCESSING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    view_count INT DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    uploader_username VARCHAR(100),
    allowed_department_ids INT[] DEFAULT '{}',
    allowed_user_ids INT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_document_code ON documents(document_code);

CREATE TABLE IF NOT EXISTS document_versions (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_hash VARCHAR(64),
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, version)
);

CREATE TABLE IF NOT EXISTS document_extractions (
    id SERIAL PRIMARY KEY,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    raw_text TEXT,
    extracted_json JSONB DEFAULT '{}'::jsonb,
    structured_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    document_id UUID,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
