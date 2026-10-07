ALTER TABLE payments
ADD COLUMN cash_received_paisa INTEGER
CHECK (
    cash_received_paisa IS NULL
    OR cash_received_paisa >= 0
);

ALTER TABLE payments
ADD COLUMN change_paisa INTEGER
CHECK (
    change_paisa IS NULL
    OR change_paisa >= 0
);