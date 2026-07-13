CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    provider_name VARCHAR(50) NOT NULL,
    billing_month INT NOT NULL,
    billing_year INT NOT NULL,
    total_points INT NOT NULL,
    price_per_point DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- Μπορεί να είναι PENDING, PAID, CANCELLED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);