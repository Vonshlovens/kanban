# Search and Filter

## Overview
Users can locate and narrow down visible cards using search and filtering controls.

## Requirements

### Search
- User can search cards by title and description text
- Search is performed within the current board
- Results are highlighted or filtered in real-time as the user types
- Clearing the search restores the full board view

### Filter by Assignee
- User can filter cards to show only those assigned to a specific user
- "Unassigned" is a valid filter option

### Filter by Label
- User can filter cards by one or more labels
- Multiple label filters use OR logic

### Filter by Due Date
- User can filter cards by due date status: overdue, due today, due this week, no due date

### Combined Filters
- Multiple filter types can be active simultaneously (AND logic across types)
- Active filters are displayed clearly and can be individually cleared
- A "clear all filters" action resets the board to its unfiltered state
