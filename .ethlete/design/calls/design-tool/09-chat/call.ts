import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'the chat',
  eyebrow: 'Design tool · call 9',
  headline: 'Where does a verb pressed over the canvas turn into a message?',
  intro:
    'Call 8 put the verbs in a bar that floats over the drawing, on the far side of the window from the chat. A verb is not an action on its own: it starts a message the reader edits and sends. This call draws the chat column alone at 380px and asks what that column does with the verb that arrives in it, and how much of the call it shows above the conversation. All three draw the @ethlete surface and colour tokens.',
  frameWidth: 380,
  rounds: [
    {
      key: 'r1',
      title: 'What the verb turns into',
      note: 'C wins. A verdict that is stated on the card, not typed into a line, is the one thing a draft left waiting must not get wrong: the variant the verb named is fixed at the press and cannot drift when the reader picks another tile. A lost on exactly that drift. B lost because its head repeats the tile column and takes a third of the height from a conversation that only grows.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The draft lands in the input',
      claim:
        'The column is the conversation and nothing else. A verb press writes its opening words into the input at the foot, puts the caret after them, and the reader finishes the sentence and sends.',
      cost: 'Nothing in the column says which variant the verb named, so a draft that waits while the reader picks a different tile now means something else.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The call stands above the thread',
      claim:
        'A fixed head above the conversation carries the open call, the round, and every variant with its verdict. The verb still drafts into the input, but the column says at all times where the call stands.',
      cost: 'The head repeats what the tile column already shows, and it takes a third of the height from a conversation that only grows.',
      verdict: 'rejected',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · The verb opens a compose card',
      claim:
        'A verb press opens a card at the foot holding the verb, the variant it names and a free text box. The message is built as a form, so what it rules is fixed the moment the verb is pressed.',
      cost: 'A plain remark now needs the card dismissed first, so the cheapest thing to say is the one thing the column makes hardest.',
      verdict: 'chosen',
      load: () => import('./option-c'),
    },
  ],
});
