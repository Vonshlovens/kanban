# Board Management

## Overview
Users can create, configure, and manage kanban boards as top-level containers for organizing work.

## Requirements

### Create Board
- User can create a new board with a name and optional description
- Board names must be non-empty and unique per user/workspace
- New boards start with default columns: "To Do", "In Progress", "Done"

### Edit Board
- User can rename a board
- User can update the board description
- Changes are reflected immediately for all viewers

### Delete Board
- User can delete a board they own
- Deletion requires confirmation
- Deleting a board removes all its columns and cards
- Deleted boards cannot be recovered

### Board Listing
- User can view all boards they have access to
- Boards display their name, description, and card count summary
- User can set a default/favorite board
