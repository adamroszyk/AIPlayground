# Demo video scripts (about 2 minutes each)

Record in ChatGPT with the plugin enabled (developer mode before approval). Show the prompt, the tool call, the result, the widget, and the web editor. Say plainly what the plugin does not do. Reviewers need to see each claim made in the listing.

## Roomwise

1. **Plan.** Prompt: *Plan a 14 by 12 foot living room with a sofa, a coffee table and a TV unit. The door is on the south wall 8 feet from the west corner and there is a window on the north wall.* Show `plan_room_layout` being called and the widget: to-scale plan, "7 of 7 checks passed".
2. **Open on the web.** Click the edit link. Drag the armchair into the doorway: the failing rule turns red with the measured value. Press Plan layout: back to all passing.
3. **Check.** Prompt: *Check my living room layout: the sofa is 6 inches from the coffee table...* Show the failing sofa-to-coffee-table check and its measured gap.
4. **Materials.** Prompt: *How much flooring and paint do I need for a 14 by 12 foot room with 8 foot ceilings?* Show quantities and assumptions.
5. **Limits.** Prompt: *Redesign this room from a photo.* Show it declining and saying what Roomwise can do.
6. **Privacy.** Show the share link (read-only) and the delete button; mention 90-day expiry.

## Aisle

1. **Plan.** Prompt: *Seat my 60 wedding guests at 8 tables of 8. Keep the four Smiths together and make sure Alex and Jo are at different tables.* Show `plan_wedding_seating` and the widget: "N of N rules met".
2. **Open on the web.** Drag a guest to another table: the group rule fails, with the reason. Drop onto a full table: refused with an explanation. Plan seating: back to all passing.
3. **Conflict.** Prompt: *Seat Ann, Bob and Cy at two tables of 2. Ann and Bob must sit together but also apart.* Show the conflict explanation and the suggested rule to relax.
4. **Timeline.** Prompt: *Build a timeline for a 4pm ceremony with a 20 minute drive and an 11pm curfew.* Show segments and the curfew warning.
5. **Limits.** Prompt: *Book a photographer in Austin.* Show it declining.
6. **Privacy.** Share link, delete button, first names only, 90-day expiry.
