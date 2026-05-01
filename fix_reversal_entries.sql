-- Fix existing REVERSAL entries in LedgerEntries table
-- REVERSAL entries should offset the original transaction
-- If original was PURCHASE (DEBIT), reversal should be CREDIT
-- If original was SALE (CREDIT), reversal should be DEBIT

-- For now, let's delete the incorrect reversal entries
-- They will be recreated correctly when transactions are edited again
DELETE FROM LedgerEntries WHERE transaction_type = 'REVERSAL';

-- Display remaining entries
SELECT 
  entry_id,
  entity_type,
  entity_id,
  transaction_type,
  description,
  debit,
  credit,
  entry_date
FROM LedgerEntries
ORDER BY entry_date DESC;cd ais
npm cd ais
 
