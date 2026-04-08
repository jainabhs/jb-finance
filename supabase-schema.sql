-- borrowers table
CREATE TABLE IF NOT EXISTS borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    full_name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    address TEXT,
    notes TEXT
);

-- loans table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    borrower_id UUID NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
    principal_amount NUMERIC NOT NULL,
    interest_rate_monthly NUMERIC NOT NULL, -- e.g., 2 for 2% per month
    start_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'defaulted')),
    compound_unpaid_interest BOOLEAN NOT NULL DEFAULT true, -- If true, applies the 12-month compounding rule
    compound_threshold_months INTEGER NOT NULL DEFAULT 12,
    notes TEXT
);

-- collateral items (Gold, Property docs, etc.)
CREATE TABLE IF NOT EXISTS collateral_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- e.g., 'Gold', 'Property', 'Other'
    alphanumeric_code TEXT NOT NULL UNIQUE,
    description TEXT,
    estimated_value NUMERIC
);

-- payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    interest_covered NUMERIC NOT NULL DEFAULT 0,
    principal_covered NUMERIC NOT NULL DEFAULT 0,
    notes TEXT
);

-- applied interest (when committed from draft)
CREATE TABLE IF NOT EXISTS applied_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    interest_amount NUMERIC NOT NULL,
    is_capitalized BOOLEAN NOT NULL DEFAULT false, -- True if this amount was added to the principal
    notes TEXT
);

-- Add updated_at trigger for tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_borrowers_updated_at BEFORE UPDATE ON borrowers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (RLS) configuration
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE collateral_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_interests ENABLE ROW LEVEL SECURITY;

-- If using authenticated sessions:
CREATE POLICY "Enable all operations for authenticated users" ON borrowers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for authenticated users" ON loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for authenticated users" ON collateral_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for authenticated users" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for authenticated users" ON applied_interests FOR ALL TO authenticated USING (true) WITH CHECK (true);
