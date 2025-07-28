import express from 'express';
import cors from 'cors';
import { extractTextFromPdfFile } from './extractPdf.js'; 
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();



if (!process.env.GROQ_API_KEY) {
  console.error('Error: GROQ_API_KEY environment variable is required');
  process.exit(1);
}



app.use(cors({
    origin: ['http://localhost:5173', 'https://scalo-technologies-assingment-front.vercel.app'],
      credentials: true
}));
app.use(express.json()); 

app.get('/', (req, res) => {
  res.send('API is running');
});

app.post('/ask', async (req, res) => {
  const { question, companyName } = req.body;
    
  if (!question) {
    return res.status(400).json({ error: 'Question is required in request body' });
  }

  try {
    console.log(' Extracting text from PDF...');
    const transcriptWords = await extractTextFromPdfFile(`./pdfFile/${companyName}.pdf`);
    const transcriptText = transcriptWords.join(' ');
    
    console.log(' Calling Groq API...');
    const answer = await callGroq(question, transcriptText);

    return res.json({ answer });
  } catch (err) {
    console.error(' Error processing request:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const callGroq = async (question, transcriptText) => {
    console.log(transcriptText.length, "length")
  try {
    const maxTranscriptLength = 10000; 
    const truncatedTranscript = transcriptText.length > maxTranscriptLength 
      ? transcriptText.substring(0, maxTranscriptLength) + '...' 
      : transcriptText;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
       model: 'llama3-70b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst. Answer only from the transcript provided. If the information is not available in the transcript, say so.'
          },
          {
            role: 'user',
            content: `Transcript:\n${truncatedTranscript}\n\nQuestion: ${question}`
          }
        ],
        temperature: 0.3,
        max_tokens: 512
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error?.message || error.message || 'Unknown error';

    console.error(' Groq API error details:', message);

  
    throw { status, message };
  }
};

export default app