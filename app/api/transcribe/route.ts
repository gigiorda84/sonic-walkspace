import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'it';
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Check if OpenAI API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('🔑 API Key check:', apiKey ? `Found (length: ${apiKey.length})` : 'NOT FOUND');
    
    if (!apiKey) {
      console.warn('OpenAI API key not found, using fallback transcription');
      return await fallbackTranscription(audioFile, language);
    }

    try {
      // Create FormData for OpenAI API
      const openaiFormData = new FormData();
      openaiFormData.append('file', audioFile);
      openaiFormData.append('model', 'whisper-1');
      openaiFormData.append('language', language);
      openaiFormData.append('response_format', 'verbose_json');
      openaiFormData.append('timestamp_granularities[]', 'word');

      // Call OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: openaiFormData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenAI API Error:', response.status, response.statusText, errorBody);
        
        let errorMessage = `OpenAI API error: ${response.statusText}`;
        if (response.status === 429) {
          errorMessage += ' (Rate limit exceeded - quota reached)';
        } else if (response.status === 401) {
          errorMessage += ' (Invalid API key)';
        } else if (response.status === 402) {
          errorMessage += ' (Payment required - no credits)';
        }
        
        throw new Error(errorMessage);
      }

      const transcription = await response.json();
      
      // Convert OpenAI response to SRT format
      const srtEntries = convertOpenAIToSRT(transcription);
      
      return NextResponse.json({
        success: true,
        entries: srtEntries,
        source: 'openai-whisper',
        duration: transcription.duration
      });

    } catch (openaiError) {

        console.warn('🚨 OpenAI API failed, using fallback:', openaiError);
      const fallbackResult = await fallbackTranscription(audioFile, language);
      
      // Add specific warning based on error type
      const errorMsg = openaiError instanceof Error ? openaiError.message : 'Unknown error';
      let warningMessage = 'OpenAI API non disponibile. Usata simulazione intelligente.';
      
      if (errorMsg.includes('Rate limit') || errorMsg.includes('Too Many Requests')) {
        warningMessage = 'Quota OpenAI esaurita. Riprova più tardi per trascrizione AI.';
      } else if (errorMsg.includes('Invalid API key')) {
        warningMessage = 'Chiave API OpenAI non valida. Controlla configurazione.';
      } else if (errorMsg.includes('Payment required')) {
        warningMessage = 'Account OpenAI senza crediti. Aggiungi fondi per AI.';
      }
      
      // Add warning to the response
      const response = await fallbackResult.json();
      return NextResponse.json({
        ...response,
        warning: warningMessage,
        openaiError: errorMsg
      });
    }

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio file' },
      { status: 500 }
    );
  }
}

// Fallback transcription using Web Speech API simulation
async function fallbackTranscription(audioFile: File, language: string) {
  try {
    // Get audio duration using audio analysis
    const audioBuffer = await audioFile.arrayBuffer();
    const audioDuration = await getAudioDuration(audioBuffer);
    
    // Generate realistic mock transcription based on audio duration
    const mockEntries = generateMockTranscription(audioDuration, language);
    
    return NextResponse.json({
      success: true,
      entries: mockEntries,
      source: 'fallback-mock',
      duration: audioDuration,
      warning: 'Using mock transcription. Add OPENAI_API_KEY for real speech-to-text.'
    });

  } catch (error) {
    console.error('Fallback transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio file even with fallback' },
      { status: 500 }
    );
  }
}

// Convert OpenAI Whisper response to SRT entries
function convertOpenAIToSRT(transcription: any) {
  const entries = [];
  
  if (transcription.words && transcription.words.length > 0) {
    // Use word-level timestamps for better accuracy
    let currentEntry = {
      id: 1,
      startTime: '',
      endTime: '',
      text: ''
    };
    
    const wordsPerSegment = 8; // Average words per subtitle segment
    let wordCount = 0;
    let segmentId = 1;
    
    for (let i = 0; i < transcription.words.length; i++) {
      const word = transcription.words[i];
      
      if (wordCount === 0) {
        // Start new segment
        currentEntry = {
          id: segmentId,
          startTime: formatTimestamp(word.start),
          endTime: formatTimestamp(word.end),
          text: word.word.trim()
        };
      } else {
        // Add word to current segment
        currentEntry.text += ' ' + word.word.trim();
        currentEntry.endTime = formatTimestamp(word.end);
      }
      
      wordCount++;
      
      // End segment when we have enough words or at punctuation
      if (wordCount >= wordsPerSegment || 
          word.word.includes('.') || 
          word.word.includes('!') || 
          word.word.includes('?') ||
          i === transcription.words.length - 1) {
        
        entries.push({ ...currentEntry });
        segmentId++;
        wordCount = 0;
      }
    }
  } else if (transcription.segments) {
    // Use segment-level timestamps as fallback
    transcription.segments.forEach((segment: any, index: number) => {
      entries.push({
        id: index + 1,
        startTime: formatTimestamp(segment.start),
        endTime: formatTimestamp(segment.end),
        text: segment.text.trim()
      });
    });
  } else {
    // Single text block - split artificially
    const text = transcription.text || '';
    const duration = transcription.duration || 30;
    const segments = splitTextIntoSegments(text, duration);
    
    segments.forEach((segment, index) => {
      entries.push({
        id: index + 1,
        startTime: formatTimestamp(segment.start),
        endTime: formatTimestamp(segment.end),
        text: segment.text
      });
    });
  }
  
  return entries;
}

// Format timestamp to SRT format (HH:MM:SS,mmm)
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Get audio duration from buffer (server-side compatible)
async function getAudioDuration(audioBuffer: ArrayBuffer): Promise<number> {
  try {
    // Server-side estimation based on file size and common bitrates
    const fileSizeMB = audioBuffer.byteLength / (1024 * 1024);
    
    // Common bitrates: 128kbps = ~1MB per minute, 320kbps = ~2.5MB per minute
    // Average estimate: ~1.5MB per minute for typical audio
    const estimatedMinutes = fileSizeMB / 1.5;
    const estimatedSeconds = estimatedMinutes * 60;
    
    // Ensure reasonable bounds (minimum 5 seconds, maximum based on file size)
    return Math.max(5, Math.min(estimatedSeconds, fileSizeMB * 10));
    
  } catch (error) {
    console.warn('Could not estimate audio duration, using fallback');
    // Very basic fallback
    const fileSizeMB = audioBuffer.byteLength / (1024 * 1024);
    return Math.max(10, fileSizeMB * 8);
  }
}

// Generate mock transcription for fallback
function generateMockTranscription(duration: number, language: string) {
  const entries = [];
  const segmentDuration = Math.max(3, Math.min(6, duration / 8)); // 3-6 seconds per segment
  let currentTime = 0;
  let id = 1;
  
  // Sample texts in different languages
  const sampleTexts: { [key: string]: string[] } = {
    'it': [
      "Benvenuti in questa passeggiata sonora.",
      "Qui potrete scoprire la storia di questo luogo.",
      "Ascoltate attentamente i suoni che vi circondano.",
      "Questa zona ha una storia molto particolare.",
      "Noterete i dettagli architettonici interessanti.",
      "Il paesaggio qui cambia durante le stagioni.",
      "Questo punto offre una vista panoramica unica.",
      "La tradizione locale racconta che...",
      "Osservate come la luce cambia durante il giorno.",
      "Grazie per aver partecipato a questo tour."
    ],
    'en': [
      "Welcome to this audio walking tour.",
      "Here you can discover the history of this place.",
      "Listen carefully to the sounds around you.",
      "This area has a very particular history.",
      "Notice the interesting architectural details.",
      "The landscape here changes with the seasons.",
      "This point offers a unique panoramic view.",
      "Local tradition tells us that...",
      "Observe how the light changes during the day.",
      "Thank you for participating in this tour."
    ],
    'es': [
      "Bienvenidos a este recorrido sonoro.",
      "Aquí pueden descubrir la historia de este lugar.",
      "Escuchen atentamente los sonidos que los rodean.",
      "Esta zona tiene una historia muy particular.",
      "Noten los detalles arquitectónicos interesantes.",
      "El paisaje aquí cambia durante las estaciones.",
      "Este punto ofrece una vista panorámica única.",
      "La tradición local cuenta que...",
      "Observen cómo cambia la luz durante el día.",
      "Gracias por participar en este tour."
    ]
  };
  
  const texts = sampleTexts[language] || sampleTexts['en'];
  
  while (currentTime < duration - 1) {
    const endTime = Math.min(currentTime + segmentDuration, duration);
    const textIndex = (id - 1) % texts.length;
    
    entries.push({
      id: id,
      startTime: formatTimestamp(currentTime),
      endTime: formatTimestamp(endTime),
      text: texts[textIndex]
    });
    
    currentTime = endTime + 0.5; // Small gap between segments
    id++;
  }
  
  return entries;
}

// Split text into timed segments
function splitTextIntoSegments(text: string, totalDuration: number) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const segmentDuration = totalDuration / sentences.length;
  
  return sentences.map((sentence, index) => ({
    start: index * segmentDuration,
    end: (index + 1) * segmentDuration,
    text: sentence.trim()
  }));
}
