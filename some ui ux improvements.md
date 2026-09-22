some ui ux improvements: 

in the add move form:
- remove the default equipment section from the feild, take the first one in the list of chosen equipment as the default one.
- the image picker can be better, have a nicer clean UI (maybe dashed outline box) without the url input(no url now, only upload) and a small upload icon in the box (low opacity), when an image is uploaded, keep the same UI as we have now.


in the plan editor:
- the cardio input can have better UX, instead of just free string inputs, the time will always have its unit in minutes, so have an input with a 'min' unit hard placed, and a default value in the form when its opened(cardio form when user presses +) of 30. same for heart rate, hard place BPM as the unit and only accept numbers, and add a feild for the incline that defaults to 0, that is a number input with + and - on the left and right to set the level where values are from 0% to 15% max, % is a hard placed unit as well.
- replace the status dropdown (draft, active, completed) with just a small switch toggle between active and draft, remove the completed state completely we dont need it
- lets remove the focus note completely as well, we dont need it
- when you are scrolled down focusin on adding moves, you have to scroll all the way up to see what day you are editing, so to fix this, when you scroll down, keep the days tabs bar sticky under the rest of the already sticky header. 

in the plan editor for the move card UI: 
- lets remove the handle icon for drag and drop because its taking too much space, and make a long click (hold) on the card (anywhere on the card that is not an input) trigger the dragging, when dragged the border should primary orange color and the dragged element should have the highest z index while dragging (currently it sits below other elements which is an issue happenign anywhere we have drag and drop)
- lets move the add note icon button to the dropdown menu from the kebab trigger with duplicate and remove buttons
- lets re-arrange the inputs to: sets, reps, rest, speed, 1RM
- sets and reps should be number inputs specifically, even in db and validations.
- 1RM should have a hard-placed unit cause it will not change, which is %, same for rest but its 'sec'



for the final pdf UI: 
- lets have the cardio in the final pdf show before the workout table.
- in the header the logo is cutt-off, the logo I uploaded is not a square why is it being cut to one? only control the height not the width
- follow the old generated html page style for the pdf, its nicer, use the fonts used there
- export pdf should be one click that downloads the pdf, couch should not see more than that


for the share preview UI: 
- the download pdf button should be in the header at the top left, a smaller button, without the word download, the icon is enough, so icon with PDF only is enough
- add the BPM unit to the cardio UI
- the logo is also cut off, make the header like the new pdf header so they share the same header


