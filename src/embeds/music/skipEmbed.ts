import { InteractionReplyOptions } from 'discord.js';

export default (songTitle: string, userNickname: string) => {
    return {
        embeds: [
            {
                footer: {
                    text: `Skipped by: ${userNickname}.`,
                    icon_url: '',
                },
                author: {
                    name: 'Slay_404',
                    icon_url: '',
                },
                color: 15418782,
                type: 'rich',
                description: `⏭️ | The song has been skipped.`,
                title: 'Meowdy Partner - Music',
            },
        ],
    } as InteractionReplyOptions;
};
