import React, { useMemo } from 'react';

const TRADING_QUOTES = [
    // Stanley Druckenmiller (10)
    { quote: "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.", author: "Stanley Druckenmiller" },
    { quote: "The way to build long-term returns is through preservation of capital and home runs.", author: "Stanley Druckenmiller" },
    { quote: "I've learned many things from George Soros, but perhaps the most significant is that it's not whether you're right or wrong, but how much you make when you're right.", author: "Stanley Druckenmiller" },
    { quote: "Never, ever invest in the present. It doesn't matter what a company is earning or what they have earned. All that matters is change, and the stock market anticipates change.", author: "Stanley Druckenmiller" },
    { quote: "The biggest mistake investors make is to believe that what happened in the recent past is likely to persist.", author: "Stanley Druckenmiller" },
    { quote: "I think David Tepper is great. Because he always keeps focused on the downside.", author: "Stanley Druckenmiller" },
    { quote: "Be patient, wait for the fat pitch and when the fat pitch comes, swing for the fences.", author: "Stanley Druckenmiller" },
    { quote: "Soros has taught me that when you have tremendous conviction on a trade, you have to go for the jugular.", author: "Stanley Druckenmiller" },
    { quote: "If you're playing poker and there's a lot of money on the table, it's okay to fold sometimes.", author: "Stanley Druckenmiller" },
    { quote: "I like to put all my eggs in one basket and then watch the basket very carefully.", author: "Stanley Druckenmiller" },

    // Jesse Livermore (10)
    { quote: "There is nothing new in Wall Street. Whatever happens today has happened before and will happen again.", author: "Jesse Livermore" },
    { quote: "The market does not beat them. They beat themselves, because though they have brains they cannot sit tight.", author: "Jesse Livermore" },
    { quote: "It never was my thinking that made the big money for me. It always was my sitting.", author: "Jesse Livermore" },
    { quote: "A loss never bothers me after I take it. I forget it overnight. But being wrong and not taking the loss — that is what does the damage.", author: "Jesse Livermore" },
    { quote: "The game of speculation is the most uniformly fascinating game in the world. But it is not a game for the stupid, the mentally lazy, or the person of inferior emotional balance.", author: "Jesse Livermore" },
    { quote: "Men who can both be right and sit tight are uncommon.", author: "Jesse Livermore" },
    { quote: "The desire for constant action irrespective of underlying conditions is responsible for many losses on Wall Street.", author: "Jesse Livermore" },
    { quote: "There is only one side of the market and it is not the bull side or the bear side, but the right side.", author: "Jesse Livermore" },
    { quote: "Do not anticipate and move without market confirmation — being a little late in your trade is your insurance.", author: "Jesse Livermore" },
    { quote: "Successful trading is always an emotional battle for the speculator, not an intellectual one.", author: "Jesse Livermore" },

    // Paul Tudor Jones (10)
    { quote: "The most important rule of trading is to play great defense, not great offense.", author: "Paul Tudor Jones" },
    { quote: "Don't focus on making money; focus on protecting what you have.", author: "Paul Tudor Jones" },
    { quote: "Where you want to be is always in control, never wishing, always trading, and always first and foremost protecting your butt.", author: "Paul Tudor Jones" },
    { quote: "I believe the very best money is made at the market turns.", author: "Paul Tudor Jones" },
    { quote: "At the end of the day, the most important thing is how good are you at risk control.", author: "Paul Tudor Jones" },
    { quote: "Losers average losers.", author: "Paul Tudor Jones" },
    { quote: "I'm always thinking about losing money as opposed to making money.", author: "Paul Tudor Jones" },
    { quote: "Don't be a hero. Don't have an ego. Always question yourself and your ability.", author: "Paul Tudor Jones" },
    { quote: "Every day I assume every position I have is wrong.", author: "Paul Tudor Jones" },
    { quote: "The secret to being successful from a trading perspective is to have an indefatigable and undying thirst for information and knowledge.", author: "Paul Tudor Jones" },

    // Mark Douglas (10)
    { quote: "The best traders think in probabilities, not certainties.", author: "Mark Douglas" },
    { quote: "Trading is a psychological game. Most people think they are playing against the market, but the market doesn't care. You're really playing against yourself.", author: "Mark Douglas" },
    { quote: "The consistency you seek is in your mind, not in the markets.", author: "Mark Douglas" },
    { quote: "If your goal is to trade like a professional and be a consistent winner, then you must start from the premise that the solutions are in your mind and not in the market.", author: "Mark Douglas" },
    { quote: "You don't need to know what is going to happen next in order to make money.", author: "Mark Douglas" },
    { quote: "To whatever degree you haven't accepted the risk, is the same degree to which you will avoid the risk.", author: "Mark Douglas" },
    { quote: "When you genuinely accept the risks, you will be at peace with any outcome.", author: "Mark Douglas" },
    { quote: "The market doesn't generate happy or painful information. From the market's perspective, it's all simply information.", author: "Mark Douglas" },
    { quote: "Trading in the zone means complete acceptance of the risks and a willingness to let go of the trade when it's not working.", author: "Mark Douglas" },
    { quote: "Self-discipline is the ability to control your behavior in accordance with your goals.", author: "Mark Douglas" },

    // Linda Raschke (10)
    { quote: "There are old traders and bold traders, but no old, bold traders.", author: "Linda Raschke" },
    { quote: "The market is like a woman — always commanding, always mysterious, always the final arbiter.", author: "Linda Raschke" },
    { quote: "Cut your losses quickly and let your profits run. It sounds simple, but it's the hardest thing to do.", author: "Linda Raschke" },
    { quote: "Markets can stay irrational longer than you can stay solvent. Always respect the price action.", author: "Linda Raschke" },
    { quote: "The key to trading success is emotional discipline. If intelligence were the key, there would be a lot more people making money trading.", author: "Linda Raschke" },
    { quote: "The best trades work almost right away.", author: "Linda Raschke" },
    { quote: "If you can learn to create a state of mind that is not affected by the market's behavior, the struggle will cease to exist.", author: "Linda Raschke" },
    { quote: "Trade what you see, not what you think.", author: "Linda Raschke" },
    { quote: "The most important thing in making money is not letting your losses get out of hand.", author: "Linda Raschke" },
    { quote: "Every trader has strengths and weaknesses. Some are good holders of winners but may hold on to losers too long.", author: "Linda Raschke" },
];

const TradingQuote = () => {
    const randomQuote = useMemo(() => {
        const index = Math.floor(Math.random() * TRADING_QUOTES.length);
        return TRADING_QUOTES[index];
    }, []);

    return (
        <div className="mb-4 px-4 py-3 bg-neutral-50 dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700">
            <p className="text-neutral-600 dark:text-slate-300 text-sm italic text-center">
                "{randomQuote.quote}"
            </p>
            <p className="text-neutral-400 dark:text-slate-500 text-xs text-center mt-1">
                — {randomQuote.author}
            </p>
        </div>
    );
};

export default TradingQuote;
