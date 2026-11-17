CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('mahasiswa','dosen','tenant') NOT NULL,
  login_id VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  name VARCHAR(120) NOT NULL,
  prodi VARCHAR(80), semester INT, angkatan INT,
  title VARCHAR(120), email VARCHAR(120),
  headline VARCHAR(160), about TEXT,
  collaboration ENUM('open','closed') DEFAULT 'open',
  photo_url VARCHAR(255),
  skills JSON, interests JSON, expertise JSON, courses JSON, publications JSON,
  competitions JSON, projects JSON, certifications JSON,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  last_seen DATETIME NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL, receiver_id INT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  INDEX idx_msg_pair (sender_id, receiver_id, id),
  INDEX idx_msg_unread (receiver_id, read_at),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, title VARCHAR(100) NOT NULL, course VARCHAR(60) DEFAULT 'Umum',
  due_date DATE NULL, is_done TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL, category VARCHAR(40) NOT NULL, location VARCHAR(100),
  description TEXT, image_url VARCHAR(255), is_open TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(255),
  price INT NOT NULL, image_url VARCHAR(255), available TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL, tenant_id INT NOT NULL,
  pickup_time VARCHAR(30) NOT NULL, note VARCHAR(100), total INT NOT NULL,
  status ENUM('reserved','preparing','ready','done','cancelled') NOT NULL DEFAULT 'reserved',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_tenant_status (tenant_id, status),
  INDEX idx_orders_user (user_id, id),
  FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL, menu_id INT NOT NULL, name VARCHAR(100) NOT NULL, price INT NOT NULL, qty INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_id INT NOT NULL, title VARCHAR(120) NOT NULL, organizer VARCHAR(120),
  deadline DATE NULL, description TEXT, roles JSON, skills JSON,
  closed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INT NOT NULL, user_id INT NOT NULL, PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_applicants (
  team_id INT NOT NULL, user_id INT NOT NULL, PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);