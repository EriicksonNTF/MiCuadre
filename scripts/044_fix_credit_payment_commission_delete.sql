-- Fix delete_transaction_safe and undelete_transaction_safe
-- to handle commission children in the credit payment case.
-- Commissions for credit card payments were orphaned during delete/undo
-- because they lacked parent_transaction_id and the credit payment handler
-- returned before reaching the generic commission-handling code.

-- See 042_edit_delete_v2.sql for the original function definitions.
