ALTER TABLE users
ADD COLUMN access_role TEXT NOT NULL
DEFAULT 'cashier'
CHECK (
    access_role IN (
        'admin',
        'supervisor',
        'salesperson',
        'cashier'
    )
);

UPDATE users
SET access_role =
    CASE
        WHEN role = 'admin'
            THEN 'admin'
        ELSE 'cashier'
    END;


ALTER TABLE exchanges
ADD COLUMN approved_by INTEGER
REFERENCES users(id);