const getContestPage = (index, supportedContests) => {
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

const getShortContestPage = supportedContests => {
  let contestsString = '```markdown\n';
  for (let i = 0; i < supportedContests.length; i ++ ) {
    contestsString += (i + 1).toString() + '. ' + supportedContests[i].displayName + '\n';
  }
  contestsString += '```';
  return 'Here are the current contests:' + contestsString;
};

module.exports = { getContestPage, getShortContestPage };
