import dotenv from 'dotenv';
dotenv.config();
// DISCORD.JS
import { Client, Intents, MessageEmbed } from 'discord.js';
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
});

import {
  joinVoiceChannel,
  createAudioPlayer,
  getVoiceConnection,
} from '@discordjs/voice';

// UTILITIES
import { isValidUrl, emojiNumbers } from './src/utilities/index.js';

// PROVIDERS
import { zora, sound, catalog, audius } from './src/providers/index.js';

// COMPONENTS
import { audioPlayer } from './src/components/player.js';

client.login(process.env.CLIENT_TOKEN);

const queue = new Map(); // Global queue for song state.

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  const trigger = '!bpm'; // Discord command trigger !bpm
  const server_queue = queue.get(message.guild.id); // GET QUEUE
  const voiceChannel = message.member.voice.channel;
  if (message.content.startsWith(trigger)) {
    const command = message.content.replace(`${trigger} `, ''); // This is the command appended to !bpm or the URL
    if (command === 'gm') {
      return message.reply(`GM ${message.author.username}`);
    } else if (!voiceChannel) {
      message.reply('You must be in an active voice channel to run commands.');
    } else if (command === 'stop') {
      if (!server_queue) {
        return msg.reply(`There are no songs in the queue!`);
      }
      server_queue.player.stop();
      const connection = getVoiceConnection(message.guild.id);
      connection.destroy();
      queue.delete(message.guild.id);
      message.reply('Music stopped!');
    } else if (command === 'skip') {
      if (!server_queue) {
        return msg.reply(`There are no songs in the queue!`);
      }
      server_queue.songs.shift();
      audioPlayer(message, server_queue.songs[0], queue);
    } else if (command === 'np') {
      if (!server_queue) {
        return message.reply(`There are no songs in the queue!`);
      }
      let fields = [];
      server_queue.songs.map((a, i) =>
        fields.push({
          name: emojiNumbers[i + 1],
          value: `${a.title} - ${a.artist}`,
        })
      );

      const Embed = new MessageEmbed()
        .setColor('#ff7a03')
        .setTitle(`${fields.length} songs in queue`)
        .addFields(fields.slice(0, 10));

      message.reply({ embeds: [Embed] });
    } else if (isValidUrl(command)) {
      // Select the correct provider based on the URL
      // Wee bit unsafe as we are using part of the URL to determine the provider.
      async function provider() {
        switch (true) {
          case command.includes('catalog.works'):
            return await catalog(command);
          case command.includes('zora.co'):
            return await zora(command);
          case command.includes('sound.xyz'):
            return await sound(command);
          case command.includes('audius.co'):
            return await audius(command);
          default:
            return null;
        }
      }
      const res = await provider();
      if (!server_queue) {
        try {
          if (!res) {
            throw new Error(`No audio provider for: ${command}`);
          }
          const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
          });

          const queue_constructor = {
            voice_channel: voiceChannel,
            text_channel: message.channel,
            connection: null,
            songs: [],
            player: createAudioPlayer(),
          };
          // Add our key and value pair into the global queue. We then use this to get our server queue.
          queue.set(message.guild.id, queue_constructor);
          res.map((d) => queue_constructor.songs.push(d));

          queue_constructor.connection = connection;
          audioPlayer(
            message,
            { ...queue_constructor.songs[0], url: command },
            queue
          );
        } catch (err) {
          message.reply(err.message || 'Error');
          // throw err;
        }
      } else {
        res.map((d) => server_queue.songs.push({ ...d, url: command }));
        message.reply(
          res.length > 1
            ? 'Songs added to the queue!'
            : 'Song added to the queue!'
        );
      }
    }
  }
});
