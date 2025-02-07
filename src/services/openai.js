const { OpenAI } = require('openai');

class OpenAIService {
    constructor(apiKey = null) {
        const key = apiKey || process.env.OPENAI_API_KEY;
        
        if (!key) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        // Chỉ validate format khi là custom API key
        if (apiKey && !apiKey.match(/^sk-[a-zA-Z0-9_-]{32,}$/)) {
            throw new Error('OpenAI API key không hợp lệ');
        }

        this.client = new OpenAI({
            apiKey: key
        });
        
        // Thêm system prompt cho từng loại domain
        this.systemPrompts = {
            technical: `
                Quy tắc dịch:
                -Lĩnh vực công nghệ.
                -Bảo đảm sự tinh tế, đúng ngữ cảnh và cảm xúc trong bản dịch.
                -Đọc kỹ ngữ cảnh của toàn câu trước khi dịch, tránh dịch từng từ riêng lẻ.
                Phong cách dịch:
                -Giữ sự tự nhiên và tính bản địa.
                Cập nhật nội dung quan trọng:
                -Không tự động làm nổi bật hoặc bôi đậm nội dung trong bản dịch.
                -Ensure no parts of the text are skipped or left untranslated
                -Be meticulous and thorough when translating each section
            `,
            general: `
                Quy tắc dịch chung:
                - Dịch chính xác và tự nhiên
                - Giữ nguyên các thuật ngữ chuyên môn
                - Đảm bảo tính nhất quán trong bản dịch
            `,
            // Thêm các domain khác nếu cần
        };

        // Sử dụng gpt-4o-mini làm model mặc định
        this.defaultModel = {
            id: 'gpt-4o-mini',  // GPT-4 Mini
            name: 'GPT-4 Mini',
            pricing: {
                input: 0.01,   // $0.01 per 1K tokens
                output: 0.03   // $0.03 per 1K tokens
            }
        };

        // Thêm thông tin về các model khác để tham khảo
        this.availableModels = {
            'gpt-4o-mini': {
                name: 'GPT-4 Mini',
                pricing: {
                    input: 0.01,
                    output: 0.03
                }
            },
            'gpt-4': {
                name: 'GPT-4',
                pricing: {
                    input: 0.03,
                    output: 0.06
                }
            },
            'gpt-3.5-turbo': {
                name: 'GPT-3.5 Turbo',
                pricing: {
                    input: 0.0015,
                    output: 0.002
                }
            }
        };

        this.requestQueue = [];
        this.isProcessing = false;
        this.MAX_CONCURRENT_REQUESTS = 5; // Số request đồng thời tối đa

        // Cache cho kết quả dịch
        this.translationCache = new Map();
    }

    // Lấy danh sách models và giá
    async getModelsWithPricing() {
        try {
            const models = await this.client.models.list();
            const availableModels = models.data
                .filter(model => ['gpt-4', 'gpt-3.5-turbo'].includes(model.id))
                .map(model => ({
                    id: model.id,
                    name: model.id === 'gpt-4' ? 'GPT-4 (Chất lượng cao)' : 'GPT-3.5 (Tiêu chuẩn)',
                    pricing: this.modelPrices[model.id]
                }));
            
            return availableModels;
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }

    async translate(text, targetLang, domain) {
        // Tạo cache key
        const cacheKey = `${text}_${targetLang}_${domain}`;
        
        // Kiểm tra cache
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }

        // Thực hiện dịch nếu chưa có trong cache
        const result = await this._translate(text, targetLang, domain);
        
        // Lưu vào cache
        this.translationCache.set(cacheKey, result);
        
        return result;
    }

    async _translate(text, targetLang, domain) {
        try {
            // Bỏ qua dịch nếu text trống
            if (!text || text.trim() === '') {
                return '';
            }

            const completion = await this.client.chat.completions.create({
                model: this.defaultModel.id,
                messages: [
                    {
                        role: "system",
                        content: `${this.systemPrompts[domain] || this.systemPrompts.general}\nTranslate the following text to ${targetLang}.No explanation, just translate.If can not translate, just keep the original text.`
                    },
                    {
                        role: "user",
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000,
                presence_penalty: 0,
                frequency_penalty: 0
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('OpenAI Translation error:', error);
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
        const totalCost = inputCost + outputCost;

        return {
            model: this.defaultModel.name,
            inputCost,
            outputCost,
            totalCost,
            details: {
                inputTokens: estimatedInputTokens,
                outputTokens: estimatedOutputTokens,
                inputRate: `$${pricing.input}/1K tokens`,
                outputRate: `$${pricing.output}/1K tokens`
            }
        };
    }
}

// Export cả instance mặc định và class
module.exports = new OpenAIService();
module.exports.OpenAIService = OpenAIService; 