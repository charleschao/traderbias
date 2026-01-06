import React from 'react';

const ExchangeComingSoon = ({ exchange }) => {
    const colorClasses = {
        cyan: { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        purple: { border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10' },
        violet: { border: 'border-violet-500/30', text: 'text-violet-400', bg: 'bg-violet-500/10' },
    };
    const colors = colorClasses[exchange.color] || colorClasses.cyan;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
            <div className={`${colors.bg} ${colors.border} border-2 rounded-3xl p-12 text-center max-w-lg`}>
                <div className="text-6xl mb-4">{exchange.icon}</div>
                <h2 className={`text-3xl font-black mb-2 ${colors.text}`}>{exchange.name}</h2>
                <p className="text-slate-400 text-lg mb-6">{exchange.description}</p>

                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${colors.bg} border ${colors.border}`}>
                    {exchange.status === 'api_required' ? (
                        <>
                            <span className="text-2xl">🔑</span>
                            <span className="font-bold text-white">API Key Required</span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl">🚧</span>
                            <span className="font-bold text-white">Coming Soon</span>
                        </>
                    )}
                </div>

                <p className="text-slate-500 text-sm mt-6">
                    {exchange.statusMessage}
                </p>

                {exchange.status === 'api_required' && (
                    <div className="mt-6 space-y-3">
                        <p className="text-slate-400 text-sm">Features available with API key:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {exchange.features.map(feature => (
                                <span key={feature} className="px-3 py-1 rounded-lg bg-slate-800/50 text-slate-300 text-xs capitalize">
                                    {feature}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {exchange.status === 'coming_soon' && (
                    <a
                        href="https://variational.typeform.com/api-request"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-6 px-6 py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-400 transition-colors"
                    >
                        Join API Waitlist →
                    </a>
                )}
            </div>

            <p className="text-slate-600 text-sm">
                Switch exchanges using the tabs above
            </p>
        </div>
    );
};

export default ExchangeComingSoon;
