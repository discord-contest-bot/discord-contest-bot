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

const prefix = process.env.CUSTOM_PREFIX || 'gimme ';
const mod_prefix = process.env.MOD_PREFIX || 'do ';

const noAsy = str => {
  while (str.includes('[asy]') && str.includes('[/asy]')) {
    str = str.substring(0, str.indexOf('[asy]')) + str.substring(str.indexOf('[/asy]') + 6);
  }
  return str;
};

const latexify = str => {
  return str.replace(/\n\n/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<i>/g, '\\textit\{').replace(/<\/i>|<\/b>/g, '\}').replace(/<b>/g, '\\textbf\{').replace(/<li[^>]*>/g, '\\item ').replace(/<\/li>/g, '').replace(/\n<ol[^>]*>/g, '\\begin{enumerate}').replace(/<\/ol>\n/g, '\\end{enumerate}').replace(/\n<ul[^>]*>/g, '\\begin{itemize}').replace(/<\/ul>\n/g, '\\end{itemize}').replace(/\n/g, '~\\\\').replace(/\&ge\;|\&gte\;/g, '\\ge').replace(/\&amp\;/g, '\\\&').replace(/\&nbsp;/g, '').replace(/<hr[^>]*>/g, '\\rule\{\\linewidth\}{0.5mm}').replace(/\&amp;[\s]*=/g, '&=').replace(/\~\\\\\\item/g, '\\item').replace(/\~\\\\\\end{itemize}/g, '\\end{itemize}');
};

const makeLatex = str => {
  return `
  \\documentclass[preview, border=20pt, 12pt]\{standalone\}
  \\usepackage\{amsmath\}
  \\usepackage\{amsfonts\}
  \\usepackage\{amssymb\}
  \\begin\{document\}
  \\thispagestyle{empty}
  \\noindent ${latexify(str)}
  \\end{document}
  `
}

const supportedContests = [
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
    displayName: 'United States of America Team Selection Test for the Selection Test',
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
    displayName: 'United States of America Team Selection Team',
    aliases: [
      'United States of America Team Selection Team',
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
    displayName: 'Romainian Masters In Mathematics',
    aliases: [
      'RMM',
      'Romainian Masters In Mathematics',
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
      'Canada'
    ],
    type: 'regular',
  },
  {
    name: 'balkanmo-links',
    displayName: 'Balkan Mathematical Olympiad',
    aliases: [
      'BMO',
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
  497237135317925898];

firebase.initializeApp(firebaseConfig);

client.on('ready', () => {
    console.log('I am ready!');
});

const reactTime = 60000;

const min = (number1, number2) => {
  return (number1 > number2) ? number2 : number1;
};

const getContestPage = index => {
  let contestsString = '```markdown\n';
  let length = (Math.floor((supportedContests.length - 1) / 10) + 1);
  index = (index + length)  % length;
  for (let i = index * 10; i < min(supportedContests.length, (index + 1) * 10); i ++ ) {
    contestsString += (i + 1).toString() + '. ' + supportedContests[i].displayName + ': ';

    supportedContests[i].aliases.forEach((contest, index) => {
      if (index !== 0) {
        contestsString += ', ';
      }
      contestsString += contest;
    });
    contestsString += '\n';
  }
  contestsString += '```';
  return {string: 'Here are the contests. Note that any of the aliases after the name of the contest can be used to call the contest. In addition, note that I only process the first contest (my definition of first) and in addition, all info must come between the year and problem number (they\'re in that order). For example, to request ISL 2004 Algebra 5, you **must** use 2004 ISL Algebra 5, 2004 ISL A5, etc (note the position of ISL is irrelevant, but Algebra or A is between the year and problem number).' + contestsString, index };
};

const getShortContestPage = _ => {
  let contestsString = '```markdown\n';
  for (let i = 0; i < supportedContests.length; i ++ ) {
    contestsString += (i + 1).toString() + '. ' + supportedContests[i].displayName + '\n';
  }
  contestsString += '```';
  return 'Here are the current contests:' + contestsString;
};

const getProblemInfo = async message => {
  for (let i = 0; i < supportedContests.length; i ++) {
    let contest = supportedContests[i];
    if (!checkInclude(contest.aliases, message.content)) {
      continue;
    }
    message.content = deepReplace(contest.aliases, message.content);
    const numbers = message.content.match(/\d+/g);
    if (!numbers) {
      message.channel.send("I can't return the entire contest - that's crazy. Maybe a year would shorten stuff a lot.");
      return;
    }
    const year = numbers[0];
    if (!numbers[1]) {
      message.channel.send("From what I see, you probably provided a year but I still need a problem number, right? It would help if I had one.");
      return;
    }
    let problemNumber = numbers[1];
    if (contest.type === 'shortlist') {
      if (parseInt(year) >= contest.firstCategory && !(contest.needsNumber && parseInt(year) <= contest.lastNeeded )) {
        const letters = message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[1], message.content.indexOf(numbers[0]) + numbers[0].length)).match(/[a-zA-Z]+/g);
        if (!letters) {
          message.channel.send("Don't delay me like this. Where's the topic?")
          return;
        }
        if (contest.picky && message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[1], message.content.indexOf(numbers[0]) + numbers[0].length)).includes(contest.keyword.toLowerCase())) {
          if (!letters[1]) {
            message.channel.send("Specifications say I need something more specific, like November GENERAL (for HMMT). Provide that please");
          }
          problemNumber = (letters[0].substring(0, contest.maxChar) + letters[1].substring(0, contest.maxChar) + '/' + numbers[1]).toUpperCase();
        }
        else {
          problemNumber = (letters[0].substring(0, contest.maxChar) + '/' + numbers[1]).toUpperCase();
        }
      }
      if (contest.needsNumber && parseInt(year) <= contest.lastNeeded) {
        if (!numbers[2]) {
          message.channel.send("I didn't get a problem number - why is that?");
          return;
        }
        const letters = message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[2], message.content.indexOf(numbers[0]) + numbers[0].length)).match(/[a-zA-Z]+/g);
        if (!letters && parseInt(year) >= contest.firstCategory) {
          message.channel.send("Don't delay me like this. Where's the topic?")
          return;
        }
        if (contest.picky && message.content.substring(message.content.indexOf(numbers[0]), message.content.indexOf(numbers[1], message.content.indexOf(numbers[0]) + numbers[0].length)).includes(contest.keyword.toLowerCase())) {
          if (!letters[1]) {
            message.channel.send("Specifications say I need something more specific, like November GENERAL (for HMMT). Provide that please");
          }
          problemNumber = (letters[0].substring(0, contest.maxChar) + letters[1].substring(0, contest.maxChar) + numbers[1] + '/' + numbers[1]).toUpperCase();
        }
        else {
          problemNumber = (letters[0].substring(0, contest.maxChar) + numbers[1] + '/' + numbers[2]).toUpperCase();
        }
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

const createReactions = async (message, reactions, functions, msg) => {
  await reactions.forEach(async r => {
    await msg.react(r);
  });
  let clicked = {};
  const filter = (reaction, user) => {
    return reactions.includes(reaction.emoji.name) && user.id === message.author.id;
  }
  const onCollect = async (emoji, message, i, getList) => {
    await reactions.forEach(async (r, idx) => {
      if (emoji.name === r) {
        i = await functions[idx](message, clicked[idx], i);
        clicked[idx] = true;
        return;
      }
    });
    return i;
  }
  const createCollectorMessage = async (message, getList) => {
    let i = 0;
    const collector = message.createReactionCollector(filter, { time: reactTime });
    await collector.on('collect', async (r, user) => {
      try {
        await r.users.remove(user.id);
      }
      catch (e) {
        message.channel.send("I don't have permissions to manage reactions. Ask the higher ups to grant me this AWESOME power so I can actually tell what you want.")
      }
      await message.react(r.emoji);
      i = await onCollect(r.emoji, message, i, getList);
    });
    collector.on('end', collected => message.reactions.removeAll());
  }
  createCollectorMessage(msg, reactions);
};

client.on('message', async message => {
  if (message.author.bot || message.author.id === client.user.id) {
    return;
  }
  if (moderators.includes(parseInt(message.author.id)) && message.content.startsWith(mod_prefix)) {
    message.content = message.content.replace(new RegExp(mod_prefix, 'g'), '');
    if (message.content.includes('say ')) {
      message.delete();
      message.channel.send(message.content.replace('say ', ''));
      return;
    }
    if (message.content.includes('get contests')) {
      message.delete();
      message.channel.send(getShortContestPage());
      return;
    }
    if (message.content.includes('log')) {
      message.content.replace('log', '').trim();
      if (message.content) {
        client.channels.cache.get('749407577393201222').send(message.content);
      }
      return;
    }
  }
  if (!message.content.startsWith(prefix) && !message.content.includes('<@!' + client.user.id + '>')) {
    return;
  }
  message.content = message.content.replace(new RegExp(prefix, 'g'), '').replace(new RegExp('<@!' + client.user.id + '>', 'g'), '');
  if (message.content.toLowerCase().includes('ping')) {
     message.reply('Pong!');
     return;
  }
  if (message.content.toLowerCase().includes('pong')) {
     message.reply('Ping!');
     return;
  }
  if (message.content.toLowerCase().includes('help') || !message.content.replace(/\s/g, '')) {
    const helpEmbed  = new Discord.MessageEmbed()
    	.setColor('#0099ff')
    	.setTitle('Contest Bot')
    	.setURL('https://heroku.com/')
    	.setAuthor('Amol Rama', 'https://i.redd.it/7i52f6n4iely.jpg')
    	.setDescription('This is a bot that takes problems from AoPS (by request), puts them in a database, and anyone can find it with the appropriate command.')
    	.setThumbnail('https://images.topperlearning.com/mimg/topper/news/c1adbbdba02e149861919befc5cb6558.png?v=0.0.3')
    	.addFields(
    		{ name: 'Help Command', value: 'You can use `[prefix] help` to get my attention.' },
        { name: 'Prefix', value: 'The current prefixes are \`' + prefix + '\`, but a mention works perfectly fine (<@746943730510200893>).'},
        { name: 'Contests', value: 'I have many contests available. Use `[prefix] contests` to see them all.'},
        { name: 'Support server', value: '[Join Us Here](https://discord.gg/C2sYVGb)'},
        { name: 'Invite Me', value: '[Invite Contest Bot to Your Server](https://discord.com/api/oauth2/authorize?client_id=746943730510200893&permissions=100416&scope=bot)'},
    	)
    	.setTimestamp()
    	.setFooter('Contact me at Circumrectangular Hyperbola#8766', 'https://i1.sndcdn.com/artworks-000219620854-jeksn1-t500x500.jpg');
     message.channel.send(helpEmbed);
     return;
  }
  if (message.content.toLowerCase().includes('creator')) {
    message.channel.send('Hi there', {files: ['creator-pfp.jpg']});
  }
  if (message.content.toLowerCase().replace(/\s/g, '') === 'contests') {
    let contestsString = getContestPage(0).string;
    message.channel.send(contestsString).then(msg => createReactions(message, ['⬅️', '➡️'], [(message, clicked, i) => {
      let contest = getContestPage(--i);
      message.edit(contest.string);
      return contest.index;
    }, (message, clicked, i) => {
      let contest = getContestPage(++i);
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
    const msg = await message.channel.send('This is the bug report you are sending:\n' + message.content.replace('bug report', '').trim() + '\n Are you sure you want to do this? React with :yes: for yes and with :no: otherwise.');
  }
  if (message.content.toLowerCase().includes('link')) {
    message.content = message.content.replace(/link/g, '');
    const problem = await getProblemInfo(message);
    if (!!problem) {
      message.channel.send(problem.link);
    }
    return;
  }
  if (message.content.toLowerCase().includes('latex')) {
    message.content = message.content.replace(/link/g, '');
    const problem = await getProblemInfo(message);
    if (!!problem) {
      message.channel.send('```' + latexify(noAsy(problem.statement)) + '```');
    }
    return;
  }
  const { problem, contest, year, problemNumber } = await getProblemInfo(message);
  if (!problem) return;
  if (!!process.env.NO_RENDER) {
    message.channel.send(makeLatex(noAsy(problem.statement)));
    return;
  }
  const msg = await message.channel.send('Fetched ' + contest.displayName + ' ' + year + ' ' + problemNumber + '. Now trying to render that.');
  const output = fs.createWriteStream(path.join(__dirname, "output.pdf"))
  const pdf = latex(makeLatex(noAsy(problem.statement)));

  pdf.pipe(output)
  pdf.on('error', err => {
    message.channel.send('Looks like there\'s an error: ' + err + '. Please directly message <@!446065841172250638>');
    client.channels.cache.get('747232085600632902').send('There has been an error with ' + contest.displayName + ' ' + year + ' ' + problemNumber + '. The error is as follows:\n' + err);
  });
  pdf.on('finish', () => {
    exec("convert -resize '4000' -density 288 /app/output.pdf +negate -bordercolor transparent -border 30 -background black -flatten /app/output.png", (err, stderr, stdout) => {
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
      message.channel.send('Here\'s ' + contest.displayName + ' ' + year + ' ' + problemNumber, {files: ['output.png']}).then(msg => createReactions(message, ['💻', '🔗'], [(message, clicked, i) => {
        if (!clicked) {
          message.edit(message.content + '\nLaTeX:```'+ latexify(noAsy(problem.statement)) + '```');
          return 0;
        }
      }, (message, clicked, i) => {
        if (!clicked) {
          message.edit(message.content + '\nLink: ' + problem.link);
          return 0;
        }
      }], msg));
    });
  });
});

client.login(process.env.BOT_TOKEN);

app.listen(port, () => {
  console.log(`Listening to requests on http://localhost:${port}`);
});

app.get("/", (req, res) => {
  res.send(`I'm contest bot! More information soon to come about me!`)
});

app.get("/invite", (req, res) => {
  res.send(`<meta http-equiv="Refresh" content="0; url='https://discord.com/api/oauth2/authorize?client_id=746943730510200893&permissions=124992&scope=bot'" />`)
});

app.get("/support", (req, res) => {
  res.send(`<meta http-equiv="Refresh" content="0; url='https://discord.gg/C2sYVGb'" />`)
});
