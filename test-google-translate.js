import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GOOGLE_TRANSLATE_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_TRANSLATE_KEY not found in .env');
  process.exit(1);
}

// Test with a simple Japanese phrase
const testText = "こんにちは";
const targetLanguage = "en";

const postData = JSON.stringify({
  q: testText,
  target: targetLanguage,
});

const options = {
  hostname: 'translation.googleapis.com',
  path: `/language/translate/v2?key=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Google Translate API key is valid!');
      const response = JSON.parse(data);
      console.log(`\n📝 Test translation:`);
      console.log(`   Input: "${testText}"`);
      console.log(`   Output: "${response.data.translations[0].translatedText}"`);
    } else {
      console.error(`❌ API Error (${res.statusCode}):`);
      console.error(data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

req.write(postData);
req.end();
