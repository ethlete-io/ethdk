column -> rounds -> matches

in a double elimination bracket we need a way to span columns, since there might be 2 rounds in the looser bracket for one in the winner bracket.

That means we need to keep track of the total bracket height. if the current column has space at the bottom we can add the next round there

double elim example

- column
  - winner round 1 (track height)
  - looser round 1 (track height)
- column
  - winner round 2 (2x width)
  - looser round 2 (add to the bottom)
  - looser round 3 (add to the bottom right since the total height of w/l r1 would be exceeded)

...

once they meet in the final the column will have a height of w/l r1 combined only displaying the final match
after there might follow the reverse final.
