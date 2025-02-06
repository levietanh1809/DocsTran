class OpenAIService {
  constructor(apiKey) {
    this.API_KEY = apiKey;
    this.API_URL = 'https://api.openai.com/v1/chat/completions';
    
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
      `
    };
  }

  translate(text, targetLang, domain) {
    if (!text || text.trim() === '') return '';
    
    const payload = {
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `${this.systemPrompts[domain] || this.systemPrompts.general}\nTranslate the following text to ${targetLang}. No explanation, just translate. If can not translate, just keep the original text.`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3
    };

    const options = {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    };

    try {
      const response = UrlFetchApp.fetch(this.API_URL, options);
      const json = JSON.parse(response.getContentText());
      return json.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI Translation error:', error);
      throw error;
    }
  }
} 