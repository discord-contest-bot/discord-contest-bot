const Discord = require('discord.js');
const client = new Discord.Client();
const express = require('express');
const firebase = require('firebase');
const path = require('path');
const app = express();
const port = process.env.PORT || 2752;
require('dotenv').config();
const latex = require('node-latex');
const fs = require('fs');
const files = require('fs').promises;
const { exec } = require('child_process');
const { getContestPage, getShortContestPage } = require('./helpers/contestInfo.js');
const { createReactions, createMessages } = require('./helpers/createCollectors.js');

const prefix = process.env.CUSTOM_PREFIX || 'gimme';
const mod_prefix = process.env.MOD_PREFIX || 'do';

const noAsy = str => {
  while (str.includes('[asy]') && str.includes('[/asy]')) {
    str = str.substring(0, str.indexOf('[asy]')) + str.substring(str.indexOf('[/asy]') + 6);
  }
  return str;
};

const replaceSubstring = (str, beginStr, toReplace, replacement, endStr) => {
  let begin = 0;
  for (let i = 0; i < str.length; i ++) {
    if (str.substr(i, beginStr.length) === beginStr) {
      begin = i;
      continue;
    }
    if (str.substr(i, endStr.length) === endStr) {
      str = str.substring(0, begin) + str.substring(begin, i).replace(/\&amp;/g, '\&') + str.substring(i);
    }
  }
  return str;
};

const latexify = str => {
  str = replaceSubstring(str, '\\begin\{align\*\}', '\&amp;', '\&', '\\end\{align\*\}');
  str = replaceSubstring(str, '\\begin\{cases\}', '\&amp;', '\&', '\\end\{cases\}');
  str = replaceSubstring(str, '\\begin\{array\}', '\&amp;', '\&', '\\end\{array\}');
  str = replaceSubstring(str, '\\begin\{tabular\}', '\&amp;', '\&', '\\end\{tabular\}');
  let totalN = -1;
  for (let i = 0; i < str.length; i ++) {
    if (str[i] === '\n') {
      totalN ++;
      continue;
    }
    if (totalN >= 0) {
      str = str.substring(0, i - totalN - 1) + `\\\\[${totalN}\\baselineskip]` + str.substring(i);
      totalN = -1;
    }
  }
  console.log(str);
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<i>/g, '\\textit\{').replace(/<\/i>|<\/b>/g, '\}').replace(/<b>/g, '\\textbf\{')    //Replace <, >, \textit, \textbf
    .replace(/<li[^>]*>/g, '\\item ').replace(/<\/li>/g, '').replace(/<ol[^>]*>/g, '\\begin{enumerate}').replace(/<\/ol>/g, '\\end{enumerate}')       //Replace \item, \begin{enumerate}
    .replace(/<ul[^>]*>/g, '\\begin{itemize}').replace(/<\/ul>/g, '\\end{itemize}').replace(/\&ge\;|\&gte\;/g, '\\ge').replace(/\&amp\;/g, '\\\&')    //Replace \end{itemize}, \geq, \&
    .replace(/\&nbsp;/g, '').replace(/<hr[^>]*>/g, '\\rule\{\\linewidth\}{0.5mm}')                                                                    //Replace all &nbsp;, <hr />
    .replace(/\\\\\[[\d]*\\baselineskip\]\\item/g, '\\item').replace(/\\item\\\\\[[\d]*\\baselineskip\]/g, '\\item')                                  //Replace newlines around \item
    .replace(/(\\\\\[[\d]*\\baselineskip\])\\begin\{tabular\}/g, '$1 \\begin\{tabular\}').replace(/\\end\{tabular\}(\\\\\[[\d]*\\baselineskip\])/g, '\\end\{tabular\} $1')       //Protect newlines around tabular
    .replace(/\\\\\[[\d]*\\baselineskip\]\\begin\{/g, '\\begin\{').replace(/\\begin\{([^}]*)\}\\\\\[[\d]*\\baselineskip\]/g, '\\begin\{$1\}')         //Replace newlines around \begin{environment}
    .replace(/\\\\\[[\d]*\\baselineskip\]\\end\{/g, '\\end\{').replace(/\\end\{([^}]*)\}\\\\\[[\d]*\\baselineskip\]/g, '\\end\{$1\}')                 //Replace newlines around \end{environment}
    .replace(/\$([\d]+)(\.)*([\d]*)([\,]*)(\s)([a-zA-Z])/g, '\\\$$$1$2$3$4$5$6').replace(/−/g, '-');                                                           //Replace in the form $[number with or without decimal][space][letter] with \$[number with or without decimal][space][letter], and U+2212 with -
};

const makeLatex = str => {
  return `
  \\documentclass[preview, border=20pt, 12pt]\{standalone\}
  \\usepackage\{amsmath\}
  \\usepackage\{amsfonts\}
  \\usepackage\{amssymb\}
  \\usepackage\{yhmath\}
  \\newcommand\\overarc[1]\{\\wideparen\{\#1\}\}
  \\begin\{document\}
  \\thispagestyle{empty}
  \\noindent ${latexify(str)}
  \\end{document}
  `
}

/*
  Explanation of what proceeds:
    * Name is the name of the contest in the database
    * Display name is the front name and the one that is shown
    * Aliases are what the bot listens to
    * The type is regular or shortlist, and regular = only problem, shortlist = category + problem
    * firstCategory = first year contest has Shortlist
    * maxChar = maximum number of characters that you need for category
    * needsNumber = if you need a number (General Part 2 or TST 3)
    * picky = if you have one keywork look for another (November Guts or November General)
*/
const supportedContests = [
  {
    name: 'pamo-links',
    displayName: 'Pan African Math Olympiad',
    aliases: [
      'PAMO',
      'Pan African',
      'Pan African MO',
      'Pan African Math Olympiad'
    ],
    type: 'regular'
  },
  {
    name: 'isl-links',
    displayName: 'IMO Shortlist',
    aliases: [
      'ISL',
      'IMO SL',
      'IMO Shortlist'
    ],
    type: 'shortlist',
    categories: [
      'Algebra',
      'Number Theory',
      'Geometry',
      'Combinatorics',
    ],
    firstCategory: 1993,
    maxChar: 1,
    needsNumber: false
  },
  {
    name: 'aime-links',
    displayName: 'American Invitational Mathematics Examination',
    aliases: [
      'AIME',
      'American Invitational Mathematics Examination'
    ],
    type: 'shortlist',
    categories: [
      'I',
      'II'
    ],
    firstCategory: 2000,
    maxChar: 2,
    needsNumber: false
  },
  {
    name: 'hmmt-links',
    displayName: 'Harvard-MIT Mathematics Tournament',
    aliases: [
      'HMMT',
      'Harvard-MIT Mathematics Tournament'
    ],
    type: 'shortlist',
    categories: [
      'Al',
      'Co',
      'Ge',
      'Te'
    ],
    firstCategory: 1992,
    maxChar: 2,
    picky: true,
    keyword: 'No',
    needsNumber: true,
    lastNeeded: 2009
  },
  {
    name: 'apmo-links',
    displayName: 'Asian Pacific Mathematical Olympiad',
    aliases: [
      'APMO',
      'Asian Pacific Mathematical Olympiad'
    ],
    type: 'regular',
  },
  {
    name: 'usamo-links',
    displayName: 'United States of America Mathematical Olympiad',
    aliases: [
      'USAMO',
      'AMO',
      'United States of America Mathematical Olympiad',
      'USA Mathematical Olympiad'
    ],
    type: 'regular',
  },
  {
    name: 'usajmo-links',
    displayName: 'United States of America Junior Mathematical Olympiad',
    aliases: [
      'USAJMO',
      'JMO',
      'United States of America Junior Mathematical Olympiad',
      'USA Junior Mathematical Olympiad'
    ],
    type: 'regular',
  },
  {
    name: 'imo-links',
    displayName: 'International Mathematical Olympiad',
    aliases: [
      'IMO',
      'International Mathematical Olympiad',
    ],
    type: 'regular',
  },
  {
    name: 'putnam-links',
    displayName: 'Putnam',
    aliases: [
      'Putnam',
    ],
    type: 'shortlist',
    categories: [
      'A',
      'B'
    ],
    firstCategory: 1776,
    maxChar: 1,
    needsNumber: false
  },
  {
    name: 'usa-tstst-links',
    displayName: 'United States of America Team Selection Test for the Selection Team',
    aliases: [
      'United States of America Team Selection Test for the Selection Team',
      'USA Team Selection Test for the Selection Team',
      'United States of America TSTST',
      'USA TSTST'
    ],
    type: 'regular',
  },
  {
    name: 'usa-tst-links',
    displayName: 'United States of America Team Selection Test',
    aliases: [
      'United States of America Team Selection Test',
      'USA Team Selection Test',
      'United States of America TST',
      'USA TST'
    ],
    type: 'regular',
  },
  {
    name: 'usemo-links',
    displayName: 'United States of America Ersatz Mathematical Olympiad',
    aliases: [
      'USEMO',
      'United States of America Ersatz Mathematical Olympiad',
      'USA Ersatz Mathematical Olympiad'
    ],
    type: 'regular',
  },
  {
    name: 'rmm-links',
    displayName: 'Romanian Masters In Mathematics',
    aliases: [
      'RMM',
      'Romanian Masters In Mathematics',
    ],
    type: 'regular',
  },
  {
    name: 'egmo-links',
    displayName: 'European Girls Mathematical Olympiad',
    aliases: [
      'EGMO',
      'European Girls Mathematical Olympiad',
    ],
    type: 'regular',
  },
  {
    name: 'canadamo-links',
    displayName: 'Canada Mathematical Olympiad',
    aliases: [
      'Canada Mathematical Olympiad',
      'Canada MO',
      'Canada'
    ],
    type: 'regular',
  },
  {
    name: 'balkanmo-links',
    displayName: 'Balkan Mathematical Olympiad',
    aliases: [
      'Balkan MO',
      'Balkan Mathematical Olympiad',
    ],
    type: 'regular',
  },
  {
    name: 'jbalkanmo-links',
    displayName: 'Junior Balkan Mathematical Olympiad',
    aliases: [
      'JBMO',
      'Junior BMO',
      'Junior Balkan Mathematical Olympiad',
    ],
    type: 'regular',
  },
  {
    name: 'cgmo-links',
    displayName: 'China Girls Mathematical Olympiad',
    aliases: [
      'CGMO',
      'China Girls Mathematical Olympiad',
    ],
    type: 'regular',
  },
  {
    name: 'mpfg-oly-links',
    displayName: 'Math Prize For Girls Olympiad',
    aliases: [
      'MPfGO',
      'MPfG Olympiad',
      'Math Prize For Girls Olympiad',
    ],
    type: 'regular',
  },
  {
    name: 'mpfg-links',
    displayName: 'Math Prize For Girls',
    aliases: [
      'MPfG',
      'Math Prize For Girls',
    ],
    type: 'regular',
  },
  {
    name: 'benelux-links',
    displayName: 'Benelux',
    aliases: [
      'Benelux'
    ],
    type: 'regular'
  },
  {
    name: 'brazil-links',
    displayName: 'Brazil National Olympiad',
    aliases: [
      'Brazil',
      'Brazil National Olympiad',
      'Brazil MO',
      'Brazil Math Olympiad'
    ],
    type: 'regular'
  },
  {
    name: 'amc8-links',
    displayName: 'AMC 8',
    aliases: [
      'AMC 8',
      'AJHSME'
    ],
    type: 'regular'
  },
  {
    name: 'amc10-links',
    displayName: 'AMC 10',
    aliases: [
      'AMC 10',
    ],
    type: 'shortlist',
    categories: [
      'A',
      'B',
      'P'
    ],
    firstCategory: 2002,
    maxChar: 1,
    needsNumber: false
  },
  {
    name: 'amc12-links',
    displayName: 'AMC 12',
    aliases: [
      'AMC 12',
      'AHSME'
    ],
    type: 'shortlist',
    categories: [
      'A',
      'B',
      'P'
    ],
    firstCategory: 2002,
    maxChar: 1,
    needsNumber: false
  },
  {
    name: 'philippine-links',
    displayName: 'Philippine Math Olympiad',
    aliases: [
      'Philippine Math Olympiad',
      'Philippine MO',
      'Philippine National Olympiad',
      'Philippine',
    ],
    type: 'regular'
  },
  {
    name: 'serbia-links',
    displayName: 'Serbia Math Olympiad',
    aliases: [
      'Serbia Math Olympiad',
      'Serbia MO',
      'Serbia National Olympiad',
      'Serbia',
    ],
    type: 'regular'
  },
  {
    name: 'elmo-links',
    displayName: 'ELMO',
    aliases: [
      'ELMO',
    ],
    type: 'regular'
  },
  {
    name: 'inmo-links',
    displayName: 'Indian National Olympiad',
    aliases: [
      'INMO',
      'India',
      'Indian MO',
      'Indian National Olympiad'
    ],
    type: 'regular'
  },
  {
    name: 'aro-links',
    displayName: 'All-Russian Mathematical Olympiad',
    aliases: [
      'ARO',
      'ARMO',
      'All-Russian MO',
      'All-Russian Mathematical Olympiad'
    ],
    type: 'shortlist',
    categories: [
      '9',
      '11',
      '10'
    ],
    firstCategory: 1993,
    maxChar: 0,
    needsNumber: true,
    lastNeeded: 3030
  },
]

const checkInclude = (arr, str) => {
  return arr.some(el => str.toLowerCase().includes(el.toLowerCase()));
};

const checkNoSpaceInclude = (arr, str) => {
  return arr.some(el => str.toLowerCase().replace(/\s/g, '').includes(el.toLowerCase().replace(/\s/g, '')));
};

const deepReplace = (arr, str) => {
  arr.forEach(el => str = str.toLowerCase().replace(new RegExp(el, "gi"), ''))
  return str;
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const moderators = [
  446065841172250638,
  497237135317925898,
  420375586155003966,
  458060641022771223,
  650786371803545600,
  514320040418607119,
  694723815715897344,
  418206088027045888,
  406291604882718731,
  663111880658911241,
  556270124936724490,
  508676556801966114,
  420375586155003966,
  497237135317925898
];

const banned = [
  758778835742621706
];

firebase.initializeApp(firebaseConfig);

client.on('ready', () => {

  client.user.setActivity(`over ${client.guilds.cache.size} servers.`, { type: 'WATCHING' })
    .then(presence => console.log(`Activity set to ${presence.activities[0].name}`))
    .catch(console.error);
    console.log('I am ready!');
});

const min = (number1, number2) => {
  return (number1 > number2) ? number2 : number1;
};

const getProblemInfo = async (message, link) => {
  for (let i = 0; i < supportedContests.length; i ++) {
    let contest = supportedContests[i];
    if (!checkInclude(contest.aliases, message.content)) {
      continue;
    }
    message.content = deepReplace(contest.aliases, message.content);
    const contestInfo = await firebase.database().ref().child(contest.name).once('value');
    const numbers = message.content.match(/\d+/g);
    let year;
    let noTopic = false;
    let noProblem = false;
    if (!numbers) {
      year = Object.keys(contestInfo.val())[Math.floor(Math.random() * Object.keys(contestInfo.val()).length)];
      noTopic = true;
      noProblem = true;
    }
    else {
      year = numbers[0];
      if (!Object.keys(contestInfo.val()).includes(year)) {
        message.channel.send("That's not a valid year!");
        return;
      }
    }
    if (link) {
      if (noProblem || !numbers || !numbers[1]) {
        console.log(contestInfo.val()[year]['link']);
        return { problem: { link: contestInfo.val()[year]['link'] }};
      }
    }
    let problemNumber = !noProblem ? numbers[1] : 0;
    if (!numbers || !numbers[1]) {
      noProblem = true;
    }
    if (contest.type === 'shortlist' && !noTopic) {
      if (parseInt(year) >= contest.firstCategory && !(contest.needsNumber && parseInt(year) <= contest.lastNeeded )) {
        if (!numbers || !numbers[1]) {
          noProblem = true;
        }
        const letters = !noProblem ? message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[1], message.content.indexOf(numbers[0]) + numbers[0].length)).match(/[a-zA-Z]+/g) : message.content.substring(message.content.indexOf(numbers[0])).match(/[a-zA-Z]+/g);
        if (!letters) {
          noTopic = true;
          noProblem = true;
        }
        else if (contest.picky && (!noProblem ? message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[1], message.content.indexOf(numbers[0]) + numbers[0].length)) : message.content.substring(message.content.indexOf(numbers[0]))).includes(contest.keyword.toLowerCase())) {
          if (!letters[1]) {
            noTopic = true;
            noProblem = true;
          }
          else {
            problemNumber = !noProblem ? (letters[0].substring(0, contest.maxChar) + letters[1].substring(0, contest.maxChar) + '/' + numbers[1]).toUpperCase() : (letters[0].substring(0, contest.maxChar) + letters[1].substring(0, contest.maxChar)).toUpperCase();
          }
        }
        else {
          problemNumber = !noProblem ? (letters[0].substring(0, contest.maxChar) + '/' + numbers[1]).toUpperCase() : (letters[0].substring(0, contest.maxChar)).toUpperCase();
        }
      }
      if (contest.needsNumber && parseInt(year) <= contest.lastNeeded) {
        if (!numbers || !numbers[1]) {
          noTopic = true;
          noProblem = true;
        }
        else {
          if (!numbers[2]) {
            noProblem = true;
          }
          let letters = !noProblem ? message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[2], message.content.indexOf(numbers[0]) + numbers[0].length)).match(/[a-zA-Z]+/g) : message.content.substring(message.content.indexOf(numbers[0])).match(/[a-zA-Z]+/g);
          if (!letters && contest.maxChar > 0 && parseInt(year) >= contest.firstCategory) {
            noTopic = true;
          }
          else if (contest.picky && (!noProblem ? message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[2], message.content.indexOf(numbers[0]) + numbers[0].length)) : message.content.substring(message.content.indexOf(numbers[0]))).includes(contest.keyword.toLowerCase())) {
            if (!letters[1]) {
              message.channel.send("Specifications say I need something more specific, like November GENERAL (for HMMT). Provide that please");
            }
            else {
              problemNumber = !noProblem ? (letters[0].substring(0, contest.maxChar) + letters[1].substring(0, contest.maxChar) + numbers[1] + '/' + numbers[2]).toUpperCase() : (letters[0].substring(0, contest.maxChar) + letters[1].substring(0, contest.maxChar) + numbers[1]).toUpperCase();
            }
          }
          else {
            if (!letters) {
              letters = [''];
            }
            problemNumber = !noProblem ? (letters[0].substring(0, contest.maxChar) + numbers[1] + '/' + numbers[2]).toUpperCase() : (letters[0].substring(0, contest.maxChar) + numbers[1]).toUpperCase();
          }
        }
      }
    }
    if (noTopic && contest.type === 'shortlist' && parseInt(year) >= contest.firstCategory) {
      if (!contestInfo.val()[year]) {
        message.channel.send("I couldn't find that year!");
        return;
      }
      let topics = Object.keys(contestInfo.val()[year]);
      topics.splice(topics.indexOf('link'), 1);
      const topic = topics[Math.floor(Math.random() * topics.length)];
      problemNumber = topic + '/' + Object.keys(contestInfo.val()[year][topic])[Math.floor(Math.random() * Object.keys(contestInfo.val()[year][topic]).length)];
    }
    else if (noProblem) {
      if (problemNumber) {
        console.log(problemNumber);
        if (!contestInfo.val()[year][problemNumber]) {
          message.channel.send("I couldn't find that topic!");
          return;
        }
        problemNumber += '/' + Object.keys(contestInfo.val()[year][problemNumber])[Math.floor(Math.random() * Object.keys(contestInfo.val()[year][problemNumber]).length)];
      }
      else {
        const problems = Object.keys(contestInfo.val()[year]);
        problems.splice(problems.indexOf('link'), 1);
        problemNumber = problems[Math.floor(Math.random() * problems.length)];
      }
    }
    const preliminaryProblem = await firebase.database().ref().child(contest.name).child(year).child(problemNumber).once('value');
    const problem = preliminaryProblem.val();
    if (!problem) {
      message.channel.send("Whoops, looks like I couldn't find that problem. Try again with a **valid** problem.")
      return;
    }
    return { problem, contest, year, problemNumber };
  }
};

client.on('message', async message => {
  if (message.author.bot || message.author.id === client.user.id) {
    return;
  }
  if (banned.includes(message.author.id)) {
    return;
  }
  if (moderators.includes(parseInt(message.author.id)) && message.content.startsWith(mod_prefix)) {
    const initial = message.content;
    message.content = message.content.replace(new RegExp(mod_prefix, 'g'), '').trim();
    if (message.content.includes('get contests')) {
      message.delete();
      message.channel.send(getShortContestPage(supportedContests));
      client.channels.cache.get('749407577393201222').send(initial + '\nSent by ' + message.author.id);
      return;
    }
    if (message.content.startsWith('say ')) {
      message.delete();
      message.channel.send(message.content.replace('say ', ''));
      client.channels.cache.get('749407577393201222').send(initial + '\nSent by ' + message.author.id);
      return;
    }
    if (message.content.includes('log')) {
      message.content.replace('log', '').trim();
      if (message.content) {
        client.channels.cache.get('749407577393201222').send(message.content);
      }
      return;
    }
    if (message.guild.id !== '747227380786921493') {
      return;
    }
    if (message.content.includes('purge')) {
      client.channels.cache.get('749407577393201222').send(initial + '\nSent by ' + message.author.id);
      const numbers = message.content.match(/\d+/g);
      if (!numbers || !numbers[0]) {
        message.channel.send('Please next time tell me how many messages to purge!');
        return;
      }
      let fetched = await message.channel.messages.fetch({limit: Math.min(100, parseInt(numbers[0]) + 1)});
      message.channel.bulkDelete(fetched);
    }
    if (message.content.includes('server number')) {
      message.channel.send("I'm right now in " + client.guilds.cache.size + " servers!");
      client.channels.cache.get('749407577393201222').send(initial + '\nSent by ' + message.author.id);
    }
  }
  if (!message.content.startsWith(prefix) && !message.content.includes('<@!' + client.user.id + '>')) {
    return;
  }
  message.content = message.content.replace(new RegExp(prefix, 'g'), '').replace(new RegExp('<@!' + client.user.id + '>', 'g'), '').trim();
  if (message.content.toLowerCase().includes('ping')) {
     const msg = await message.reply(`Pong`);
     msg.edit(`<@` + message.author.id + `>, Pong: ${msg.createdTimestamp - message.createdTimestamp} ms.`);
     return;
  }
  if (message.content.toLowerCase().includes('pong')) {
     const msg = await message.reply(`Ping`);
     msg.edit(`<@` + message.author.id + `>, Ping: ${msg.createdTimestamp - message.createdTimestamp} ms.`);
     return;
  }
  if (message.content.toLowerCase().includes('help') || !message.content.replace(/\s/g, '')) {
    const helpEmbed  = new Discord.MessageEmbed()
    	.setColor('#0099ff')
    	.setTitle('Contest Bot')
    	.setURL('https://cryptic-hamlet-37911.herokuapp.com/')
    	.setAuthor('Discord Contest Bot Team')
    	.setDescription('Contest Bot is a Discord Bot dedicated to making math competition problems easily accessible and encourage collaboration between avid mathematicians. It was created and is being developed by [our team](https://github.com/discord-contest-bot/). Check out the [Contest Bot Website!](https://cryptic-hamlet-37911.herokuapp.com/).')
    	.setThumbnail('https://images.topperlearning.com/mimg/topper/news/c1adbbdba02e149861919befc5cb6558.png?v=0.0.3')
    	.addFields(
        { name: 'Prefix', value: 'The current prefix is \`' + prefix + '\`, but a mention works perfectly fine (<@746943730510200893>).'},
        { name: 'What can Contest Bot do?', value: 'Contest Bot is truly one of the best resources a math competitor can have in their discord server. It can:\n* Give you images rendered from LaTeX from almost any math competition you can think of,\n* Provide you with the AoPS thread for the problem, and even\n* Provide the raw LaTeX code for the problem for your own requirements.\n\nIf a contest is not supported by Contest Bot, you can use the `suggest contest` command, or simply join our [support server](https://discord.gg/C2sYVGb) and we will add it for you **_instantly!_**'},
        { name: 'Problems', value: 'In order to see how I can give you problems, use `' + prefix + ' problems`!'},
        { name: 'Other Commands', value: 'In order to see other commands, use `' + prefix + ' other`!'},
        { name: 'Support server', value: '[Join Us Here](https://discord.gg/C2sYVGb)!'},
        { name: 'Invite Me', value: '[Invite Contest Bot to Your Server](https://discord.com/api/oauth2/authorize?client_id=746943730510200893&permissions=100416&scope=bot)!'},
    	)
    	.setTimestamp()
    	.setFooter('© Discord Contest Bot Team');
     message.channel.send(helpEmbed);
     return;
  }
  if (message.content.toLowerCase() === 'problems') {
    message.channel.send(`The central aspect of this bot is getting problems. You can do this with the command \`` + prefix + `\` followed by the competition name or alias, year, and problem number. If there are additional arguments (for example, HMMT subject tests and ISL subject categories) then they go in between the year and problem number. For example, if I wanted the 5th problem of the Harvard-MIT Math Tournament Algebra subject test, I could write \`` + prefix + ` HMMT Algebra 5.\`

      Some finer points:

      * To randomize the problem number, year, or subject, do not specify (currently a work in progress).
      * For abbreviations of subject categories, if using one letter doesn't work, use two letters to see if it works.

      If you do this properly, Contest Bot will send an image containing the problem. In addition, two reactions will appear on the message: 💻 and 🔗.
      * Clicking on the 💻 will reveal the LaTeX code for the problem, if you want to use it on your own TeX document.
      * Clicking on the 🔗 will reveal the url to the AoPS thread about the problem, if you would like to write your own solution that you're proud of or if you get stuck and want to see how the problem is solved.

      Note that the bot automatically removes the reactions after one minute.`);
    return;
  }
  if (message.content.toLowerCase() === 'other') {
    message.channel.send(`In order to use a command, you can use \`` + prefix + `[command] [arguments]\` or substitute a ping for the prefix if you forget it.
      Here are some of Contest Bot's other commands:
      * \`contests\`
      You can use this to see the full list of all available contests. React with the left or right arrows to browse the other pages (yes, there are that many contests!) In the list, you will see the alias of all competitions. Any of the keywords on the same line as the contest name can be used as aliases to request problems.
      * \`suggest contest\`
      This command is used if you want to suggest a contest that isn't already supported by Contest Bot. Just follow the prompts given by the bot, and soon you will be able to request problems from that contest!
      * \`bug report [content]\`
      If there is an issue with Contest Bot, use this command to tell us. Please be detailed, so that we know exactly what's bothering you.`);
    return;
  }

  if (message.content.toLowerCase().includes('creator')) {
    message.channel.send('Hi there', {files: ['creator-pfp.jpg']});
  }
  if (message.content.toLowerCase().replace(/\s/g, '') === 'contests') {
    let contestsString = getContestPage(0, supportedContests).string;
    message.channel.send(contestsString).then(msg => createReactions(message, ['⬅️', '➡️'], [(message, clicked, i) => {
      let contest = getContestPage(--i, supportedContests);
      message.edit(contest.string);
      return contest.index;
    }, (message, clicked, i) => {
      let contest = getContestPage(++i, supportedContests);
      message.edit(contest.string);
      return contest.index;
    }], msg));
    return;
  }
  if (message.content.toLowerCase().replace(/\s/g, '') === 'support') {
    message.channel.send('Join the support server: https://cryptic-hamlet-37911.herokuapp.com/support.');
    return;
  }
  if (message.content.toLowerCase().replace(/\s/g, '') === 'directsupport') {
    message.channel.send('Join the support server: https://discord.gg/C2sYVGb');
    return;
  }
  if (message.content.toLowerCase().replace(/\s/g, '') === 'invite') {
    message.channel.send('Invite me: https://cryptic-hamlet-37911.herokuapp.com/invite.');
    return;
  }
  if (message.content.toLowerCase().replace(/\s/g, '') === 'directinvite') {
    message.channel.send('Invite me: https://discord.com/api/oauth2/authorize?client_id=746943730510200893&permissions=100416&scope=bot.');
    return;
  }
  if (message.content.toLowerCase().includes('bug report')) {
    if (!message.content.replace('bug report', '').trim()) {
      message.channel.send('Send in a bug report, such as using `' + prefix + ' bug report 2012 ISL C2 actually has an incorrect spelling of the.`');
      return;
    }
    message.channel.send('This is the bug report you are sending:\n' + message.content.replace('bug report', '').trim() + '\n Are you sure you want to do this? React with 🇾 for yes and with 🇳otherwise.').then(msg => createReactions(message, ['🇾', '🇳'], [(msg, clicked, i) => {
      if (i !== 823698652948698347983475073498579837947) {
        msg.edit('You sent the following bug report:\n' + message.content.replace('bug report', '').trim());
        client.channels.cache.get('747232085600632902').send('Bug report from <@' + message.author.id + '>:\n' + message.content.replace('bug report', '').trim());
      }
      return 823698652948698347983475073498579837947;
    }, (message, clicked, i) => {
      if (i !== 823698652948698347983475073498579837947) {
        message.edit('Aborted!');
      }
      return 823698652948698347983475073498579837947;
    }], msg));
    return;
  }
  if (message.content.toLowerCase().includes('suggest contest')) {
    await message.channel.send('What is the name of the contest? Use `c` to abort at any time. You have 15 seconds, starting ... now!');
    createMessages(message, msg => msg.author.id === message.author.id, async m => {
      const contest = m.content.trim();
      await message.channel.send('Alright, you want to add ' + contest + '. What\'s the link to the AoPS contest collection of all such problems?');
      createMessages(message, msg => msg.author.id === message.author.id, async m => {
        const link = m.content.trim();
        message.channel.send('You\'re sending ' + contest + ' with link ' + link + '.\n\n Are you sure you want to do this? React with 🇾 for yes and with 🇳otherwise.').then(msg => createReactions(message, ['🇾', '🇳'], [(msg, clicked, i) => {
          if (i !== 823698652948698347983475073498579837947) {
            const string = 'Contest: ' + contest + '\nLink: ' + link;
            msg.edit('You sent the following contest suggestion:\n' + string);
            client.channels.cache.get('747937557987328110').send('Contest suggestion from <@' + message.author.id + '>:\n' + string.trim());
          }
          return 823698652948698347983475073498579837947;
        }, (message, clicked, i) => {
          if (i !== 823698652948698347983475073498579837947) {
            message.edit('Aborted!');
          }
          return 823698652948698347983475073498579837947;
        }], msg));
      });
    });
    return;
  }
  if (message.content.toLowerCase().includes('link')) {
    message.content = message.content.replace(/link/g, '');
    const { problem } = await getProblemInfo(message, true);
    if (!!problem) {
      message.channel.send(problem.link);
    }
    return;
  }
  if (message.content.toLowerCase().includes('debug latex')) {
    message.content = message.content.replace(/debug latex/g, '');
    const { problem } = await getProblemInfo(message);
    if (!!problem) {
      message.channel.send('```latex\n' + makeLatex(noAsy(problem.statement)) + '```');
    }
    return;
  }
  if (message.content.toLowerCase().includes('latex')) {
    message.content = message.content.replace(/latex/g, '');
    const { problem } = await getProblemInfo(message);
    if (!!problem) {
      message.channel.send('```latex\n' + latexify(noAsy(problem.statement)) + '```');
    }
    return;
  }
  const result = await getProblemInfo(message);
  if (!result) return;
  const { problem, contest, year, problemNumber } = result;
  if (!!process.env.NO_RENDER) {
    message.channel.send('```latex' + makeLatex(noAsy(problem.statement)) + '```').then(msg => createReactions(message, ['💻', '🔗'], [(message, clicked, i) => {
      if (!clicked) {
        message.edit(message.content + '\nLaTeX:```latex'+ latexify(noAsy(problem.statement)) + '```');
        return 0;
      }
    }, (message, clicked, i) => {
      if (!clicked) {
        message.edit(message.content + '\nLink: ' + problem.link);
        return 0;
      }
    }], msg, (reaction, user) => (['💻', '🔗'].includes(reaction.emoji.name) && !user.bot && user.id !== client.user.id)));
    return;
  }
  const msg = await message.channel.send('Fetched ' + contest.displayName + ' ' + year + ' ' + problemNumber + '. Now trying to render that.');
  const suffix = Date.now() % 100;
  const output = fs.createWriteStream(path.join(__dirname, "output" + suffix + ".pdf"))
  const pdf = latex(makeLatex(noAsy(problem.statement)));

  pdf.pipe(output)
  pdf.on('error', err => {
    message.channel.send('Looks like there\'s an error: ' + err + '. Please directly message <@!446065841172250638>');
    client.channels.cache.get('747232085600632902').send('There has been an error with ' + contest.displayName + ' ' + year + ' ' + problemNumber + '. The error is as follows:\n' + err);
  });
  pdf.on('finish', () => {
    exec("convert -resize '4000' -density 288 /app/output" + suffix + ".pdf +negate -bordercolor transparent -border 30 -background black -flatten /app/output" + suffix + ".png", (err, stderr, stdout) => {
      if (err) {
        message.channel.send('Looks like there\'s an error: ' + err + '. Please directly message <@!446065841172250638>');
        client.channels.cache.get('747232085600632902').send('There has been an error with ' + contest.displayName + ' ' + year + ' ' + problemNumber + '. The error is as follows:\n' + err);
        return;
      }
      if (stderr) {
        message.channel.send('Looks like there\'s an error: ' + err + '. Please directly message <@!446065841172250638>');
        client.channels.cache.get('747232085600632902').send('There has been an error with ' + contest.displayName + ' ' + year + ' ' + problemNumber + '. The error is as follows:\n' + stderr);
        return;
      }
      msg.delete();
      message.channel.send('Here\'s ' + contest.displayName + ' ' + year + ' ' + problemNumber, {files: ['output' + suffix + '.png']}).then(msg => createReactions(message, ['💻', '🔗'], [(message, clicked, i) => {
        if (!clicked) {
          message.edit(message.content + '\nLaTeX:```'+ latexify(noAsy(problem.statement)) + '```');
          return 0;
        }
      }, (message, clicked, i) => {
        if (!clicked) {
          message.edit(message.content + '\nLink: ' + problem.link);
          return 0;
        }
      }], msg, (reaction, user) => (['💻', '🔗'].includes(reaction.emoji.name) && !user.bot && user.id !== client.user.id)));
    });
  });
});

client.login(process.env.BOT_TOKEN);

app.use(express.static('website'))

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + '/website/index.html'));
});

app.get("/why-that-order", (req, res) => {
  res.sendFile(path.join(__dirname + '/website/why-that-order.html'));
});

app.get("/example", (req, res) => {
  res.sendFile(path.join(__dirname + '/website/example-command.html'));
});

app.get("/example-command", (req, res) => {
  res.sendFile(path.join(__dirname + '/website/example-command.html'));
});

app.get("/invite", (req, res) => {
  res.send(`<meta http-equiv="Refresh" content="0; url='https://discord.com/api/oauth2/authorize?client_id=746943730510200893&permissions=124992&scope=bot'" />`)
});

app.get("/support", (req, res) => {
  res.send(`<meta http-equiv="Refresh" content="0; url='https://discord.gg/C2sYVGb'" />`)
});

app.get("/output", (req, res) => {
  let data = fs.readFileSync('./output.pdf');
  res.contentType('application/pdf');
  res.send(data);
})
