import axios from 'axios';

import * as moment from 'moment';

import Datastore = require('nedb-promises');

import { Telegraf, Markup } from 'telegraf';
import { Keyboard, Key } from 'telegram-keyboard';

import {join} from 'path';
import {replyPhoto, resolveImage} from "./cache/images";
import {putSeriesId, resolveSeriesName} from "./resolvers/seriesId";
import {getChapter} from "./cache/chapters";

require("moment/locale/ru");

moment.locale("ru");

interface Subscriber {
    chatId: number;
}

enum Actions {
    NextReleaseDate = "nrd",
    NextReleaseDateBack = "nrdb",

    Series = "s",

    ReadSeries = "rs",
    ReadSeriesViewer = "rsv"
}

interface Callback {
    a: Actions.NextReleaseDate | Actions.NextReleaseDateBack | Actions.Series | Actions.ReadSeries | Actions.ReadSeriesViewer;
    p: any;
}

interface Series {
    key: string;
    name: string;
    cover: string;
    description: string;
    nextReleaseTime: number;
    lastChapter: number;
}

type Chapters = {
    [key: string]: {
        volume: string;
        title: string;
        folder: string;
        groups: { [key: string]: any[] };
    };
};

interface Series {
    next_release_time: number;
    description: string;
    cover: string;

    chapters: Chapters;
}

function fetchSeries(name: string) {
    return new Promise<Series>(resolve => {
        axios.get(`https://guya.moe/api/series/${name}/`).then(r => {
            resolve(r.data);
        });
    });
}

function getChunks(arr: any[], size = 4): Array<any> {
    let r = [];

    for (let i = 0; i < arr.length; i += size)
        r.push(arr.slice(i, i+size));

    return r;
}

function buildKeyboard(data, pagesCount) {
    return Keyboard.make([
        data.p.p > 0 ? data.p.p < pagesCount - 1 ? [Key.callback("Назад", JSON.stringify({
            a: Actions.ReadSeriesViewer,
            p: {
                s: data.p.s,
                c: data.p.c,
                p: data.p.p - 1
            }
        })), Key.callback("Вперед", JSON.stringify({
            a: Actions.ReadSeriesViewer,
            p: {
                s: data.p.s,
                c: data.p.c,
                p: data.p.p + 1
            }
        }))] : [Key.callback("Назад", JSON.stringify({
            a: Actions.ReadSeriesViewer,
            p: {
                s: data.p.s,
                c: data.p.c,
                p: data.p.p - 1
            }
        }))] : [
            Key.callback("Вперед", JSON.stringify({
                a: Actions.ReadSeriesViewer,
                p: {
                    s: data.p.s,
                    c: data.p.c,
                    p: data.p.p + 1
                }
            }))
        ]
    ]).inline();
}

const subscribers = Datastore.create({
    filename: join(process.cwd(), "storage", 'subscribers.db'),
    autoload: true
});

const series = Datastore.create({
    filename: join(process.cwd(), "storage", 'series.db'),
    autoload: true
});

const seriesCache = new Map<string, Pick<Series, "chapters">>();

const bot = new Telegraf(process.env.TOKEN);

bot.start(ctx => updateMenu(ctx, 'Добро пожаловать'));

const updateMenu = (ctx, message: string, subscribed = null) => {
    if (subscribed == null) {
        subscribers.findOne<Subscriber>({ chatId: ctx.message.chat.id }).then(s => {
            ctx.reply(message, Markup.keyboard([
                [ "Читать" ],
                [ "Следующая глава", "Серии" ],
                [ s == null ? "Подписаться" : "Отписаться" ],
            ]).resize(true));
        });
    } else ctx.reply(message, Markup.keyboard([
        [ "Читать" ],
        [ "Следующая глава", "Серии" ],
        [ !subscribed ? "Подписаться" : "Отписаться" ],
    ]).resize(true));
};

bot.command("me", ctx => {
   ctx.reply(`Ваш идентификатор: ${ctx.message.chat.id}`) ;
});

bot.command("menu", ctx => {
    updateMenu(ctx, "Открываю меню");
});

bot.hears([ "Серии", "/series"], ctx => {
    series.find<Series>({}, { name: 1 }).then(s => {
        ctx.reply("Список доступных серий", Keyboard.make(s.map(v => [
            Key.callback(v.name, JSON.stringify({
                a: Actions.Series,
                p: { s: v._id }
            }))
        ])).inline());
    });
});

bot.hears([ "Читать", "/read"], ctx => {
    series.find<Series>({}, { name: 1 }).then(s => {
        ctx.reply("Выберите серию", Keyboard.make(s.map(v => [
            Key.callback(v.name, JSON.stringify({
                a: Actions.ReadSeries,
                p: {
                    s: v._id,
                    cp: 0
                }
            }))
        ])).inline());
    });
});

bot.hears([ "Подписаться", "/subscribe"], ctx => {
    subscribers.findOne({ chatId: ctx.message.chat.id }).then(subscriber => {
        if (subscriber != null) return ctx.reply("Данный чат уже подписан");

        subscribers.insert({ chatId: ctx.message.chat.id }).then(async () => {
            await ctx.reply("Вы были успешно подписаны");
            updateMenu(ctx, 'Обновляю меню', true);
        });
    });
});

bot.hears([ "Отписаться", "/unsubscribe"], ctx => {
    subscribers.findOne({ chatId: ctx.message.chat.id }).then(subscriber => {
        if (subscriber == null) return ctx.reply("Данный чат ещё не был подписан");

        subscribers.remove({ chatId: ctx.message.chat.id }, { multi: false }).then(async () => {
            await ctx.reply("Вы были успешно отписаны");
            updateMenu(ctx, 'Обновляю меню', false);
        });
    });
});

bot.hears([ "Следующая глава", "/next_chapter"], ctx => {
    series.find<Series>({}, { name: 1 }).then(s => {
        ctx.reply("Выберите серию", Keyboard.make(s.map(v => [
            Key.callback(v.name, JSON.stringify({
                a: Actions.NextReleaseDate,
                p: { s: v._id }
            }))
        ])).inline());
    });
});

bot.on("callback_query", ctx => {
    // @ts-ignore
    const data: Callback = JSON.parse(ctx.callbackQuery.data);

    switch (data.a) {
        case Actions.NextReleaseDate:
            series.findOne<Series>({ _id: data.p.s }, { nextReleaseTime: 1, name: 1 }).then(async ({ nextReleaseTime, name }) => {
                const date = moment(nextReleaseTime * 1000);
                await ctx.editMessageText(`Следующая глава из серии "${name}" выйдет ${date.calendar().toLowerCase()}`, Keyboard.make([
                    [ Key.callback("Назад", JSON.stringify({
                        a: Actions.NextReleaseDateBack
                    })) ]
                ]).inline() as any);
                await ctx.answerCbQuery();
            });
            break;

        case Actions.NextReleaseDateBack:
            series.find<Series>({}, { name: 1 }).then(s => {
                ctx.editMessageText("Выберите серию", Keyboard.make(s.map(v => [
                    Key.callback(v.name, JSON.stringify({
                        a: Actions.NextReleaseDate,
                        p: { s: v._id }
                    }))
                ])).inline() as any).then(() => ctx.answerCbQuery());
            });
            break;

        case Actions.Series:
            series.findOne<Series>({ _id: data.p.s }, { description: 1, cover: 1 }).then(async ({ description, cover }) => {
                await replyPhoto(ctx, cover, {
                    caption: description
                });

                await ctx.answerCbQuery();
            });
            break;

        case Actions.ReadSeries:
            if (data.p.c == null) {
                const { chapters } = seriesCache.get(resolveSeriesName(data.p.s));

                const keys = Object.keys(chapters);
                const chunks = getChunks(keys);
                const buttons = chunks.slice(data.p.cp, data.p.cp + 3).map(chunk => chunk.map((chapter) => Key.callback(chapter, JSON.stringify({
                    a: Actions.ReadSeries,
                    p: {
                        s: data.p.s,
                        c: chapter,
                        p: 0
                    }
                }))));

                buttons.push(data.p.cp > 0 ? [ Key.callback("Назад", JSON.stringify({
                    a: Actions.ReadSeries,
                    p: {
                        s: data.p.s,
                        cp: data.p.cp - 1
                    }
                })), Key.callback("Вперед", JSON.stringify({
                    a: Actions.ReadSeries,
                    p: {
                        s: data.p.s,
                        cp: data.p.cp + 1
                    }
                })) ] : [ Key.callback("Вперед", JSON.stringify({
                    a: Actions.ReadSeries,
                    p: {
                        s: data.p.s,
                        cp: data.p.cp + 1
                    }
                }))
                ]);

                ctx.editMessageText(`Выберите главу (${keys.length} всего).\nСтраница ${data.p.cp+1} из ${chunks.length}`, Keyboard.make(buttons).inline() as any);
                ctx.answerCbQuery();
            } else if (data.p.p != null) { // Если задана страница
                const seriesName = resolveSeriesName(data.p.s);

                getChapter(seriesName, data.p.c).then(pages => {
                    resolveImage(`https://guya.moe/media/manga/${seriesName}/chapters/${pages[data.p.p]}`).then(rctx => {
                        const keyboard = buildKeyboard(data, pages.length);

                        if (rctx.method === "buffer") {
                            ctx.replyWithPhoto({ source: rctx.data }, keyboard).then(async r => {
                                // @ts-ignore
                                await ctx.deleteMessage(ctx.update.callback_query.message.message_id);
                                await rctx.put(r.photo[0].file_id);
                            }).then(() => ctx.answerCbQuery());
                        } else { // @ts-ignore
                            ctx.replyWithPhoto(rctx.data, keyboard).then(() => ctx.deleteMessage(ctx.update.callback_query.message.message_id)).then(() => ctx.answerCbQuery());
                        }
                    });
                });
            }
            break;

        case Actions.ReadSeriesViewer:
            const seriesName = resolveSeriesName(data.p.s);

            getChapter(seriesName, data.p.c).then(async pages => {
                const keyboard = buildKeyboard(data, pages.length);
                const url = `https://guya.moe/media/manga/${resolveSeriesName(data.p.s)}/chapters/${pages[data.p.p]}`;

                resolveImage(url).then(r => {
                    if (r.method === "buffer") {
                        ctx.editMessageMedia({ type: "photo", media: { source: r.data } }, keyboard as any).then((a: any) => {
                            r.put(a.photo[0].file_id).then(() => ctx.answerCbQuery());
                        });
                    }
                    else ctx.editMessageMedia({ type: "photo", media: r.data }, keyboard as any).then(() => ctx.answerCbQuery());
                });
            });
            break;

        default:
            ctx.reply("Неверные данные");
            ctx.answerCbQuery();
            break;
    }
});

bot.launch().then(async () => {
    async function start(check = false) {
        series.find<Series>({}, { key: 1 }).then(list => {
            list.forEach(({ key, _id }) => {
                putSeriesId(key, _id); // Для более быстрого доступа в будущем

                fetchSeries(key).then(s => {
                    seriesCache.set(key, {
                        chapters: s.chapters
                    }); // Держим в памяти

                    const chapters = Object.keys(s.chapters).map(e => (parseInt(e))).sort((a,b) => (a - b));

                    if (check) {
                        series.findOne<Series>({ key }, { name: 1, lastChapter: 1 }).then(({ name, lastChapter }) => {
                            if (lastChapter < chapters[chapters.length - 1]) {
                                subscribers.find<Subscriber>({}).then(subs => {
                                    lastChapter = chapters[chapters.length - 1];

                                    series.update<Series>({ key }, {
                                        $set: {
                                            lastChapter,
                                            nextReleaseTime: s.next_release_time
                                        }
                                    }).then(() => {
                                        Promise.all(subs.map(sub => bot.telegram.sendMessage(sub.chatId, `Вышла глава №${lastChapter} из серии ${name}`)));
                                    });
                                });
                            }
                        });
                    } else {
                        let lastChapter = chapters[chapters.length - 1];
                        let nextReleaseTime = s.next_release_time;

                        series.update<Series>({ key }, {
                            $set: {
                                lastChapter,
                                nextReleaseTime
                            }
                        }).then(() => {
                            setTimeout(() => {
                                setInterval(() => {
                                    start(true);
                                }, 60 * 1000);
                            }, nextReleaseTime - moment().unix());
                        });
                    }
                });
            });
        });
    }

    await bot.telegram.sendMessage(390252332, "Бот запущен");
    await start();
});

bot.catch(async (err: Error, ctx) => {
    await bot.telegram.sendMessage(390252332, err.stack);

    if (ctx.chat.id !== 390252332) await ctx.reply(`Произошла ошибка. Я сообщу об этом администратору`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
