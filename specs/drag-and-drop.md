# Drag and Drop

## Overview
Drag and drop is the primary interaction model for moving cards and reordering columns on the board.

## Requirements

### Card Dragging
- User can pick up a card by clicking/touching and holding
- A visual preview of the card follows the cursor during drag
- Drop targets (columns and positions between cards) are clearly highlighted
- Dropping a card in a valid target moves it to that position
- Dropping a card outside a valid target returns it to its original position

### Column Dragging
- User can drag columns to reorder them
- Column dragging uses the column header as the grab handle
- Other columns shift to indicate the drop position

### Visual Feedback
- The dragged item has a distinct visual state (e.g., slight rotation, shadow, reduced opacity at origin)
- Valid drop zones are highlighted on hover
- Smooth animation accompanies card/column repositioning

### Accessibility
- Keyboard-based alternative for drag and drop (e.g., select card, use arrow keys or a "move to" action)
- Screen reader announcements for drag start, position changes, and drop completion
