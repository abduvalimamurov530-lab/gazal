import { GoogleGenAI, Type } from '@google/genai';
import { CANONICAL_GHAZALS } from '../../src/data/canonicalGhazals';

// Shared AI logic used by the Netlify Functions (production) and the local Express dev server.
// On Netlify, AI Gateway injects the Gemini credentials automatically, so no API key is needed here.

export interface ApiResult {
  status: number;
  body: unknown;
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({});
  }
  return aiClient;
}

// Prioritize gemini-3.1-flash-lite for fast responses, fall back to gemini-3.8-flash
const MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

async function generateWithFallback(options: { contents: any; config: any }) {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      console.log(`[Gemini API] Model ${model} vaqtincha band, keyingi modelga oʻtilmoqda... (${errMsg.slice(0, 70)})`);
    }
  }

  throw lastError ?? new Error('Gemini modelidan javob olinmadi.');
}

function findCanonicalGhazalMatch(text: unknown) {
  if (!text || typeof text !== 'string') return null;
  const cleanInput = text.toLowerCase().replace(/[^a-zʻʼoʻgʻ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanInput) return null;
  for (const g of CANONICAL_GHAZALS) {
    const cleanFirstLine = g.firstLine.toLowerCase().replace(/[^a-zʻʼoʻgʻ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanInput.includes(cleanFirstLine.slice(0, 15)) || cleanFirstLine.includes(cleanInput.slice(0, 15))) {
      return g;
    }
  }
  return null;
}

const ANALYZE_SYSTEM_INSTRUCTION = `Siz oʻzbek mumtoz adabiyoti, gʻazalshunoslik va aruz ilmi boʻyicha oliy toifali akademik mutaxassis-olimsiz. Faoliyatingiz professor Najmiddin Komilov («Tasavvuf»), dotsent Dilnavoz Yusupova («Istiqlol davri oʻzbek navoiyshunosligi»), Erkin Vohidov («Navoiy gulshani») hamda «Gʻazallar, sharhlar» (1991) fundamental manbalari asosida olib boriladi.

QATʼIY VAZIFA VA TALABLAR:
Foydalanuvchi qaysi shoirning (Alisher Navoiy, Bobur, Lutfiy, Atoiy, Sakkokiy, Mashrab, Ogahiy, Fuzuliy, Amiriy, Nodira, Uvaysiy, Munis, Furqat, Muqimiy yoki boshqa har qanday mumtoz/zamonaviy shoir) gʻazalini yubormasin:

1. HAR BIR BAYTGA ALOHIDA VA MUKAMMAL TAHLIL:
   - Gʻazaldagi HAR BIR BAYT (1-matlaʼ baytidan to soʻnggi maqtaʼ baytigacha) birontasi ham tushirib qoldirilmasdan, qisqartirilmasdan «couplets» massivida toʻliq tahlil qilinishi SHART. Agar gʻazal 7 bayt boʻlsa — 7 ta bayt, 9 bayt boʻlsa — 9 ta bayt alohida tahlil qilinadi.
   - Har bir bayt uchun:
     a) «originalText»: Asl baytning 2 misrasi (aniq va toʻliq).
     b) «proseTranslation»: Ushbu baytning zamonaviy oʻzbek adabiy tilidagi mukammal, ravon va teran nasriy bayoni (shunchaki soʻzma-soʻz tarjima emas, balki baytning chuqur badiiy maʼnosini ochuvchi sharh).
     c) «poeticArts»: Baytdagi BARCHA sheʼriy sanʼatlar (Tashbeh va uning turlari, Tajnis, Tazod/Tiboq, Talmeh, Husni taʼlil, Iyhom, Tashxis, Intoq, Tanosub/Murooti naziir, Musajjaʼ, Tardi aks, Irsoli masal, Kitobat, Rujuʼ va h.k.). Har bir sanʼat uchun:
        - «name»: Sanʼat nomi.
        - «targetWords»: Sanʼat hosil boʻlgan aniq soʻzlar.
        - «explanation»: Ushbu sanʼat qanday maʼno nozikligi yaratgani, shoirning estetik niyati va psixologik taʼsiri ilmiy asosda tushuntirilishi shart.
     d) «literalMeaning»: Zohiriy (oshikona, dunyoviy, insoniy muhabbat, maʼshuqa husni, hijron iztiroblari) qatlam talqini.
     e) «sufiMeaning»: Botiniy (irfoniy, tasavvufiy, ilohiy ishq, Vahdatul vujud, solik, nafs riyozati, maʼrifat, fano va baqo) qatlam talqini.

2. GʻAZAL PASPORTI VA SHARHI ALFOZ:
   - Shoiri, mavzuviy janri (oshiqona, orifona, rindona, hasbi hol), kompozitsion tuzilishi (musalsal, voqeaband, parokanda).
   - Aruz vazni va bahri (bahr nomi, ruknlari, V/- taqtiʼ qolipi, vaznning ruhiy-ritmik taʼsiri).
   - Qofiya va radif tizimi (radif, qofiya soʻzlari, qofiya turlari).
   - Sharhi alfoz: Matndagi har bir qiyin arabiy, forsiy va qadimiy turkiy soʻzlarning lugʻaviy hamda irfoniy-ramziy maʼnosi.

3. GʻOYAVIY MAZMUN VA «KOSA TAGIDAGI NIMKOSA»:
   - Gʻazalning bosh falsafiy gʻoyasi, shoirning pinhona sirlari (tagmatn), axloqiy-tarbiyaviy xulosasi.

Javobni quyidagi JSON sxemasiga qatʼiy mos ravishda taqdim eting.`;

const ANALYZE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    poet: { type: Type.STRING, description: 'Gʻazal muallifi' },
    title: { type: Type.STRING, description: 'Gʻazal sarlavhasi yoki matlaʼsi' },
    genre: { type: Type.STRING, description: 'Janr va mavzuviy yoʻnalishi' },
    compositionType: { type: Type.STRING, description: 'Kompozitsion turi: Musalsal, Yakpora, Voqeaband yoki Mustaqil baytli' },
    meter: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Aruz vazni va bahri' },
        rukns: { type: Type.STRING, description: 'Ruknlari' },
        pattern: { type: Type.STRING, description: 'Taqtiʼ va boʻgʻinlar qolipi (V va -)' },
        rhythmEffect: { type: Type.STRING, description: 'Ritmik taʼsiri va maʼnoga uygʻunligi' },
      },
      required: ['name', 'rukns', 'pattern', 'rhythmEffect'],
    },
    rhymeAndRadif: {
      type: Type.OBJECT,
      properties: {
        radif: { type: Type.STRING, description: 'Radif soʻzi yoki iborasi' },
        qofiyaWords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Qofiyadosh soʻzlar roʻyxati',
        },
        rhymeType: { type: Type.STRING, description: 'Qofiya va radifning badiiy vazifasi' },
      },
      required: ['radif', 'qofiyaWords', 'rhymeType'],
    },
    vocabulary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: 'Soʻz' },
          definition: { type: Type.STRING, description: 'Lugʻaviy maʼnosi' },
          origin: { type: Type.STRING, description: 'Kelib chiqishi (arabcha, forscha, eski oʻzbekcha)' },
          symbolism: { type: Type.STRING, description: 'Tasavvufiy/ramziy maʼnosi (agar boʻlsa)' },
        },
        required: ['word', 'definition'],
      },
      description: 'Gʻazaldagi qiyin va istilohiy soʻzlar lugʻati',
    },
    couplets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.INTEGER, description: 'Bayt tartib raqami' },
          originalText: { type: Type.STRING, description: 'Asl bayt matni (2 misra)' },
          proseTranslation: { type: Type.STRING, description: 'Zamonaviy nasriy bayoni' },
          poeticArts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'Sanʼat nomi (Tashbeh, Tajnis, Tazod, Talmeh, Husni taʼlil va h.k.)' },
                targetWords: { type: Type.STRING, description: 'Sanʼat qoʻllangan aniq soʻzlar' },
                explanation: { type: Type.STRING, description: 'Sanʼatning tushuntirilishi va vazifasi' },
              },
              required: ['name', 'targetWords', 'explanation'],
            },
            description: 'Baytdagi sheʼriy sanʼatlar',
          },
          literalMeaning: { type: Type.STRING, description: 'Zohiriy (insoniy/majoziy/oshiqona) maʼnosi va lirik qahramon ruhiyati' },
          sufiMeaning: { type: Type.STRING, description: 'Botiniy (irfoniy/tasavvufiy/falsafiy/ilohiy ishq va Vahdatul vujud) maʼnosi' },
        },
        required: ['number', 'originalText', 'proseTranslation', 'poeticArts', 'literalMeaning', 'sufiMeaning'],
      },
      description: 'Baytma-bayt chuqur akademik tahlil (har bir bayt uchun toʻliq)',
    },
    overallMeaning: { type: Type.STRING, description: 'Gʻazalning umumiy gʻoyaviy-falsafiy mazmuni' },
    nimkosaSubtext: { type: Type.STRING, description: 'Kosa tagidagi nimkosa (tagmatn va sirlar)' },
    didacticConclusion: { type: Type.STRING, description: 'Axloqiy-tarbiyaviy va maʼnaviy xulosa' },
  },
  required: [
    'poet',
    'title',
    'genre',
    'compositionType',
    'meter',
    'rhymeAndRadif',
    'vocabulary',
    'couplets',
    'overallMeaning',
    'nimkosaSubtext',
    'didacticConclusion',
  ],
};

const SCHOLAR_SYSTEM_INSTRUCTION = `Siz mumtoz adabiyot, gʻazalshunoslik, aruz va tasavvuf boʻyicha ulugʻ oʻzbek mutaxassis-olimisiz. Siz bilan adabiyot ixlosmandi suhbatlashmoqda.
Siz muloyim, hurmatli, teran ilmiy asoslarga tayanib, Alisher Navoiy, Lutfiy, Bobur asarlari va ularning sharhlovchilari (Najmiddin Komilov, Dilnavoz Yusupova, Erkin Vohidov) maktabi asosida javob berasiz.
Agar foydalanuvchi biror soʻz, sheʼriy sanʼat (tashbeh, tajnis, tazod, talmeh, iyhom, husni taʼlil va b.), aruz vazni yoki tasavvufiy ramz haqida soʻrasa, uni misollar bilan loʻnda va aniq ochib bering.`;


export async function analyzeGhazal(payload: any): Promise<ApiResult> {
  const { ghazalText, author, specificQuestions } = payload || {};

  if (!ghazalText || typeof ghazalText !== 'string' || !ghazalText.trim()) {
    return { status: 400, body: { error: 'Gʻazal matni kiritilmadi.' } };
  }

  try {
    const prompt = `Quyidagi gʻazalni yuqoridagi ilmiy manbalar (Najmiddin Komilov, Dilnavoz Yusupova, Erkin Vohidov, «Gʻazallar, sharhlar») uslubida, HAR BIR BAYTINI ALOHIDA-ALOHIDA toʻliq va chuqur tahlil qilib bering:\n\n${ghazalText}\n\n${author ? `Muallif haqida: ${author}` : ''}\n${specificQuestions ? `Qoʻshimcha eʼtibor qaratiladigan jihat: ${specificQuestions}` : ''}`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        systemInstruction: ANALYZE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        responseSchema: ANALYZE_RESPONSE_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini modelidan javob olinmadi.');
    }

    return { status: 200, body: JSON.parse(text) };
  } catch (error: any) {
    console.error('Tahlil xatosi:', error);

    // If input matches any canonical ghazal, return it as verified academic fallback
    const match = findCanonicalGhazalMatch(ghazalText);
    if (match) {
      console.log(`[Fallback] Server kanonik tahlil taqdim etdi: ${match.title}`);
      return {
        status: 200,
        body: {
          id: match.id,
          title: match.title,
          poet: match.poet,
          genre: match.genre,
          compositionType: match.compositionType,
          meter: match.meter,
          rhymeAndRadif: match.rhymeAndRadif,
          vocabulary: match.vocabulary,
          couplets: match.couplets,
          overallMeaning: match.overallMeaning,
          nimkosaSubtext: match.nimkosaSubtext,
          didacticConclusion: match.didacticConclusion,
          commentator: match.commentator,
          sourceBook: match.sourceBook,
        },
      };
    }

    const rawMsg = error?.message || '';
    let friendlyError = 'Gʻazal tahlilida kutilmagan xatolik yuz berdi.';
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
      friendlyError =
        'AI modeli ayni daqiqalarda yuqori yuklanish holatida (503 - High Demand). Bu vaqtinchalik holat boʻlib, bir necha soniyadan soʻng avtomatik tiklanadi. Iltimos, "Qayta urinish" tugmasini bosing.';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      friendlyError = 'Soʻrovlar chegarasi toʻldi (429 - Rate limit). Iltimos, 10-15 soniya kutib qayta urinib koʻring.';
    }

    return { status: 503, body: { error: friendlyError } };
  }
}

export async function askScholar(payload: any): Promise<ApiResult> {
  const { question, contextGhazal, coupletIndex } = payload || {};

  if (!question || typeof question !== 'string' || !question.trim()) {
    return { status: 400, body: { error: 'Savol kiritilmadi.' } };
  }

  try {
    const promptText = `Kontekstdagi gʻazal:
${contextGhazal ? contextGhazal : 'Umumiy mumtoz adabiyot savoli'}
${typeof coupletIndex === 'number' ? `Diqqat qaratilgan bayt raqami: ${coupletIndex + 1}` : ''}

Foydalanuvchi savoli:
${question}`;

    const response = await generateWithFallback({
      contents: promptText,
      config: {
        systemInstruction: SCHOLAR_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return { status: 200, body: { answer: response.text } };
  } catch (error: any) {
    console.error('Olim javobida xatolik:', error);
    const rawMsg = error?.message || '';
    let friendlyError = 'Savolga javob tayyorlashda xatolik yuz berdi.';
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
      friendlyError = 'AI modeli ayni paytda yuqori yuklanish holatida (503). Iltimos, bir necha soniyadan soʻng savolni qayta yoʻllang.';
    }
    return { status: 503, body: { error: friendlyError } };
  }
}
