# Column Management

## Overview
Columns represent workflow stages within a board. Cards move through columns to reflect progress.

## Requirements

### Create Column
- User can add new columns to a board
- Columns require a name
- New columns are appended to the end of the board by default

### Edit Column
- User can rename a column
- Name changes are reflected immediately

### Delete Column
- User can delete a column
- If the column contains cards, user must choose to either move them to another column or delete them
- Deletion requires confirmation

### Reorder Columns
- User can drag columns to reorder them within a board
- Column order persists across sessions

### Work-in-Progress (WIP) Limits
- User can set a maximum card count per column
- When a column reaches its WIP limit, a visual indicator is shown
- WIP limits are advisory — users can still add cards beyond the limit, but the column is flagged
