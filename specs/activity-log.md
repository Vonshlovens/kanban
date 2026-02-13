# Activity Log

## Overview
An audit trail of actions taken on cards and the board, providing history and context.

## Requirements

### Card Activity
- Each card tracks a chronological log of events:
  - Card created
  - Card moved between columns
  - Fields changed (title, description, due date, labels, assignee)
  - Comments added
- Each entry records the acting user and timestamp

### Board Activity
- Board-level activity feed showing recent actions across all cards
- Activities include card creation, movement, and deletion

### Display
- Card activity is visible in the card detail view
- Board-level activity is accessible from a board menu or sidebar
- Activity entries are displayed in reverse chronological order
