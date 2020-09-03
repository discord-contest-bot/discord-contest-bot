## What is Contest Bot?

Contest Bot is a Discord Bot dedicated to making math competition problems easily accessible and encourage collaboration between avid mathematicians. It was created and is being developed by [our team](https://github.com/discord-contest-bot/). Check out the [Contest Bot Website!](https://cryptic-hamlet-37911.herokuapp.com/)

## What can Contest Bot do?

Contest Bot is truly one of the best resources a math competitor can have in their discord server. It can:
* Give you images rendered from LaTeX from almost any math competition you can think of,
* Provide you with the AoPS thread for the problem, and even
* Provide the raw LaTeX code for the problem for your own requirements.

If a contest is not supported by Contest Bot, you can use the `suggest contest` command, or simply join our [support server](https://discord.gg/C2sYVGb) and we will add it for you **_instantly!_**

## How can I use Contest Bot?

It's really simple! All you need to do is invite Contest Bot to a discord server by clicking on [this link!](https://cryptic-hamlet-37911.herokuapp.com/invite)

## Getting problems
The central aspect of this bot is getting problems. You can do this with the command `[prefix]` followed by the competition name or alias, year, and problem number. If there are additional arguments (for example, HMMT subject tests and ISL subject categories) then they go in between the year and problem number. For example, if I wanted the 5th problem of the Harvard-MIT Math Tournament Algebra subject test, I could write `[prefix] HMMT Algebra 5.`

Some finer points:

* To randomize the problem number, year, or subject, do not specify.
* For abbreviations of subject categories, if using one letter doesn't work, use two letters to see if it works.

If you do this properly, Contest Bot will send an image containing the problem. In addition, two reactions will appear on the message: a computer and a chain link.
* Clicking on the computer will reveal the LaTeX code for the problem, if you want to use it on your own TeX document.
* Clicking on the chain link will reveal the url to the AoPS thread about the problem, if you would like to write your own solution that you're proud of or if you get stuck and want to see how the problem is solved.

Note that the bot automatically removes the reactions after one minute.
## General Commands
In order to use a command, you can use 
`[prefix] [command] [arguments]` or substitute a ping for the prefix if you forget it.
Here are some of Contest Bot's other commands:
* `contests`

You can use this to see the full list of all available contests. React with the left or right arrows to browse the other pages (yes, there are that many contests!) In the list, you will see the alias of all competitions. Any of the keywords on the same line as the contest name can be used as aliases to request problems.

* `suggest contest`

This command is used if you want to suggest a contest that isn't already supported by Contest Bot. Just follow the prompts given by the bot, and soon you will be able to request problems from that contest!

* `bug reports [content]`

If there is an issue with Contest Bot, use this command to tell us. Please be detailed, so that we know exactly what's bothering you.
