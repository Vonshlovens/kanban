# Card Management

## Overview
Cards are the core unit of work. Each card represents a task, story, or work item that moves through the board's columns.

## Requirements

### Create Card
- User can create a card within any column
- Required fields: title
- Optional fields: description, due date, labels, assignee
- New cards are added to the top of the column by default

### Edit Card
- User can edit any field on a card
- Card opens in a detail view for editing
- Description supports rich text (bold, italic, lists, links)

### Delete Card
- User can delete a card
- Deletion requires confirmation
- Deleted cards cannot be recovered

### Move Card
- User can drag a card to a different position within the same column
- User can drag a card to a different column
- Card position and column persist across sessions
- Moving a card to a new column represents a workflow state change

### Card Detail View
- Clicking a card opens a detail view overlay
- Detail view displays all card fields
- User can edit fields inline from the detail view
- User can close the detail view to return to the board
