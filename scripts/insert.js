const Datastore = require("nedb-promises");

const data = [
    {
        name: "Кагуя хочет чтобы ей признались",
        key: "Kaguya-Wants-To-Be-Confessed-To",
        cover: "http://guya.moe/media/manga/Kaguya-Wants-To-Be-Confessed-To/volume_covers/21/1000.png",
        description: "Шиномия Кагуя и Широгане Миюки — члены школьного совета невероятно престижной Академии Шучиин, признанные гениями из гениев. Всё время, проведённое вместе, послужило поводом разобраться в чувствах к друг другу, но их гордость не позволит ни одному из них признаться и покориться другому в отношениях! Любовь — это война, это битва с целью заставить другого признаться!"
    },
    {
        name: "Мы хотим поговорить о Кагуе",
        key: "We-Want-To-Talk-About-Kaguya",
        cover: "http://guya.moe/media/manga/We-Want-To-Talk-About-Kaguya/volume_covers/4/image0.png",
        description: "Ответвление сюжета манги \"Кагуя хочет, чтобы ей признались: Гении — война любви и разума\". Взгляд со стороны двух участниц клуба журналистики, которые боготворят Кагую, но совершенно не представляют, что на самом деле происходит в комнате студенческого совета."
    }
];

const series = Datastore.create({
    filename: 'series.db'
});

series.load().then(() => {
    data.forEach(e => series.insert(e));
});
