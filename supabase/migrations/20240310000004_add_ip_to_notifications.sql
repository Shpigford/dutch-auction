-- Add IP address column to email_notifications table
ALTER TABLE email_notifications ADD COLUMN ip_address TEXT NOT NULL DEFAULT 'unknown';

-- Create an index on ip_address for faster queries
CREATE INDEX email_notifications_ip_address_idx ON email_notifications(ip_address); 