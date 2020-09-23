const reactTime = 60000;
const replyTime = 15000;

const createReactions = async (message, reactions, functions, msg, fill) => {
  await reactions.forEach(async r => {
    await msg.react(r);
  });
  const filter = (reaction, user) => {
    return (reactions.includes(reaction.emoji.name) && user.id === message.author.id);
  }
  let clicked = {};
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
    const collector = message.createReactionCollector(fill || filter, { time: reactTime });
    await collector.on('collect', async (r, user) => {
      try {
        await r.users.remove(user.id);
        await message.react(r.emoji);
      }
      catch (e) {
        message.channel.send("I don't have permissions to manage reactions. Ask the higher ups to grant me this AWESOME power so I can actually tell what you want.")
      }
      i = await onCollect(r.emoji, message, i, getList);
    });
    collector.on('end', collected => message.reactions.removeAll());
  }
  createCollectorMessage(msg, reactions);
};

const createMessages = async (message, filter, afterRecieve) => {
  const collector = message.channel.createMessageCollector(filter, { max: 1, time: replyTime });
  collector.on('collect', async m => {
    if (m.content.toLowerCase() === 'c') {
      message.channel.send('Aborted!');
      return;
    }
    await afterRecieve(m);
  });
};

module.exports = { createReactions, createMessages };
