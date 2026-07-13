CREATE TABLE IF NOT EXISTS point_stats (
    point_stats_id INT AUTO_INCREMENT PRIMARY KEY,
    provider_name VARCHAR(50), 
    point_id VARCHAR(50),      -- Το κάναμε VARCHAR για να ταιριάζει με το string του API
    event_type VARCHAR(20),  
    is_success BOOLEAN,      
    point_status VARCHAR(20),  
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);