import { Bot, InlineKeyboard } from 'grammy';
import { config } from './config.js';

export function startBot(): void {
  if (!config.publicUrl) {
    console.warn('PUBLIC_URL is not set, bot is not started');
    return;
  }
  const bot = new Bot(config.botToken);
  bot.command('start', (ctx) =>
    ctx.reply('Твоя уникальная иконка ждёт тебя!', {
      reply_markup: new InlineKeyboard().webApp('Открыть', config.publicUrl),
    }),
  );
  bot.catch((e) => console.error('bot error', e.message));
  void bot.start();
}
