const { OpenAI } = require('openai');

class OpenAIService {
    constructor(apiKey = null) {
        const key = apiKey || process.env.OPENAI_API_KEY;
        
        if (!key) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        // Validate custom API key
        if (apiKey && !apiKey.match(/^sk-[a-zA-Z0-9_-]{32,}$/)) {
            throw new Error('OpenAI API key không hợp lệ');
        }

        this.client = new OpenAI({ apiKey: key });
        
        // System prompts
        this.systemPrompts = {
            technical: 'Technical domain. Keep terms. No explanation.',
            general: 'Natural translation. Keep terms.'
        };

        // Default model config
        this.defaultModel = {
            id: 'gpt-4o-mini',
            name: 'GPT-4 Mini',
            pricing: {
                input: 0.01,
                output: 0.03
            }
        };

        // Rate limiting
        this.requestCount = 0;
        this.resetTime = Date.now() + 60000;
        this.rateLimit = 50;

        // Cache with TTL
        this.cache = new Map();
        this.cacheTTL = 60 * 60 * 1000; // 1 hour
    }

    async translate(text, targetLang, domain, customPrompt) {
        const cacheKey = `${text}_${targetLang}_${domain}`;
        
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.translation;
        }

        // Translate if not in cache
        const translation = await this._translate(text, targetLang, domain, customPrompt);
        
        // Save to cache
        this.cache.set(cacheKey, {
            translation,
            timestamp: Date.now()
        });

        return translation;
    }

    async _translate(text, targetLang, domain, customPrompt) {
        // Check rate limit
        if (Date.now() >= this.resetTime) {
            this.requestCount = 0;
            this.resetTime = Date.now() + 60000;
        }

        if (this.requestCount >= this.rateLimit) {
            const delay = this.resetTime - Date.now();
            await new Promise(resolve => setTimeout(resolve, delay));
            return this._translate(text, targetLang, domain, customPrompt);
        }

        try {
            if (!text || text.trim() === '') return '';

            this.requestCount++;
            const completion = await this.client.chat.completions.create({
                model: this.defaultModel.id,
                messages: [
                    {
                        role: "system",
                        content: `Translate to ${targetLang} apply the following rules:.${this.systemPrompts[domain] || this.systemPrompts.general}\n${customPrompt}\n. If cannot translate, keep original text.`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });
            console.log('Translation Request:', {
                model: this.defaultModel.id,
                messages: [
                    {
                        role: "system",
                        content: `Translate to ${targetLang} apply the following rules:.${this.systemPrompts[domain] || this.systemPrompts.general}\n${customPrompt}\n. If cannot translate, keep original text.`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            if (error.response?.status === 429) {
                const delay = parseInt(error.response.headers['retry-after'] || '5') * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this._translate(text, targetLang, domain, customPrompt);
            }
            throw error;
        }
    }

    // Tính giá dựa trên số ký tự
    calculatePrice(chars) {
        const estimatedInputTokens = Math.ceil(chars * 0.4);
        const estimatedOutputTokens = Math.ceil(chars * 0.6);
        const { pricing } = this.defaultModel;

        const inputCost = estimatedInputTokens * pricing.input / 1000;
        const outputCost = estimatedOutputTokens * pricing.output / 1000;

        return {
            model: this.defaultModel.name,
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
            details: {
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                inputRate: `$${pricing.input}/1K tokens`,
                outputRate: `$${pricing.output}/1K tokens`
            }
        };
    }
}

module.exports = new OpenAIService();
module.exports.OpenAIService = OpenAIService; 