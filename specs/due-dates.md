# Due Dates

## Overview
Cards can have due dates to track deadlines and surface time-sensitive work.

## Requirements

### Set Due Date
- User can set a due date on any card
- Date is selected via a date picker
- Due date is optional

### Edit Due Date
- User can change or remove a due date

### Visual Indicators
- Cards with due dates display the date on the card in the board view
- Visual urgency states:
  - **Overdue**: distinct warning style (e.g., red) for cards past their due date
  - **Due soon**: subtle alert style (e.g., yellow/amber) for cards due within 24 hours
  - **Upcoming**: neutral style for cards with future due dates
  - **Complete**: if a card is in a "done" column, the due date indicator reflects completion regardless of date

### Sorting
- Within a column, user can optionally sort cards by due date
