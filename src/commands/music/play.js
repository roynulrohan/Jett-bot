import { QueryType } from 'discord-player';
import { ComponentType } from 'discord.js';
import { getPlayPlaylistEmbed, getPlaySongEmbed, getPlaylistAddedEmbed } from '../../embeds/music/playEmbed.js';
import skipEmbed from '../../embeds/music/skipEmbed.js';
import stopEmbed from '../../embeds/music/stopEmbed.js';
import isYoutubePlaylist from '../../utils/urlTools/isYoutubePlaylist.js';
import isValidUrl from '../../utils/urlTools/isValidUrl.js';
import GuildQueueController from '../../controllers/guildQueueController.js';
import checkMemberName from '../../utils/checkMemberName.js';
import { getPausedButtonRow, getPlayButtonRow } from '../../embeds/music/buttonRowEmbed.js';
import pauseEmbed from '../../embeds/music/pauseEmbed.js';
import resumeEmbed from '../../embeds/music/resumeEmbed.js';
import isUserConnectedToBotChannel from '../../utils/isUserConnectedToBotChannel.js';
import CooldownController from '../../controllers/cooldownController.js';
import { getCooldownEmbed } from '../../embeds/music/exceptionsEmbed.js';

export default {
    name: 'play',
    description: 'Play a song from YouTube.',
    options: [
        {
            type: 3,
            name: 'song',
            description: 'search keywords, name, or url',
            required: true,
        },
    ],

    callback: async (client, interaction) => {
        const channel = interaction.member.voice.channel;

        if (!channel)
            return interaction.reply({
                content: 'you need to be in a voice channel to play a song.',
                ephemeral: true,
            });

        if (!channel.permissionsFor(client.user).has('ViewChannel')) {
            return await interaction.reply({
                content: 'Bot is not allowed to play on this channel!',
                ephemeral: true,
            });
        }

        let queue;

        if (!client.player.nodes.has(interaction.guild)) {
            queue = client.player.nodes.create(interaction.guild, {
                leaveOnEnd: false,
                selfDeaf: false,
                skipOnNoStream: true,
            });
        } else {
            queue = client.player.nodes.get(interaction.guild);

            if (!isUserConnectedToBotChannel(client.user.id, channel)) {
                return await interaction.reply({
                    content: 'You must be on the same channel as the bot!',
                    ephemeral: true,
                });
            }
        }

        const queueController = GuildQueueController.getGuildQueueController(interaction.guildId).queueController;

        if (!queue.connection) await queue.connect(interaction.member.voice.channel);

        let embed;
        let playlist;

        const songField = interaction.options.getString('song');

        const result = await client.player.search(songField, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO,
        });

        if (result.tracks.length === 0) {
            return interaction.reply({
                content: 'No results found on this link!.',
                ephemeral: true,
            });
        }

        const song = result.tracks[0];
        queue.addTrack(song);

        embed = getPlaySongEmbed(
            interaction.member.voice.channel.name,
            queue.isPlaying(),
            song,
            checkMemberName(interaction.member.nickname, interaction.member.user.username)
        );

        await interaction.deferReply();

        try {
            if (!queue.isPlaying()) {
                await queue.node.play();

                queueController.setTrackMoveEventListener(queue, client);
            }

            const reply = await interaction.followUp(embed);

            queueController.queueReply.push(reply);

            if (playlist) {
                queueController.playlists.push({
                    id: queueController.playlists.length + 1,
                    startIndex: queueController.queueReply.length - 1,
                    length: playlist.tracks.length,
                    author: playlist.author.name,
                    title: playlist.title,
                    url: playlist.url,
                    reply,
                    addedBy: checkMemberName(interaction.member.nickname, interaction.member.user.username),
                });
            }

            const collector = await reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
            });

            collector.on('collect', async (interaction) => {
                if (CooldownController.isOnCooldown(interaction.guildId)) {
                    return interaction.reply(getCooldownEmbed());
                }

                if (!queue) {
                    return await interaction.reply({
                        content: 'There are no songs in the queue.',
                        ephemeral: true,
                    });
                }

                if (interaction.member.voice.channel) {
                    if (!isUserConnectedToBotChannel(client.user.id, interaction.member.voice.channel)) {
                        return await interaction.reply({
                            content: 'You must be on the same channel as the bot!',
                            ephemeral: true,
                        });
                    }
                } else {
                    return await interaction.reply({
                        content: 'You need to be on the server to interact with the bot!',
                        ephemeral: true,
                    });
                }

                CooldownController.applyCooldown(interaction.guildId);

                if (interaction.customId == 'stop') {
                    try {
                        queueController.stopCommandIssued = true;

                        queue.delete();

                        return interaction.reply(stopEmbed(checkMemberName(interaction.member.nickname, interaction.member.user.username)));
                    } catch (error) {
                        console.log(
                            `\nError while stop button was pressed on the server: ${interaction.guild.name} / Id: ${interaction.guild.id}. Error: ${error}`
                        );
                        return;
                    }
                }

                if (interaction.customId == 'skip') {
                    try {
                        queue.node.skip();

                        await interaction.reply(
                            skipEmbed(queue.currentTrack.raw.title, checkMemberName(interaction.member.nickname, interaction.member.user.username))
                        );

                        setTimeout(async () => {
                            await interaction.deleteReply();

                            return;
                        }, 2500);
                    } catch (error) {
                        console.log(
                            `\nError while skip button was pressed on the server: ${interaction.guild.name} / Id: ${interaction.guild.id}. Error: ${error}`
                        );
                        return;
                    }
                }

                if (interaction.customId == 'pause') {
                    try {
                        if (queue.node.isPlaying()) {
                            queue.node.pause();

                            const currentReply = queueController.queueReply[queueController.currentTrackIndex];

                            currentReply.edit(getPausedButtonRow());

                            await interaction.reply(
                                pauseEmbed(queue.currentTrack.raw.title, checkMemberName(interaction.member.nickname, interaction.member.user.username))
                            );

                            setTimeout(async () => {
                                await interaction.deleteReply();

                                return;
                            }, 2500);
                        } else {
                            await interaction.reply({
                                content: 'Bot is already paused!',
                                ephemeral: true,
                            });

                            setTimeout(async () => {
                                await interaction.deleteReply();

                                return;
                            }, 2500);
                        }
                    } catch (error) {
                        console.log(
                            `\nError while pause button was pressed on the server: ${interaction.guild.name} / Id: ${interaction.guild.id}. Error: ${error}`
                        );
                        return;
                    }
                }

                if (interaction.customId == 'resume') {
                    try {
                        if (queue.node.isPaused()) {
                            queue.node.resume();

                            const currentReply = queueController.queueReply[queueController.currentTrackIndex];

                            currentReply.edit(getPlayButtonRow(true));

                            await interaction.reply(
                                resumeEmbed(queue.currentTrack.raw.title, checkMemberName(interaction.member.nickname, interaction.member.user.username))
                            );

                            setTimeout(async () => {
                                await interaction.deleteReply();

                                return;
                            }, 2500);
                        } else {
                            await interaction.reply({
                                content: 'Bot is already playing!',
                                ephemeral: true,
                            });

                            setTimeout(async () => {
                                await interaction.deleteReply();

                                return;
                            }, 2500);
                        }
                    } catch (error) {
                        console.log(
                            `\nError while resume button was pressed on the server: ${interaction.guild.name} / Id: ${interaction.guild.id}. Error: ${error}`
                        );
                        return;
                    }
                }
            });

            return;
        } catch (error) {
            console.log(error);

            return interaction.reply({
                content: `There was an error, please try again. If it persists, report to the developer!.`,
                ephemeral: true,
            });
        }
    },
};
