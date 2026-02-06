USE pharmacy_db;

-- Insert sample users
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@pharmacy.com', 'hashed_password', 'admin'),
('John Doe', 'john@example.com', 'hashed_password', 'user');

-- Insert sample medicines
INSERT INTO medicines (name, price, stock, category) VALUES
('Paracetamol', 20.00, 100, 'Tablets'),
('Vitamin C', 150.00, 50, 'Tablets'),
('Cough Syrup', 120.00, 30, 'Syrups');

-- Insert sample orders
INSERT INTO orders (user_id, total_amount, status) VALUES
(2, 170.00, 'delivered'),
(2, 120.00, 'pending');