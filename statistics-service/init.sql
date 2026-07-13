CREATE TABLE IF NOT EXISTS GlobalStats (
    stats_id INT PRIMARY KEY,
    metric_name VARCHAR(50)  UNIQUE,
    metric_value INT NOT NULL DEFAULT 0
);

-- Event log για ΟΛΑ τα services
CREATE TABLE IF NOT EXISTS GlobalEvents (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    provider_name VARCHAR(100) DEFAULT NULL,
    point_id VARCHAR(100) DEFAULT NULL,
    user_id VARCHAR(100) DEFAULT NULL,
    details JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_provider (provider_name),
    INDEX idx_created_at (created_at)
);

-- Εισαγωγή των αρχικών δεδομένων (Seed Data)
INSERT IGNORE INTO GlobalStats (metric_name, metric_value) VALUES 
('total_reservations', 0),
('total_cancellations', 0),
('total_searches', 0),
('total_registrations', 0),
('total_clicks', 0),
('active_providers', 0);