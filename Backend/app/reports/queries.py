"""Shared base for every report — design doc §4. All three reports read
only `journal_entry_line` joined to `journal_entry` and `chart_of_account`,
filtered to `status='POSTED'`. They never read documents or payments —
that's what keeps the ledger and the reports from ever disagreeing."""

POSTED_LINES_BASE = """
    FROM journal_entry_line jel
    JOIN journal_entry      je ON je.id = jel.journal_entry_id
    JOIN chart_of_account   a  ON a.id  = jel.account_id
    WHERE je.status = 'POSTED'
"""
