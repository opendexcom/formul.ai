CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION CURRENT_USER;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.user_roles (
    id UUID PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Insert default roles if not exists
INSERT INTO auth.user_roles (id, name)
SELECT gen_random_uuid(), 'ROLE_AUTHOR'
WHERE NOT EXISTS (SELECT 1 FROM auth.user_roles WHERE name = 'ROLE_AUTHOR');

INSERT INTO auth.user_roles (id, name)
SELECT gen_random_uuid(), 'ROLE_PUBLIC'
WHERE NOT EXISTS (SELECT 1 FROM auth.user_roles WHERE name = 'ROLE_PUBLIC');

CREATE TABLE IF NOT EXISTS auth.user_user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES auth.user_roles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_user_roles_user_id ON auth.user_user_roles(user_id);
